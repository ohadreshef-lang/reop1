# Auto-Sync Upcoming Scheduled Fixtures

**Date:** 2026-07-04
**Status:** Approved

## Goal

Automatically add upcoming scheduled knockout fixtures to the DB so they don't have to be
entered by hand each round (e.g. Round of 16 as R32 finishes, then QF, SF, Final). A GitHub
Action runs **twice a day**, reads the official schedule, and inserts any new, determined
fixtures.

## Background

- Matches live at `worldcup2026/matches/{key}` as `{team1, team2, date, stage, group, status,
  result}`. Times are stored **UTC-naive** ("2026-07-04T19:00") — both `app.js`
  (`new Date(dateStr + 'Z')`, displayed in `Asia/Jerusalem`) and the updater
  (`Date.parse(\`${dateStr}Z\`)`) parse them as UTC.
- The results updater already fetches football-data.org's WC matches
  (`/v4/competitions/WC/matches`, `X-Auth-Token: FOOTBALL_DATA_TOKEN`); each match has
  `homeTeam.name` / `awayTeam.name`, `utcDate`, `status`, and `stage`.
- `results-core.mjs` exports `HEB_TO_EN` (Hebrew→English team names), `norm` (NFD + lowercase +
  `API_ALIASES`), and `API_ALIASES`. `findApiFixture` already matches football-data English
  names to our Hebrew via `HEB_TO_EN` + `norm`, so the inverse resolves the same names.
- R32 (and group) fixtures already exist. Knockout pairings are unique (a given pair meets once).

## Design

Pure mapping in `results-core.mjs` (testable) + a thin network script + a workflow.

### Pure helpers (results-core.mjs)

```js
// English (football-data) -> Hebrew, keyed by norm() so aliases bridge spelling differences.
export const EN_TO_HEB = (() => {
    const m = {};
    for (const [he, en] of Object.entries(HEB_TO_EN)) m[norm(en)] = he;
    return m;
})();
export function resolveHebTeam(fdName) { return EN_TO_HEB[norm(fdName)] || null; }

const FD_STAGE = { LAST_32: 'R32', LAST_16: 'R16', QUARTER_FINALS: 'QF', SEMI_FINALS: 'SF',
                   THIRD_PLACE: '3rd', THIRD_PLACE_FINAL: '3rd', FINAL: 'Final' };
export function fdStageToOurs(fdStage) { return FD_STAGE[fdStage] || null; }  // group/unknown -> null (skipped)

export function utcToNaive(utcDate) { return String(utcDate || '').slice(0, 16); } // "…T19:00:00Z" -> "…T19:00"

// Same shape as app.js seedMatchKey (stage_group_date_t1_vs_t2, sanitized). group is '-' for KO.
export function fixtureKey({ stage, team1, team2, date }) {
    return `${stage}_-_${date}_${team1}_vs_${team2}`.replace(/[.#$[\]/']/g, '_');
}

// Given football-data matches + the current DB matches, return new knockout fixtures to insert.
export function mapScheduledFixtures({ fdMatches, existingMatches, now, windowEndMs }) {
    const pairKey = (a, b) => [a, b].sort().join('|');
    const existingPairs = new Set();
    for (const m of Object.values(existingMatches || {})) {
        if (m && m.team1 && m.team2) existingPairs.add(pairKey(m.team1, m.team2));
    }
    const SCHED = new Set(['SCHEDULED', 'TIMED']);
    const seen = new Set();
    const out = [];
    for (const fm of (fdMatches || [])) {
        if (!fm || !SCHED.has(fm.status)) continue;               // only not-yet-played
        const stage = fdStageToOurs(fm.stage);
        if (!stage) continue;                                      // group/unknown -> skip
        const t1 = resolveHebTeam(fm.homeTeam && fm.homeTeam.name);
        const t2 = resolveHebTeam(fm.awayTeam && fm.awayTeam.name);
        if (!t1 || !t2) continue;                                  // TBD / unresolved -> skip
        const pk = pairKey(t1, t2);
        if (existingPairs.has(pk) || seen.has(pk)) continue;       // already have this matchup
        const date = utcToNaive(fm.utcDate);
        const ms = Date.parse(`${date}Z`);
        if (!date || Number.isNaN(ms)) continue;
        if (ms < now - 6 * 3600 * 1000) continue;                 // skip long-past games
        if (windowEndMs && ms > windowEndMs) continue;
        seen.add(pk);
        out.push({ key: fixtureKey({ stage, team1: t1, team2: t2, date }),
                   match: { team1: t1, team2: t2, date, stage, group: null, status: 'upcoming', result: null } });
    }
    return out;
}
```

