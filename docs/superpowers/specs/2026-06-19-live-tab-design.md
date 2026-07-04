# Live tab + per-person past-game breakdown — design

Date: 2026-06-19

## Overview

Add a **Live** tab dedicated to games whose betting has closed, showing each group
member's prediction and their **provisional points** against the current (live)
score. Also make finished games in the existing **Matches** tab expandable to show,
per member, their bet, the real score, and the points they earned. To feed the live
score, the results updater runs every 5 minutes and records in-progress scores.

## Requirements (from the request + clarifications)

1. New **Live** tab dedicated to the currently-relevant games.
2. A game appears in Live **once its bets are locked** (1h before kickoff), so
   per-person predictions are revealed only after betting closes.
3. Live tab shows **all** locked-not-finished games concurrently (a list), not one.
4. Each game shows **per-person** bets and the points each person currently gets
   from the **live score**.
5. A finished game **stays in the Live tab for at least 1 hour after it ends**, then
   drops off (still available in Matches).
6. The GitHub Action runs **at least every 5 minutes** to refresh live scores.
7. In the **Matches** tab, finished games are **expandable**: per member, show their
   bet, the real score, and the points they got.

## Non-goals (YAGNI)

- Real-time/websocket updates. "Live" means "as of the last 5-minute poll."
- Match-minute clock, possession, lineups, or any data beyond score + status.
- Server-side computation of per-person provisional points (done in the browser).
- Reworking the auth/DB-rules model (tracked separately; out of scope here).

## External constraints / risks

- **Live-score coverage depends on football-data.org's free tier** returning
  `IN_PLAY`/`PAUSED` status with a current score. The updater today only consumes
  `FINISHED`. This must be verified against a live match during implementation; if the
  free tier withholds in-play scores, the Live tab still works (shows bets + status)
  but the live score will be absent until FINISHED.
- **GitHub scheduled cron is best-effort** and can lag/skip under load. `*/5` is
  "usually ~5-min fresh," not guaranteed real-time. Accepted for v1.

## Data model

New node, written only while a game is in progress, cleared when it finishes:

```
matches/{matchId}/live = { team1Goals, team2Goals, status, updatedAt }
    status: 'IN_PLAY' | 'PAUSED'        (PAUSED = halftime)
    updatedAt: epoch ms of the poll that wrote it
```

New field, written when the final result lands (cron updater **and** admin
`saveResult`), used to time the "1h after the game" window precisely:

```
matches/{matchId}/finishedAt = epoch ms
```

`result`, `status`, and per-bet `points` are unchanged. `live` is independent of
`result`; on FINISHED the updater writes `result` + `finishedAt` and removes `live`.

## Updater changes (`scripts/update-results.mjs`)

- Workflow cron `*/30` → `*/5` (in `.github/workflows/update-results.yml`).
- Candidate set widens from "past kickoff, no result" to also include matches that are
  **currently in play** (kickoff ≤ now ≤ kickoff + ~2.5h, no final result). The broad
  unfiltered fetch already returns every status, so no extra API call shape is needed.
  The football API is still only called when at least one game is live or just-finished,
  so off-hours within the tournament window stay cheap (early-exit unchanged).
- For an API match with status `IN_PLAY`/`PAUSED` and a present score → write
  `matches/{id}/live = { team1Goals, team2Goals, status, updatedAt: now }`
  (orientation mapped to team1/team2 exactly like the FINISHED path).
- For `FINISHED` → existing flow (write `result`, recalc per-bet `points` + member
  totals), **plus** set `matches/{id}/finishedAt = now` and `matches/{id}/live = null`.
- Stale-red detection and the retry/backoff wrapper are unchanged.

## Frontend changes (`app.js`, `index.html`, `i18n.js`, `styles.css`)

### New Live tab
- Tab button + `#tab-live` panel. i18n key `tabs.live` (he: `🔴 חי`, en: `Live`,
  es: `En vivo`).
- `renderLive()` selects games where `lockTime ≤ now` **and** the game is not "long
  finished": include if there is no `result`, OR `now − endTime < 1h`, where
  `endTime = finishedAt` if present else `parseMatchDate(date) + 2h` (fallback).
- For each included game (sorted by kickoff): teams, status badge
  (locked / live / halftime / awaiting score / final), the score from `live` (or
  `result` once finished, or "—" before kickoff), and a row per member:
  name, prediction `g1–g2`, and provisional points.
- **Provisional points** = `calcPoints(bet, liveScore)` computed in the browser, shown
  with a "live/not-final" affordance. Before any score exists, points show "—".

### All-members bets
- New listener on `bets/{currentGroupId}` populating an `allGroupBets` map
  ({uid → {matchId → bet}}). Started/stopped alongside the existing group listeners.
- **Privacy gate:** per-person bets render only for games that are **locked or
  finished**. Open-betting games never reveal predictions. (DB is already auth-gated;
  this is a UI gate, not a security boundary.)

### Matches tab — expandable finished games
- A finished match card gets an expand toggle revealing a per-member breakdown:
  name, their bet, the real score, points earned (reusing `allGroupBets` + each
  member from `groupMembers`).

### Re-render wiring
- `renderCurrentTab()` handles `'live'`. The `matches`/`bets` listeners re-render Live
  when it's active (live score and bets change). Unlike the Matches-tab focus behavior,
  Live re-rendering on refresh is desired (the score is the point).

## Cache-busting

Bump `?v=` in `index.html` (all assets) and `CACHE_VERSION` in `service-worker.js`,
per project convention, since JS/CSS/HTML change.

## Testing / verification

**Hard rule: everything is verified with mock data and NO writes to the production
Firebase, before any merge/deploy.** Concretely:

- **Deterministic logic tests (Node, mirroring app logic):** Live-tab inclusion window
  (locked-not-started, in-play, finished-<1h-ago stays, finished->1h-ago drops, with
  and without `finishedAt`); provisional `calcPoints` for live scores.
- **Updater with mock API + no prod writes:** drive `update-results.mjs` with a mocked
  football-data response (an `IN_PLAY` fixture and a `FINISHED` fixture) and a mocked
  `fbPatch` (or `DRY_RUN`) so it never touches prod. Assert the planned writes: a
  `live` node for the in-play game; `result` + `finishedAt` + `live: null` for the
  finished one. Achieve this by factoring the pure planning logic so it can be called
  with injected data (no network), keeping `main()` as the thin I/O wrapper.
- **Frontend with mock state:** a local/headless harness loads the app, stubs Firebase,
  injects mock `matches` (incl. a `live` node), `groupMembers`, and `allGroupBets`,
  then calls `renderLive()` / `renderMatches()` and asserts the DOM: per-person rows,
  provisional points, inclusion window, privacy gate (open game hides bets), and the
  finished-card expand showing bet/real-score/points. No prod connection.
- **Headless smoke load** for no console errors.
- Only after all the above pass on the branch do we merge; the existing cron keeps
  running the old script until merge. A real-match sanity check can follow in prod
  once a live game is available, but is not a gate for merge.

## Open question to confirm during implementation

- Exact football-data.org field for in-play score (`score.fullTime` vs a live field)
  and status values — verify and adjust the mapping.
