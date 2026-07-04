# Switch Live Scores to ESPN's Keyless API

**Date:** 2026-06-29
**Status:** Approved

## Goal

Replace the live in-play score source (API-Football, whose free account keeps getting
suspended) with **ESPN's keyless public scoreboard API**, which needs no account/key and
therefore can't be suspended. Final results + points stay on football-data.org (unchanged).
**ESPN-only — no API-Football fallback.**

## Background

- The updater (`scripts/update-results.mjs`) writes `matches/{id}/live` and
  `matches/{id}/scorers`; finals come from football-data.org via `classifyMatches`.
- Live currently flows: `fetchApiFootballLive()` → `mapApiFootballLive()` (results-core) →
  live entries `{matchId, m, g1, g2, status, minute, extra, …}`; scorers via
  `fetchApiFootballEvents()` → `parseGoalEvents()`. Gated on `AF_KEY && candidates.length>0`.
- API-Football account is suspended (verified `/status` → "account is suspended"), so live
  returns nothing.

## Verified ESPN facts (probed live, 2026-06-29)

- Scoreboard (keyless): `GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard`
  returns `events[]`; each `competitions[0]` has `competitors[]` (`homeAway`, `score` as a
  string, `team.displayName`) and `status.type` (`state`: `pre`|`in`|`post`, `detail`,
  `completed`) plus `status.displayClock` ("29'") and `status.period`.
- Summary (keyless): `…/summary?event={id}` → `keyEvents[]`; a goal has `scoringPlay:true`,
  `shootout:false`, `clock.displayValue` ("29'"), `period.number`, `team.displayName`,
  `participants[0].athlete.displayName` (scorer), and `type.type`/`type.text`/`text`.
- Team-name match: all R32 ESPN names resolve against `HEB_TO_EN` via `norm` **except three**,
  which need aliases: `United States`→`USA`, `Congo DR`→`DR Congo`,
  `Bosnia-Herzegovina`→`Bosnia and Herzegovina`. ("Round of 32 N Winner" placeholders for the
  next round never match a real DB match — harmlessly ignored.)

## Design

Reuse the existing live-entry contract so `buildResultUpdates` and the live-node shape
(`{team1Goals, team2Goals, status, updatedAt, minute, extra}` + persistent `scorers`) are
**unchanged**. This is a **backend/updater-only** change — no `app.js`/`i18n.js`/`index.html`
edits, no cache bump.

### results-core.mjs (pure)

1. **Aliases** — add to `API_ALIASES` (consumed by `norm`):
   `'united states':'usa'`, `'congo dr':'dr congo'`, `'bosnia-herzegovina':'bosnia and herzegovina'`.
2. **`espnMinute(displayClock)`** → `{minute, extra}`: `"29'"`→`{29,null}`, `"45'+2'"`→`{45,2}`,
   `""`→`{null,null}`.
3. **`mapEspnLive({matches, espnEvents, now, inPlayWindowMs=3h})`** → `[{matchId, m, g1, g2,
   status, minute, extra, espnEventId, homeName, homeIsT1}]`. Mirror `mapApiFootballLive`'s
   match loop: resolve `HEB_TO_EN[m.team1/2]` → `norm`; find the single ESPN event whose two
   competitors' `norm(team.displayName)` equal the pair, within ±36h of kickoff, with
   `status.type.state` ∈ {`in`,`post`}. Compute `homeIsT1`, `g1`/`g2` from `parseInt(score)`;
   `status` = `post`/`completed`→`'FT'`, else halftime (`/half|^ht\b/i` on detail/shortDetail)
   →`'PAUSED'`, else `'IN_PLAY'`; `minute`/`extra` from `espnMinute(status.displayClock)`.
   `homeName` = the ESPN home competitor `displayName` (so scorer team-matching works).
4. **`parseEspnGoals(keyEvents, {homeName, homeIsT1})`** → same shape as `parseGoalEvents`:
   `{team:1|2, player, minute, extra, kind}`. Filter `scoringPlay===true && shootout!==true`;
   `player` = `participants[0].athlete.displayName` (skip if absent); minute/extra from
   `espnMinute(clock.displayValue)`; `kind` = `'og'` if `/own/` in type/text, `'pen'` if
   `/penalt/`, else `'goal'`; `team` from `norm(e.team.displayName)===norm(homeName)` mapped via
   `homeIsT1`. Sort by minute then extra. (Own-goal team attribution is best-effort.)
5. **Remove** the now-dead API-Football live code: `mapApiFootballLive`, `parseGoalEvents`,
   and any constants/helpers that become unused (`AF_INPLAY`, `AF_FINISHED`, `normAf`,
   `AF_NAME_FIX`) — verify with grep that nothing else references them before deleting
   (`classifyMatches`/finals use football-data + `norm`, not these).

### update-results.mjs (network + orchestration)

1. Add `fetchEspnScoreboard()` → `events[]` (default scoreboard = current window; best-effort,
   returns `[]` on any error/non-200) and `fetchEspnSummary(eventId)` → `keyEvents[]`.
2. Rewrite the live block in `main()`: when `candidates.length > 0`, fetch the scoreboard,
   `mapEspnLive(...)`, then for each live entry keep the existing **reuse-if-unchanged**
   scorer optimization (`newTotal===0`→`[]`; unchanged total & complete list → reuse;
   else `parseEspnGoals(await fetchEspnSummary(entry.espnEventId), {homeName, homeIsT1})`).
   No key gating — ESPN needs none.
3. **Remove** `fetchApiFootballLive`, `fetchApiFootballEvents`, the `AF_KEY` constant/usage,
   and drop `FOOTBALL_API_KEY` from the workflow env (`.github/workflows/*.yml`).

### Polling / cost

ESPN has no published quota; poll modestly. The existing workflow cadence (self-poll during a
live window, end early when idle) is unchanged — one scoreboard call per cycle + one summary
call per live game only when its score changed.

## Data flow

```
candidates>0 → fetchEspnScoreboard() → mapEspnLive() → live[{…, espnEventId}]
   per live game w/ changed score → fetchEspnSummary() → parseEspnGoals()
buildResultUpdates() → matches/{id}/live + /scorers   (shape unchanged)
finals + points: football-data.org via classifyMatches (UNCHANGED)
```

## Testing

`tests/results-core.test.mjs`: replace the API-Football live tests with ESPN ones using sample
payloads —
- `espnMinute`: `"29'"`, `"45'+2'"`, `""`.
- `mapEspnLive`: an in-play event (state `in`, score 0–1, displayClock "41'") → correct
  `g1/g2/status='IN_PLAY'/minute`; orientation when our team1 is ESPN away; halftime detail →
  `'PAUSED'`; `post` → `'FT'`; the 3 alias teams (United States / Congo DR / Bosnia-Herzegovina)
  match; a `pre` event yields no entry.
- `parseEspnGoals`: a goal keyEvent → `{team, player, minute, kind:'goal'}`; a shootout/own/pen
  case; non-scoring keyEvents ignored.
Finals/`classifyMatches` tests stay as-is.

## Out of scope

- Any `app.js`/frontend change (live-node shape unchanged; no cache bump).
- ESPN as a finals source (football-data.org keeps that).
- Historic/backfill; pre-match lineups; cards.
- API-Football fallback (explicitly excluded — ESPN-only).
