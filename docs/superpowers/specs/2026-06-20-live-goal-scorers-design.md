# Live Goal Scorers + Minutes Design

**Date:** 2026-06-20
**Status:** Approved

## Goal

Show each goal's **scorer and minute** in the Live tab card, in two columns under the
score (team1's scorers beneath team1, team2's beneath team2), while staying within the
API-Football free tier (100 requests/day).

## Background / Constraints (from the existing codebase)

- The updater (`scripts/update-results.mjs`) already polls `fixtures?live=all` once per
  run (`fetchApiFootballLive`) and maps results via `mapApiFootballLive`
  (`scripts/lib/results-core.mjs`) into live entries
  `{ matchId, m, g1, g2, status, minute, extra }`, written by `buildResultUpdates` to
  `matches/{id}/live = { team1Goals, team2Goals, status, updatedAt, minute, extra }`.
- API-Football free tier = **100 requests/day**. The live fetch is best-effort and
  degrades silently on HTTP 429 / quota errors (finals + points via football-data.org
  are unaffected). Any new API usage must preserve this.
- Goal events come from a separate endpoint: `GET /fixtures/events?fixture={id}`. The
  response is **cumulative** (every goal so far), so a single fetch rebuilds the full
  scorer list. Event element schema:
  ```
  { time: { elapsed: 23, extra: null }, team: { name }, player: { name },
    type: "Goal", detail: "Normal Goal" | "Penalty" | "Own Goal" | "Missed Penalty" | … }
  ```
  Goals are `type === "Goal"`; `detail === "Missed Penalty"` is NOT a goal. An
  `"Own Goal"` is scored by a player on the **conceding** team and counts for the
  opponent.
- The live node is the only home for scorers; it is cleared when football-data.org
  finalizes the match (`buildResultUpdates` sets `matches/{id}/live = null`). Scorers are
  therefore a **live-only** feature — they disappear when the official final result lands.
- Frontend `buildLiveCard` (`app.js`) renders `.live-scoreline` (team1 | score+minute |
  team2) then `.live-people` (the projected leaderboard). Hebrew/RTL throughout.
- Tests run with bare `node --test tests/<file>` (NOT `node --test tests/`).

## Chosen approach: fetch events only on goal change

Each poll keeps pulling `fixtures?live=all` (1 call). For each live match, compare the
new goal total to the stored `m.live` node. When it changed (or the stored scorer list
is incomplete), fetch `/fixtures/events?fixture={id}` **once** and rebuild the scorer
list; otherwise carry the existing `m.live.scorers` forward with no call. Net cost ≈ one
event call **per goal** (single digits/day), not per poll.

Rejected:
- **Fetch events every poll for every live match** — roughly doubles API usage; can
  exceed 100/day.
- **Rely on inline events from `live=all`** — the live endpoint's inline `events` are
  unreliable/often empty; used opportunistically only (see below), never depended on.

## Components

### 1. `scripts/lib/results-core.mjs` (modify) — pure parsing

- **`parseGoalEvents(apiEvents, { homeIsT1 })` → `scorers[]`** (new export). Pure.
  - Keep only `e.type === 'Goal'` AND `e.detail !== 'Missed Penalty'`.
  - `minute = e.time.elapsed` (number, or `null`); `extra = e.time.extra` (number or `null`).
  - `kind`: `'pen'` if `detail === 'Penalty'`, `'og'` if `detail === 'Own Goal'`, else `'goal'`.
  - `player = e.player && e.player.name` (string; skip the event if absent).
  - Team attribution: the event belongs to `e.team.name`. Resolve to our `team` 1 or 2:
    - Determine whether the event's team is the API home side (compare `normAf(e.team.name)`
      to the home team name) and combine with `homeIsT1` to get 1 or 2 for a normal goal.
    - For an **own goal** (`kind === 'og'`), flip to the opposing team number (it counts
      for the opponent).
  - Return the array **sorted** by `(minute ?? 0)` then `(extra ?? 0)` ascending.
  - Robust to missing fields: skip malformed events; never throw.

- **`mapApiFootballLive`** (modify): include `fixtureId: f.fixture && f.fixture.id` in
  each returned live entry. Also expose, on the entry, `homeIsT1` (already computed
  internally) so the updater can call `parseGoalEvents` without re-deriving orientation.
  Optionally, if `f.events` is a non-empty array (opportunistic inline events), attach
  `inlineEvents: f.events` so the updater can parse without a separate call.

`buildResultUpdates` (modify): write `scorers` into the live node:
`matches/{id}/live = { team1Goals, team2Goals, status, updatedAt, minute, extra, scorers }`
where `scorers` comes from the live entry (default `[]`).

### 2. `scripts/update-results.mjs` (modify) — I/O

- New `fetchApiFootballEvents(fixtureId)`: `GET
  https://v3.football.api-sports.io/fixtures/events?fixture={id}` with the `x-apisports-key`
  header. Same best-effort pattern as `fetchApiFootballLive`: on non-OK / 429 / `errors`
  payload / throw, return `[]` (scorers simply stay empty; never breaks the run).
