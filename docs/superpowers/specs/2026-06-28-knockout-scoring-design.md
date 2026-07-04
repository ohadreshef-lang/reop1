# Knockout-Stage Scoring (90' result, higher points + high-score bonus)

**Date:** 2026-06-28
**Status:** Approved

## Goal

Score knockout-stage games (Round of 32 → Final) differently from group games, and on the
**90-minute (regulation) result** rather than the after-extra-time score:

- Group stage (unchanged): exact score = **4**, correct direction = **1**, else 0.
- Knockout stage: exact score = **5**; exact score **with ≥ 5 total goals** = **7** (+2 bonus);
  correct direction only = **2**; else 0.
- Knockout results are taken from the score **at the end of 90 minutes** (regulation, including
  the referee's stoppage time) — extra time and penalty-shootout goals are ignored.

The change is **forward-only**: it must not alter any already-stored points or leaderboard
totals. Group scoring is untouched, no knockout game has been scored yet, and points are only
(re)written per-match when a result lands — there is no bulk recompute.

## Background (current behavior)

- Two independent scoring implementations, intentionally separate, both must change in lockstep:
  - `app.js` — `getOutcome` (`app.js:189`), `calcPoints(b1,b2,r1,r2)` (`app.js:195`). Called at
    `app.js:1214` (my-bets/match render), `app.js:1345` (projected-leaderboard provisional),
    `app.js:1406` (`matchOf` live card), and twice in `recalcPoints(matchId,resG1,resG2)`
    (`app.js:2076`, `app.js:2080`).
  - `scripts/lib/results-core.mjs` — `getOutcome` (`:48`), `calcPoints(b1,b2,r1,r2)` (`:52`),
    called in `buildResultUpdates` at `:256` and `:260`. The automated updater computes points
    here.
- The updater takes the finished score from football-data.org's `am.score.fullTime`
  (`results-core.mjs:204`). For a game that went to extra time / penalties, `fullTime` is the
  **after-ET / post-shootout** score, not the 90' score.
- Stages: `['group','R32','R16','QF','SF','3rd','Final','special']`. "Knockout" = any stage that
  is not `group` and not `special`.
- `i18n.js` `rules.html` (he `:31`, en `:334`, es `:621`) renders the user-facing rules screen
  ("חוקי המשחק"). The compact keys `leaderboard.scoringExact` / `leaderboard.scoringWinner`
  exist but are **rendered nowhere** (dead keys) — leave them alone.

## Design

### Shared scoring rule (mirrored in both files)

```js
function isKnockoutStage(stage) {
    return stage != null && stage !== 'group' && stage !== 'special';
}

function calcPoints(b1, b2, r1, r2, stage) {
    const ko = isKnockoutStage(stage);
    if (b1 === r1 && b2 === r2) {                 // exact score
        if (ko) return (r1 + r2) >= 5 ? 7 : 5;    // +2 high-score bonus on 5+ total goals
        return 4;
    }
    if (getOutcome(b1, b2) === getOutcome(r1, r2)) return ko ? 2 : 1;  // correct direction
    return 0;
}
```

- `stage` is a new trailing parameter. When omitted/unknown, `isKnockoutStage` returns false →
  group scoring — so any stray 4-arg call is safe (backward compatible).
- The high-score bonus uses the **actual result** total (`r1 + r2`); since the bonus only applies
  on an exact match, predicted total equals result total.

### `app.js` call sites

Pass the match's stage to every `calcPoints` call:

- `:1214` → add `, m.stage`
- `:1345` → add `, g.stage` (the projected-leaderboard loop variable is `g`)
- `:1406` (`matchOf`) → add `, m.stage`
- `recalcPoints` (`:2063`): look up the match once at the top —
  `const stage = (matches[matchId] || {}).stage;` — and pass `stage` at both call sites
  (`:2076`, `:2080`).

### `results-core.mjs`

1. Make `calcPoints`/`isKnockoutStage` stage-aware (same code as above); export `isKnockoutStage`
   for testing.
2. In `buildResultUpdates`, the `finished` entries already carry `m` (`{matchId, m, g1, g2}` from
   `classifyMatches`). Pass `m.stage` to `calcPoints` at `:256` and `:260`.
3. In `classifyMatches`, source the finished score from the **90-minute** score:
   ```js
   const sc = (am.score && am.score.regularTime && am.score.regularTime.home != null)
       ? am.score.regularTime          // present for extra-time / penalty games = 90' score
       : (am.score && am.score.fullTime);   // normal games: fullTime IS the 90' score
   const g1 = found.t1IsHome ? (sc && sc.home) : (sc && sc.away);
   const g2 = found.t1IsHome ? (sc && sc.away) : (sc && sc.home);
   ```
   football-data.org v4 exposes `score.regularTime` (goals after 90 minutes) separately from
   `extraTime` and `penalties`. For normal-time games `regularTime` may be absent — the fallback
   to `fullTime` (which equals the 90' score when there was no extra time) covers that. The
   existing `am.status === 'FINISHED'` and `home !== null` guards stay as they are, keyed off
   `sc` instead of `ft`.

### i18n — rules screen (`rules.html`, all three languages)

Replace the single "Scoring" `<ul>` with a group-stage block and a knockout-stage block. Exact
copy is in the plan. Knockout block explains: scored on the 90-minute result (incl. stoppage,
no ET/penalties); exact = 5; +2 bonus for an exact score with 5+ total goals (= 7); direction = 2;
miss = 0. Stage label wording: he "משלב 32 ואילך", en "Round of 32 onward", es "desde
dieciseisavos" (matching `stage.R32`).

### Cache-busting

Bump every `?v=` string in `index.html` (currently `20260626a`) to `20260628a`.

## Data flow

```
admin enters result / updater finalizes (90' score via regularTime)
  -> recalcPoints / buildResultUpdates
     -> calcPoints(b1,b2,r1,r2, match.stage)
        -> group: 4/1/0   |   knockout: 5 (+2 if 5+ goals) / 2 / 0
```

## Forward-only guarantee

- Knockout-only formula change; group stays 4/1/0 → no group game's points move.
- No knockout game has a result yet → nothing to recompute.
- Points are written only by `recalcPoints` / `buildResultUpdates`, per-match on result entry —
  no global recompute runs on deploy. Existing stored `points` and `totalPoints` are untouched.

## Edge cases

- **Knockout decided in normal time:** football-data `duration: REGULAR`, `regularTime` may be
  null → fallback to `fullTime` = the 90' score. Correct.
- **Knockout to extra time / penalties:** `regularTime` holds the 90' score → used; ET/shootout
  goals ignored. A knockout game thus *displays* its 90' score even if it finished higher a.e.t.
  (acceptable; an "a.e.t." display note is explicitly out of scope here).
- **Exact 0–0 knockout:** exact = 5, total 0 < 5 → no bonus → 5.
- **Exact 3–2 / 4–1 / 5–0 knockout:** exact + total ≥ 5 → 7.
- **Special bets (champion / top scorer):** never use `calcPoints` (fixed 10 via
  `TOURNAMENT_POINTS`) — unaffected.

## Testing

- `tests/pure-logic.test.js` (`app.calcPoints`): keep group cases (now passing `'group'`); add
  knockout cases — exact decisive (5), exact 5+ goals (7), exact 0–0 (5), direction (2), miss (0);
  and `isKnockoutStage` for `group`/`special`/`R32`/`Final`/undefined.
- `tests/results-core.test.mjs`: same calcPoints knockout cases; add a `classifyMatches` test that
  a finished fixture with `score.regularTime` different from `score.fullTime` (extra-time game) is
  finalized on `regularTime`, and that a `REGULAR` fixture with only `fullTime` still works.

## Out of scope

- "a.e.t." / extra-time display annotation on knockout cards.
- The dead `leaderboard.scoring*` i18n keys.
- Any change to group-stage scoring or to the special (champion/top-scorer) bets.
- The 5-min-vs-1-hour lock wording already present in `rules.html` (pre-existing, untouched).