Dedup is by **normalized team-pair against all existing matches**, not by key — so it can't create
duplicates even though older keys (R32) embed a different (pre-UTC-fix) time string than a
football-data-derived key would.

### Network script — `scripts/sync-fixtures.mjs`

- Anonymous Firebase sign-in (same as `update-results.mjs`).
- `GET /v4/competitions/WC/matches?dateFrom=<today>&dateTo=<window end>` with `FOOTBALL_DATA_TOKEN`.
- Fetch existing `matches` (full, for team-pair dedup).
- `mapScheduledFixtures(...)`; if any, PATCH `worldcup2026` with `matches/{key}` = record (add-only —
  keys are new; even a key collision would only re-write an identical scheduled stub, but dedup
  prevents that).
- Log each added fixture and a one-line count of skipped (unresolved team / unmapped stage) for
  visibility. Never writes `result`/`live`/points — purely inserts scheduled match rows.
- No-op safely outside the tournament window or when football-data is unreachable (best-effort).

### Workflow — `.github/workflows/sync-fixtures.yml`

- `schedule: cron '0 6,18 * * *'` (06:00 & 18:00 UTC) + `workflow_dispatch`.
- `concurrency: sync-fixtures` (cancel-in-progress false).
- Runs `node scripts/sync-fixtures.mjs` with `FOOTBALL_DATA_TOKEN` from secrets. `timeout-minutes: 5`.

## Safety / idempotency

- **Add-only**: inserts only fixtures whose team-pair isn't already in the DB. Never modifies
  existing matches, results, live nodes, or points.
- **Knockout only**: group games are skipped (`fdStageToOurs` returns null for GROUP_STAGE) — no
  risk of duplicating the seeded group fixtures.
- **Determined teams only**: TBD/placeholder slots (unresolved names) are skipped until football-data
  fills in the real teams (i.e. after the prior round finishes).
- **UTC times**: stores `utcDate` verbatim (sliced), matching the app + updater convention.
- Unknown football-data `stage` values are skipped and surface in logs, never guessed.

## Testing

`tests/results-core.test.mjs`:
- `fdStageToOurs`: LAST_16→R16, QUARTER_FINALS→QF, FINAL→Final, GROUP_STAGE→null, unknown→null.
- `resolveHebTeam` via `norm`/aliases: "Netherlands"→הולנד, "United States"→ארצות הברית,
  "DR Congo"/"Congo DR"→קונגו DR, "Bosnia and Herzegovina"→בוסניה והרצגובינה, "TBD"→null.
- `utcToNaive`: "2026-07-04T19:00:00Z"→"2026-07-04T19:00".
- `mapScheduledFixtures` with a mixed `fdMatches` list: a SCHEDULED LAST_16 with two known teams
  (added, correct key/date/stage/status), a TBD slot (skipped), a FINISHED match (skipped), a pair
  already in `existingMatches` (skipped), a GROUP_STAGE game (skipped), a past scheduled game
  (skipped), and one beyond `windowEndMs` (skipped).

`scripts/sync-fixtures.mjs`: `node --check` for syntax; validated end-to-end by a post-deploy
`workflow_dispatch` run + a DB check (this needs the CI token, so it's a manual verification step,
not a unit test).

## Out of scope

- Group-stage sync (already seeded).
- Changing how results/live/points are written (that stays in `update-results.mjs`).
- Backfilling/altering existing fixtures or fixing R32 key/time drift (harmless; dedup handles it).
- A UI change (none needed — new matches render through the existing match card).