- After `mapApiFootballLive`, for each live entry decide whether to fetch events:
  - `prev = entry.m.live`; `prevScorers = (prev && prev.scorers) || []`;
    `prevTotal = (prev?.team1Goals || 0) + (prev?.team2Goals || 0)`;
    `newTotal = entry.g1 + entry.g2`.
  - **Fetch when** `newTotal > 0` AND (`newTotal !== prevTotal` OR `prevScorers.length !== newTotal`).
    Prefer `entry.inlineEvents` if present (no call); else
    `await fetchApiFootballEvents(entry.fixtureId)`.
  - Parse with `parseGoalEvents(events, { homeIsT1: entry.homeIsT1 })` → `entry.scorers`.
  - **Otherwise** carry forward: `entry.scorers = prevScorers`.
- Pass `scorers` through so `buildResultUpdates` writes it. (No change to the
  finals/points path; no extra reads.)

### 3. `app.js` (modify) — display only

- In `buildLiveCard`, read `const scorers = (live && live.scorers) || [];`.
- New helper `function scorerLine(s)` → `⚽ <minuteLabel> <name><mark>` where:
  - `minuteLabel` formats like the live clock: `` `${s.minute}+${s.extra}'` `` when
    `s.extra` is a positive number, else `` `${s.minute}'` `` (empty if minute null).
  - `<mark>` = ` ${t('live.penaltyMark')}` when `kind==='pen'`,
    ` ${t('live.ownGoalMark')}` when `kind==='og'`, else `''` (values in §4).
  - `name` is `escapeHtml(s.player)`.
- New `.live-scorers` block inserted **between** `.live-scoreline` and `.live-people`,
  rendered only when `scorers.length`:
  ```
  <div class="live-scorers">
    <div class="live-scorers-col">{team1 scorers}</div>
    <div class="live-scorers-col">{team2 scorers}</div>
  </div>
  ```
  Column 1 = `scorers.filter(s => s.team === 1)`, column 2 = `s.team === 2`, each mapped
  through `scorerLine` and joined. Order within a column is the array order (time-sorted).
- No other behavior changes.

### 4. `i18n.js` (modify)

Add two keys in all three languages:
- `'live.penaltyMark'`: he `'(פנדל)'`, en `'(pen)'`, es `'(pen)'`
- `'live.ownGoalMark'`: he `'(ש.ע)'`, en `'(OG)'`, es `'(a.p.)'`

### 5. `styles.css` (modify)

Add `.live-scorers` (flex row, two columns, small muted text, RTL-aware so column 1 sits
under team1 on the right) and `.live-scorers-col` (column layout, each line small). Goal
lines use `direction` handling so the `⚽` + `minute'` read correctly in RTL.

### 6. Cache-busting (`index.html`)

Bump every `?v=` string (currently `20260620f`) to the next version.

## Data flow

```
poll: fixtures?live=all (1 call, existing)
  └─ mapApiFootballLive -> entries incl. fixtureId, homeIsT1 (+ inlineEvents if any)
      └─ per entry: goal total changed vs stored m.live?
           yes -> fetchApiFootballEvents(fixtureId) [or inlineEvents]  (≈1 call PER GOAL)
                  -> parseGoalEvents(...) -> entry.scorers
           no  -> entry.scorers = m.live.scorers   (no call)
      └─ buildResultUpdates -> matches/{id}/live.scorers = entry.scorers
client buildLiveCard -> .live-scorers two columns (⚽ minute' name) under the score
finalize (football-data) -> live node cleared -> scorers gone (live-only feature)
```

## Edge cases

- **No event data / fetch fails / 429:** `fetchApiFootballEvents` returns `[]`; scorers
  stay empty; score + minute still render. No regression to live or finals.
- **Own goal:** attributed to the opposing team, marked `(ש.ע)`.
- **Penalty:** counted as a goal, marked `(פנדל)`. **Missed penalty:** excluded.
- **Missed a poll (2 goals at once):** events are cumulative, so one fetch rebuilds the
  full list regardless.
- **Scorers incomplete from a prior failed fetch:** `prevScorers.length !== newTotal`
  triggers a refetch next run (self-healing).
- **Disallowed/empty player name:** that event is skipped; other goals still show.
- **Names are Latin (English):** shown as the API provides; not translated (no player
  name table exists). Escaped to prevent injection.

## Testing

`tests/results-core.test.mjs` (add):
- `parseGoalEvents`: normal goal → correct team/minute/`kind:'goal'`.
- penalty → `kind:'pen'`; missed penalty → excluded.
- own goal → attributed to the OPPOSITE team, `kind:'og'`.
- away/home orientation: `homeIsT1` false flips team numbers correctly.
- stoppage: `extra` captured; ordering by minute then extra.
- malformed events (missing player/time) are skipped, no throw.
- `mapApiFootballLive` includes `fixtureId` and `homeIsT1` on entries (extend an
  existing live test).
- `buildResultUpdates` writes `scorers` into the live node (default `[]`).

Frontend: a headless harness renders a live card with a `scorers` array (incl. a penalty
and an own goal) and asserts both columns + the ⚽/minute/marks appear.

Updater wiring: `node --check` both modules; cannot run end-to-end locally (CI-only
secret).

## Out of scope

- Assists, cards, substitutions, VAR (goals + minutes only).
- Persisting scorers after the official final result lands (live-only).
- Translating/transliterating player names to Hebrew.
- Admin UI for scorers.
