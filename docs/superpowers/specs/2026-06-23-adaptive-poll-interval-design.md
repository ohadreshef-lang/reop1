# Quota-Aware Updater Poll Interval

**Date:** 2026-06-23
**Status:** Approved

## Goal

The updater polls the API-Football live endpoint on a fixed cadence. At 5-min that's
~24 calls per 2-hour game, which can exhaust the free 100/day quota on a busy day (and
forced a manual slow-down to 10-min today). Make the cadence **self-managing**: poll
every **5 min when quota is healthy** and **10 min when it's running low**, so live
updates stay fresh when possible and never run the day dry. No manual toggling.

## Background

- The workflow (`.github/workflows/update-results.yml`) runs `node update-results.mjs`
  in a bash loop with a fixed `sleep` (currently temporarily 600s / 10-min; normally
  300s / 5-min). The loop is bounded by ~5.5h (and `timeout-minutes: 350`), breaks early
  on `LOOP_IDLE`, and exits with the last iteration's status.
- API-Football's `/status` endpoint returns `response.requests.{current, limit_day}` and
  is **free** (does not count against the daily quota).
- Yesterday's fixes stay in force: the API-Football live call only fires when a game is
  in progress (`candidates.length > 0`), and the re-finalize loop keeps running for ~6h
  post-game using football-data only.

## Design

### `scripts/lib/poll-interval.mjs` (new, pure)

```js
export const POLL_LOW_QUOTA_THRESHOLD = 30;
// 5-min (300s) when quota is healthy; 10-min (600s) when low OR unknown (conservative).
export function choosePollSeconds(remaining) {
    return (Number.isFinite(remaining) && remaining >= POLL_LOW_QUOTA_THRESHOLD) ? 300 : 600;
}
```

Pure and unit-testable. `remaining >= 30` → 300; `< 30`, `NaN`, `undefined` → 600.

### `scripts/poll-seconds.mjs` (new, thin I/O)

- `GET https://v3.football.api-sports.io/status` with header `x-apisports-key: <FOOTBALL_API_KEY>`.
- `remaining = response.requests.limit_day - response.requests.current`.
- Print `choosePollSeconds(remaining)` to stdout.
- On any failure (no key, network error, non-OK, malformed/`errors` payload) → print `600`
  (conservative). The `/status` call is free, so this can run every loop iteration.

### `.github/workflows/update-results.yml` (modify)

Replace the fixed-`sleep` loop with an **adaptive, deadline-bounded** loop:

- Compute a deadline `END = now + ~5.5h` (so a variable interval still bounds the run).
- Each iteration: run `node scripts/update-results.mjs` (keep `set +e`, capture `last=$?`,
  print output); break early if the output contains `LOOP_IDLE`.
- After each (non-final) iteration: `SLEEP=$(node scripts/poll-seconds.mjs 2>/dev/null || echo 600)`;
  log the chosen interval; `sleep "$SLEEP"`.
- Loop while `now < END`. `exit $last` at the end.
- Update the step name/comments to "~adaptive cadence (5/10-min by quota)". Remove the
  temporary "10-min" hardcode (this change supersedes it).

`timeout-minutes: 350` is retained as a hard backstop.

## Data flow

```
each loop iteration:
  node update-results.mjs            (live call only if a game is in progress; re-finalize via football-data)
  remaining = /status (FREE)         -> choosePollSeconds -> 300 or 600
  sleep <chosen>                     -> next iteration, until the ~5.5h deadline or LOOP_IDLE
```

## Edge cases

- **`/status` fails / key missing:** `poll-seconds.mjs` prints `600` → conservative 10-min;
  live scoring still works (just slower), no quota risk.
- **Quota drops mid-run:** re-evaluated every iteration, so the cadence tightens to 10-min
  as soon as `remaining` crosses below 30 — no need to wait for the next run.
- **Quota resets at 00:00 UTC:** the next iteration sees `remaining` jump back up and
  returns to 5-min automatically — this is the auto-revert the manual toggle was for.
- **Boundary:** `remaining === 30` → 5-min (300); `29` → 10-min (600).

## Testing

`tests/poll-interval.test.mjs` (Node `node --test`):
- `choosePollSeconds(50) === 300`, `choosePollSeconds(30) === 300` (boundary),
  `choosePollSeconds(29) === 600`, `choosePollSeconds(0) === 600`,
  `choosePollSeconds(undefined) === 600`, `choosePollSeconds(NaN) === 600`.

`scripts/poll-seconds.mjs`: `node --check` for syntax; one **real local run** (it hits only
the *free* `/status` endpoint, so zero quota cost) to confirm it prints `300` or `600`.

Workflow YAML: verified by inspection (`node --check` does not apply to YAML).

## Out of scope

- Throttling the re-finalize / football-data polling cadence (separate quota, generous).
- More than two cadence tiers (chosen: 5-min / 10-min, threshold 30).
- Any frontend change.
