# Updater Correctness: Own Goals, Cancelled Goals, VAR-Corrected Finals

**Date:** 2026-06-21
**Status:** Approved

## Goal

Three related production bugs, all where the updater mishandles a goal/result being
**taken away** (VAR) or an own goal:

- **A — Own-goal attribution.** Own goals are credited to the wrong team.
- **B — Stuck final score.** A finalized result is never revisited, so a later VAR
  correction (e.g. 5→4) sticks forever.
- **C — Stuck live scorer.** When a live goal is cancelled and the score returns to
  0–0, the scorer line remains.

All three are fixed in the updater (`scripts/lib/results-core.mjs` +
`scripts/update-results.mjs`).

## Confirmed root causes (from live API-Football data)

- **A:** API-Football labels an own-goal event with `team` = the **benefiting** team
  (e.g. `detail=Own Goal | team=Spain | player=H. Tambakti`). `parseGoalEvents`
  additionally **flips** the team, sending it to the wrong side. The flip is wrong.
- **B:** `classifyMatches` does `if (hasResult) continue` — once `matches/{id}/result`
  is set, the match is never re-examined, so a corrected football-data score is never
  applied. (Spain finalized 5–0; real 4–0 after a 90+2' VAR cancellation.)
- **C:** The updater's scorer-enrichment loop has
  `if (newTotal === 0 || …) { entry.scorers = prevScorers; continue; }`. When a goal is
  cancelled and the live total returns to 0, `newTotal === 0` short-circuits to **reuse**
  the previous (non-empty) scorer list instead of clearing it. (Iran's Taremi goal was
  cancelled; score went 0–0 but the scorer stayed.)

## Design

### Fix A — `parseGoalEvents` (results-core.mjs)

Remove the own-goal flip line:

```js
if (kind === 'og') team = team === 1 ? 2 : 1; // DELETE
```

The team computed from `eventIsHome`/`homeIsT1` is already the benefiting team for all
goal kinds (normal, penalty, own goal); `kind: 'og'` remains only as a display label.

Update the `parseGoalEvents` own-goal test to the real API convention: an own-goal
event's `team` is the **benefiting** team, `player` is the own-goaler, and the result
keeps that team (no flip). Example: `{ detail:'Own Goal', team:'Spain', player:'H. Tambakti' }`
with Spain as team1 → `{ team: 1, kind: 'og', player: 'H. Tambakti' }`.

### Fix C — scorer-enrichment loop (update-results.mjs)

Split the reuse guard so a zero total **clears** the list:

```js
if (newTotal === 0) { entry.scorers = []; continue; }                 // cleared (handles cancellation back to 0)
if (newTotal === prevTotal && prevScorers.length === newTotal) {       // unchanged + complete -> reuse, no call
    entry.scorers = prevScorers;
    continue;
}
```

Decreases to a non-zero total (e.g. 5→4) already fall through to a re-fetch because
`newTotal !== prevTotal`; only the `=== 0` case was broken.

### Fix B — re-finalize VAR-corrected results

**`classifyMatches` (results-core.mjs)** gains a `refinalizeWindowMs` option (default
`6 * 3600 * 1000`). Change the `hasResult` handling:

- If `hasResult` and (`m.finishedAt` is missing OR `now - m.finishedAt > refinalizeWindowMs`)
  → `continue` (old behavior, outside the window).
- If `hasResult` and within the window → run `findApiFixture(m, apiMatches)`. If matched,
  `status === 'FINISHED'`, both `fullTime` goals non-null, AND the football-data score
  **differs** from `m.result` (`g1 !== m.result.team1Goals || g2 !== m.result.team2Goals`)
  → push `{ matchId, m, g1, g2 }` to `finished` (a correction). Otherwise `continue`.

`buildResultUpdates` already overwrites `result`, `finishedAt`, and recalcs every
member's points + totals for entries in `finished` — so a correction reuses the exact
finalize+recalc path. No change to `buildResultUpdates`.

**`update-results.mjs` main flow** must not early-return when only a re-check is pending:

- Compute `recheckable = matches with a result and finishedAt within refinalizeWindowMs`.
- The "nothing to do" early-return fires only when **both** `candidates.length === 0`
  **and** `recheckable.length === 0`.
- When the football-data fetch + `classifyMatches` run, pass `refinalizeWindowMs` so the
  re-finalize comparison happens. (The football-data fetch already happens on every
  non-idle run; re-finalize adds only in-memory comparison, no extra API calls.)

## Data flow (re-finalize)

```
updater run
  ├─ candidates (started, no result) OR recheckable (result + finishedAt within 6h)? if neither -> idle return
  ├─ fetch football-data fixtures (existing)
  ├─ classifyMatches(..., refinalizeWindowMs)
  │     - unfinished started match, FINISHED in football-data           -> finished (new)
  │     - recently-finished match whose football-data score CHANGED      -> finished (correction)  [NEW]
  │     - in-play/paused                                                 -> live
  ├─ buildResultUpdates  -> result/status/finishedAt + per-user points + member totals (recalc)
  └─ fbPatch
```

## Edge cases

- **Flapping:** football-data is authoritative and stable post-match; re-finalize only
  acts when the score *differs*, and once corrected the next run sees equality and stops.
  The 6h window bounds how long a match is re-checked.
- **finishedAt reset:** a correction sets `finishedAt = now` (via buildResultUpdates), so
  the corrected match re-enters the 1h Live-view window briefly — acceptable (surfaces the
  correction) and self-limits.
- **Idle days:** if a correction lands when no other match is live AND the corrected match
  is older than 6h, it won't be auto-applied — acceptable (corrections settle within
  minutes/hours, well inside the window).
- **Scorers on a late-FT cancellation:** B fixes the *result* (and thus points). Live
  scorers come from the API-Football path; if a goal is cancelled exactly at FT, the
  persisted scorer list may rarely lag the corrected result. Accepted (the points-bearing
  result is correct; scorers are best-effort). Not in scope to re-fetch events at finalize.

## Testing

`tests/results-core.test.mjs`:
- **A:** own-goal event with `team` = benefiting team → that team, `kind:'og'`, no flip
  (replace the existing flip-based assertion). Re-confirm normal/penalty/orientation tests
  still pass.
- **B:** `classifyMatches` with `refinalizeWindowMs`:
  - a finished match (`result` set, `finishedAt` recent) whose football-data score differs
    → appears in `finished` with the new score.
  - same match whose football-data score equals the stored result → NOT in `finished`.
  - a finished match with `finishedAt` older than the window → NOT re-checked (not in
    `finished`), even if the score differs.
  - a match with no `finishedAt` → not re-checked.

`update-results.mjs` (I/O wrapper): `node --check` only; the early-return change and the
Fix C two-line change are verified by `node --check` + the unit suites passing (no
end-to-end run — the API key is CI-only).

## Out of scope

- Re-fetching scorer events during re-finalization (accepted rare scorer lag at FT).
- Any change to football-data as the authoritative result source.
- Admin UI for manual corrections (already done manually for Spain–Saudi this session).
