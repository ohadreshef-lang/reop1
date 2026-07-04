# Reliable 90′ Knockout Scoring + Show Both 90′ and A.E.T. Scores

**Date:** 2026-07-02
**Status:** Approved

## Goal

Two linked changes for knockout games that go to extra time:

1. **Reliable 90′ scoring.** Bets are scored on the **90-minute** result. Today we rely on
   football-data.org's `score.regularTime`, which is **null on the free tier** — so an
   extra-time game falls back to `fullTime` (the after-ET score) and mis-scores. (Live example:
   Belgium–Senegal was 2–2 at 90′, Tielemans scored at 120+5′ → stored 3–2, so a 1–1 draw
   prediction got 0 instead of the 2-point "correct direction".) Derive the 90′ result from
   **ESPN goal events** (which we already fetch + persist), whose per-goal minute cleanly
   identifies extra-time goals (minute > 90).
2. **Display both scores.** Show the 90′ result as the headline score, with the after-extra-time
   (a.e.t.) score beneath it when they differ, e.g. `2–2` + `אחרי הארכה 3–2`.

## Background

- Finals are written by `buildResultUpdates` (results-core.mjs) from `finished` entries
  (football-data). Each entry is `{matchId, m, g1, g2}` where `g1/g2` = football-data
  `fullTime` (via `classifyMatches`, after this project's earlier `regularTime`→`fullTime`
  fallback). Points are computed in the `scored` loop against `g1/g2`.
- Live scores + scorers come from ESPN (this repo's ESPN switch). Scorers persist at
  `matches/{id}/scorers` (never cleared) as `{team:1|2, player, minute, extra, kind}`.
  Extra-time goals carry minute > 90 (e.g. 105, 120); regulation + stoppage are ≤ 90.
  Shootout goals are already excluded by `parseEspnGoals`.
- The headline result score renders at `app.js:1202`
  (`<div class="result-score">${m.result.team1Goals} – ${m.result.team2Goals}</div>`).
  `.result-score` CSS is at `styles.css:592`.

## Design

### Updater — `splitKnockoutResult` (results-core.mjs, pure)

```js
export function splitKnockoutResult({ stage, g1, g2, scorers }) {
    const result = { team1Goals: g1, team2Goals: g2 };
    if (!isKnockoutStage(stage) || !Array.isArray(scorers)) return { result, resultAet: null };
    const et1 = scorers.filter(s => s && s.team === 1 && typeof s.minute === 'number' && s.minute > 90).length;
    const et2 = scorers.filter(s => s && s.team === 2 && typeof s.minute === 'number' && s.minute > 90).length;
    if (et1 + et2 === 0) return { result, resultAet: null };                 // no ET goals -> normal
    if (et1 > g1 || et2 > g2 || scorers.length !== g1 + g2) return { result, resultAet: null }; // ambiguous -> trust FD, no split
    return { result: { team1Goals: g1 - et1, team2Goals: g2 - et2 }, resultAet: { team1Goals: g1, team2Goals: g2 } };
}
```

- Uses football-data's authoritative **total** (`g1/g2`) and only uses ESPN to subtract the
  extra-time goals — so it's anchored to the reliable total and self-corrects the 90′ split.
- The `scorers.length === g1 + g2` gate means the split applies only when ESPN's goal count
  agrees with football-data's total (high confidence). For a normal-time knockout game (no ET
  goals) or group game, it returns the total with no `resultAet` — behavior unchanged.
- **Penalty shootouts / ESPN-missed goals fall through the gate** (total mismatch) → no split,
  result = football-data total, and the caller logs a warning for manual review (rare;
  correctable via the admin flow like Belgium–Senegal was).

### Updater — wire into `buildResultUpdates`

In the `finished` loop, compute the split per match; write `result` = 90′ result, plus
`resultAet` when present; **stash the 90′ score on the entry** so the `scored` points loop uses
it (not the raw `g1/g2`). Points must be computed against the 90′ result.

- `finished` loop: `const split = splitKnockoutResult({stage:m.stage, g1, g2, scorers:m.scorers});`
  → `updates[matches/${id}/result] = split.result`; if `split.resultAet`,
  `updates[matches/${id}/resultAet] = split.resultAet`; set `f.r1 = split.result.team1Goals`,
  `f.r2 = split.result.team2Goals`. When `split.resultAet` is null for a match that previously
  had one, this is a fresh finalize so no stale `resultAet` exists.
- `scored` points loop: use `f.r1/f.r2` (the 90′ score) in both `calcPoints` calls instead of
  `g1/g2`.
- Log a one-line warning when a knockout `finished` game has ET goals but the split was skipped
  (total mismatch) — flags penalty games / data gaps for manual review.

### App — display the a.e.t. score

At `app.js:1202`, when `m.resultAet` exists and differs from `m.result`, append a muted line:

```js
middleHtml = `<div class="result-score">${m.result.team1Goals} – ${m.result.team2Goals}</div>`
    + (m.resultAet && (m.resultAet.team1Goals !== m.result.team1Goals || m.resultAet.team2Goals !== m.result.team2Goals)
        ? `<div class="result-aet">${t('match.aet')} ${m.resultAet.team1Goals}–${m.resultAet.team2Goals}</div>` : '');
```

- i18n `match.aet`: he `אחרי הארכה`, en `a.e.t.`, es `tras la prórroga`.
- CSS `.result-aet` (near `.result-score`): small, muted, centered (e.g. `font-size:.72rem;
  color:#6b7280; margin-top:2px; text-align:center; font-weight:600;`).
- Cache-bust: bump every `?v=20260628c` in `index.html` to `20260702a`.

## Data model

```
matches/{id}/result     = { team1Goals, team2Goals }   // 90-minute score — used for scoring (unchanged field)
matches/{id}/resultAet  = { team1Goals, team2Goals }    // 120-minute (a.e.t.) score — display only; present only when a KO game had ET goals
```

`resultAet` is additive and optional; group games and normal-time knockout games never get it,
and the app shows it only when it differs from `result`.

## Testing

- `tests/results-core.test.mjs` — `splitKnockoutResult`:
  - group stage → `{result:{g1,g2}, resultAet:null}` (no split even with ET-looking minutes).
  - knockout, no ET goals (all minute ≤ 90) → no split.
  - knockout, one team-1 ET goal, `g1=3,g2=2`, 5 scorers → `result 2-2`, `resultAet 3-2` (the
    Belgium–Senegal case).
  - knockout, ET goals present but `scorers.length !== g1+g2` (e.g. penalty game) → no split,
    `result = {g1,g2}`, `resultAet:null`.
  - `et1 > g1` guard → no split.
- `buildResultUpdates` — a knockout finished game with an ET goal writes `result` = 90′ and
  `resultAet` = a.e.t., and the per-bet `points` are computed against the 90′ result (extend an
  existing buildResultUpdates test or add one).
- App display is a render-string change (manual/headless check that `resultAet` renders and is
  hidden when equal to `result`).

## Out of scope

- The one-off Belgium–Senegal data correction (already applied manually: result 2-2, resultAet
  3-2, points recomputed).
- A "won on penalties" indicator (penalty games score on the 90′/120′ result per the earlier
  "no who-advances bonus" decision; a pens note is a possible later nicety).
- Changing group-stage finalization or the football-data finals source.
