# Persist Goal Scorers (after FT) + Show in Matches Tab

**Date:** 2026-06-21
**Status:** Approved

## Goal

Goal scorers (added in the live-scorers feature) currently live inside the
`matches/{id}/live` node, which the updater **nulls** when football-data.org posts the
official final result. So scorers vanish at finalize. This change:

1. **Persists** scorers to a path that survives finalize, so a finished game keeps its
   scorers for the hour it remains in the Live view.
2. **Shows** scorers in the **Matches tab** card too (permanently, for every played match).
3. While in the Matches tab card: orders the per-match bets/points **breakdown** rows by
   **leaderboard standing** (currently arbitrary `Object.keys` order).

## Background (current state)

- `buildResultUpdates` (`scripts/lib/results-core.mjs`) writes the live node:
  `matches/{id}/live = { team1Goals, team2Goals, status, updatedAt, minute, extra, scorers }`.
  On finalize, the finished loop sets `matches/{id}/live = null`.
- Frontend `buildLiveCard` (`app.js`) reads `live.scorers` and renders a two-column
  `.live-scorers` block via the top-level helper `scorerLine(s)`.
- Frontend `buildMatchCard` (`app.js`) renders the Matches tab card. For finished games it
  has a collapsible "breakdown" listing every member's bet + points, built from
  `Object.keys(groupMembers).map(...)` — **unsorted**.
- Leaderboard order (`renderLeaderboard`) = members sorted by `totalPoints` descending.
- Scorer object shape: `{ team: 1|2, player, minute, extra, kind: 'goal'|'pen'|'og' }`.

## Design

### 1. Persist scorers (backend) — `scripts/lib/results-core.mjs`

In `buildResultUpdates`'s **live loop**, write scorers to a persistent path and remove
them from the live node (single source of truth):

- Add: `updates['matches/${matchId}/scorers'] = Array.isArray(scorers) ? scorers : [];`
- The live-node object no longer carries a `scorers` key.

The **finished loop** is unchanged: it nulls `matches/{id}/live` but does **not** touch
`matches/{id}/scorers`, so the scorers persist. Nothing ever clears `matches/{id}/scorers`
(it becomes part of the match's history).

### 2. Live card reads the persistent field — `app.js` `buildLiveCard`

Change the scorers source to prefer the persistent field, falling back to the live node
(covers transitional nodes written before this change):

```js
const scorers = Array.isArray(m.scorers) ? m.scorers : ((live && Array.isArray(live.scorers)) ? live.scorers : []);
```

Rendering is otherwise unchanged (the `.live-scorers` two-column block already renders
whenever `scorers.length`). Because a finished game stays in the Live view for an hour
(`isInLiveTab`) and `buildLiveCard` already handles `hasResult`, scorers now show under the
final score for that window.

### 3. Matches tab card shows scorers — `app.js` `buildMatchCard`

- Compute `const scorers = Array.isArray(m.scorers) ? m.scorers : [];`.
- Build the same two-column block (reuse `scorerLine` and the `.live-scorers` /
  `.live-scorers-col` / `.live-scorer` CSS classes), team1 column then team2 column.
- Render it (only when `scorers.length`) **inside `.match-card-body`, immediately after the
  `.match-teams-row` div** and before `betAreaHtml`. It is always visible (not behind the
  breakdown toggle).

### 4. Matches breakdown ordered like the leaderboard — `app.js` `buildMatchCard`

Replace `Object.keys(groupMembers).map(uid => …)` (in the `breakdownHtml` block) with a
leaderboard-ordered list:

```js
const orderedUids = Object.keys(groupMembers).sort((a, b) =>
    ((groupMembers[b] && groupMembers[b].totalPoints) || 0) - ((groupMembers[a] && groupMembers[a].totalPoints) || 0)
    || nameForUid(a).localeCompare(nameForUid(b)));
```

where `nameForUid(uid)` resolves the display name the same way the existing row code does
(`groupUsersCache[uid]?.name || groupMembers[uid]?.name || t('groupSettings.unknownUser')`).
Then `orderedUids.map(...)` builds the rows (row markup unchanged). Primary key
`totalPoints` desc matches the leaderboard; the name tiebreak just makes ties stable.

## Data flow

```
updater live loop  -> matches/{id}/scorers = [...]   (persistent; every poll)
                   -> matches/{id}/live    = {..., NO scorers}
finalize (finished)-> matches/{id}/live    = null     (scorers untouched -> persists)

buildLiveCard   -> scorers = m.scorers || m.live.scorers -> .live-scorers (shows post-FT in Live view)
buildMatchCard  -> scorers = m.scorers -> .live-scorers under teams row (permanent)
                -> breakdown rows ordered by totalPoints desc (leaderboard order)
```

## Edge cases

- **Transitional live nodes** (written before this ships, scorers inside `live`, no
  `m.scorers`): the live card's fallback to `live.scorers` covers them until the next poll
  writes `m.scorers`. The Matches card has no fallback (it only reads `m.scorers`), but a
  finished match gets `m.scorers` on the updater's FT-window polls, so this self-resolves.
- **Late final goal** (between the last live poll and football-data finalize): the score is
  always correct (football-data), but a scorer name could rarely lag. Accepted; rare.
- **Not-started / no-goal matches:** no `m.scorers` → no scorers block. Unchanged.
- **Empty group / missing totalPoints:** `|| 0` guards keep the sort safe.

## Testing

`tests/results-core.test.mjs` (modify the existing scorers test):
- `buildResultUpdates` writes `matches/{id}/scorers` (from the live entry; default `[]`).
- The live node no longer contains a `scorers` key.

`tests/pure-logic.test.js`:
- A small pure helper for the breakdown ordering is **not** introduced (the sort is inline
  in `buildMatchCard`); coverage of ordering is via the headless harness below. (`scorerLine`
  is already unit-tested.)

Headless harnesses (`tests/manual/`):
- **Live card, finished game:** a match with `result` set, `finishedAt` recent, `live: null`,
  and `m.scorers` populated → assert the `.live-scorers` block + ⚽ + names render.
- **Matches card:** a finished match with `m.scorers` and several members with differing
  `totalPoints` → assert the scorers block renders AND the breakdown rows appear in
  descending-points order (assert the first/last name positions).

Updater wiring is covered by `node --check` (no new I/O — only the path the existing live
loop writes to changes).

## Out of scope

- Re-fetching events at finalize to catch a late goal (accepted rare lag).
- Adding the 🐙 octopus icon to the Matches breakdown rows (kept minimal; not requested).
- Changing where finished games appear/expire in either tab.
