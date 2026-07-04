# Auto-Sync Scheduled Fixtures — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A twice-daily GitHub Action reads football-data.org's WC schedule and inserts new, determined knockout fixtures (R16 → Final) into the DB automatically.

**Architecture:** Pure mapping helpers in `results-core.mjs` (English→Hebrew teams, football-data stage → our stage, team-pair dedup, fixture key) turn football-data matches into new match rows; a thin `scripts/sync-fixtures.mjs` fetches + writes them; a workflow runs it on cron. Add-only, dedup by team-pair, knockout-only, UTC times.

**Tech Stack:** Node ESM + `node --test`; GitHub Actions; Firebase RTDB REST.

## Global Constraints

- Times stored **UTC-naive** ("2026-07-04T19:00") — store football-data `utcDate` sliced to 16 chars; never convert timezones.
- **Add-only, dedup by normalized team-pair** across all existing matches; never modify existing matches/results/live/points.
- **Knockout only**: `fdStageToOurs` returns null for GROUP_STAGE/unknown → skipped. Map: LAST_32→R32, LAST_16→R16, QUARTER_FINALS→QF, SEMI_FINALS→SF, THIRD_PLACE/THIRD_PLACE_FINAL→3rd, FINAL→Final.
- **Determined teams only**: skip fixtures whose team names don't resolve via `EN_TO_HEB`/`norm` (TBD slots).
- Only `status` ∈ {SCHEDULED, TIMED}; skip games >6h in the past or beyond the tournament window.
- New match row shape: `{team1, team2, date, stage, group:null, status:'upcoming', result:null}`.
- Firebase Web API key (public) `AIzaSyAyOY_It3oq3Q4ferO_zE23sFLJ_bUZB9g`; DB `https://mondial2026-a77fc-default-rtdb.firebaseio.com`; root `worldcup2026`. football-data via `FOOTBALL_DATA_TOKEN` secret. Tournament window end `2026-07-22T00:00:00Z`.
- Tests: bare `node --test tests/results-core.test.mjs`. New pure fns are `export function`/`export const`.

---

### Task 1: Pure fixture-mapping helpers in `results-core.mjs`

**Files:**
- Modify: `scripts/lib/results-core.mjs`
- Test: `tests/results-core.test.mjs`

**Interfaces:**
- Consumes existing `HEB_TO_EN`, `norm`.
- Produces: `EN_TO_HEB`, `resolveHebTeam`, `fdStageToOurs`, `utcToNaive`, `fixtureKey`, `mapScheduledFixtures`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/results-core.test.mjs` (add the new names to the import line from `../scripts/lib/results-core.mjs`):

```js
// --- scheduled-fixture sync ------------------------------------------------

test('fdStageToOurs maps knockout stages; group/unknown -> null', () => {
  assert.equal(fdStageToOurs('LAST_16'), 'R16');
  assert.equal(fdStageToOurs('QUARTER_FINALS'), 'QF');
  assert.equal(fdStageToOurs('SEMI_FINALS'), 'SF');
  assert.equal(fdStageToOurs('THIRD_PLACE'), '3rd');
  assert.equal(fdStageToOurs('FINAL'), 'Final');
  assert.equal(fdStageToOurs('GROUP_STAGE'), null);
  assert.equal(fdStageToOurs('WHATEVER'), null);
});

test('resolveHebTeam maps football-data English names (via norm/aliases) to Hebrew', () => {
  assert.equal(resolveHebTeam('Netherlands'), 'הולנד');
  assert.equal(resolveHebTeam('United States'), 'ארצות הברית');
  assert.equal(resolveHebTeam('DR Congo'), 'קונגו DR');
  assert.equal(resolveHebTeam('Congo DR'), 'קונגו DR');
  assert.equal(resolveHebTeam('Bosnia and Herzegovina'), 'בוסניה והרצגובינה');
  assert.equal(resolveHebTeam('TBD'), null);
  assert.equal(resolveHebTeam(null), null);
});

test('utcToNaive trims to minute-precision UTC-naive', () => {
  assert.equal(utcToNaive('2026-07-04T19:00:00Z'), '2026-07-04T19:00');
});

test('mapScheduledFixtures adds only new, determined knockout games', () => {
  const now = Date.parse('2026-07-04T00:00:00Z');
  const windowEndMs = Date.parse('2026-07-22T00:00:00Z');
  const existingMatches = {
    e1: { team1: 'צרפת', team2: 'שוודיה', date: '2026-06-30T21:00', stage: 'R32', result: { team1Goals: 3, team2Goals: 0 } },
  };
  const fdMatches = [
    // new R16 with known teams -> ADD
    { status: 'SCHEDULED', stage: 'LAST_16', utcDate: '2026-07-05T19:00:00Z',
      homeTeam: { name: 'Netherlands' }, awayTeam: { name: 'United States' } },
    // TBD slot -> skip
    { status: 'SCHEDULED', stage: 'LAST_16', utcDate: '2026-07-05T23:00:00Z',
      homeTeam: { name: 'Winner Match 78' }, awayTeam: { name: null } },
    // finished -> skip
    { status: 'FINISHED', stage: 'LAST_16', utcDate: '2026-07-04T19:00:00Z',
      homeTeam: { name: 'Brazil' }, awayTeam: { name: 'Morocco' } },
    // pair already in DB -> skip
    { status: 'SCHEDULED', stage: 'LAST_16', utcDate: '2026-07-06T19:00:00Z',
      homeTeam: { name: 'France' }, awayTeam: { name: 'Sweden' } },
    // group stage -> skip
    { status: 'SCHEDULED', stage: 'GROUP_STAGE', utcDate: '2026-07-05T19:00:00Z',
      homeTeam: { name: 'Spain' }, awayTeam: { name: 'Germany' } },
    // beyond window -> skip
    { status: 'SCHEDULED', stage: 'FINAL', utcDate: '2026-08-01T19:00:00Z',
      homeTeam: { name: 'Argentina' }, awayTeam: { name: 'Brazil' } },
  ];
  const out = mapScheduledFixtures({ fdMatches, existingMatches, now, windowEndMs });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].match, {
    team1: 'הולנד', team2: 'ארצות הברית', date: '2026-07-05T19:00', stage: 'R16',
    group: null, status: 'upcoming', result: null,
  });
  assert.equal(out[0].key, 'R16_-_2026-07-05T19:00_הולנד_vs_ארצות הברית');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/results-core.test.mjs`
Expected: FAIL — the new functions aren't exported.

- [ ] **Step 3: Implement the helpers**

Add to `scripts/lib/results-core.mjs` (after `norm`, so `HEB_TO_EN`/`norm` are defined):

```js
// English (football-data) -> Hebrew, keyed by norm() so API_ALIASES bridge spelling differences.
export const EN_TO_HEB = (() => {
    const m = {};
    for (const [he, en] of Object.entries(HEB_TO_EN)) m[norm(en)] = he;
    return m;
})();
export function resolveHebTeam(fdName) { return EN_TO_HEB[norm(fdName)] || null; }

const FD_STAGE = { LAST_32: 'R32', LAST_16: 'R16', QUARTER_FINALS: 'QF', SEMI_FINALS: 'SF',
                   THIRD_PLACE: '3rd', THIRD_PLACE_FINAL: '3rd', FINAL: 'Final' };
export function fdStageToOurs(fdStage) { return FD_STAGE[fdStage] || null; }

export function utcToNaive(utcDate) { return String(utcDate || '').slice(0, 16); }

// Mirrors app.js seedMatchKey (stage_group_date_t1_vs_t2, sanitized). group is '-' for knockout.
export function fixtureKey({ stage, team1, team2, date }) {
    return `${stage}_-_${date}_${team1}_vs_${team2}`.replace(/[.#$[\]/']/g, '_');
}

// Turn football-data matches into new knockout fixtures to insert. Add-only: dedups by
// normalized team-pair against existing matches (knockout pairings are unique), skips group/
// unknown stages, undetermined (unresolvable) teams, non-scheduled statuses, and out-of-window
// or long-past games.
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
        if (!fm || !SCHED.has(fm.status)) continue;
        const stage = fdStageToOurs(fm.stage);
        if (!stage) continue;
        const t1 = resolveHebTeam(fm.homeTeam && fm.homeTeam.name);
        const t2 = resolveHebTeam(fm.awayTeam && fm.awayTeam.name);
        if (!t1 || !t2) continue;
        const pk = pairKey(t1, t2);
        if (existingPairs.has(pk) || seen.has(pk)) continue;
        const date = utcToNaive(fm.utcDate);
        const ms = Date.parse(`${date}Z`);
        if (!date || Number.isNaN(ms)) continue;
        if (ms < now - 6 * 3600 * 1000) continue;
        if (windowEndMs && ms > windowEndMs) continue;
        seen.add(pk);
        out.push({
            key: fixtureKey({ stage, team1: t1, team2: t2, date }),
            match: { team1: t1, team2: t2, date, stage, group: null, status: 'upcoming', result: null },
        });
    }
    return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/results-core.test.mjs`
Expected: PASS (new tests + all pre-existing).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/results-core.mjs tests/results-core.test.mjs
git commit -m "feat: pure helpers to map football-data scheduled fixtures to match rows"
```

---

### Task 2: Sync script + GitHub Action

**Files:**
- Create: `scripts/sync-fixtures.mjs`
- Create: `.github/workflows/sync-fixtures.yml`

**Interfaces:** consumes Task 1's `mapScheduledFixtures`.

- [ ] **Step 1: Create `scripts/sync-fixtures.mjs`**

```js
// Twice-daily fixture sync: pull upcoming scheduled knockout games from football-data.org and
// insert any new, determined ones into Firebase. Add-only (dedup by team pair). Finals, live
// scores, and points are handled by scripts/update-results.mjs — this script only inserts
// scheduled match rows.
//
// Env:
//   FOOTBALL_DATA_TOKEN  (required) football-data.org API token.
import { mapScheduledFixtures } from './lib/results-core.mjs';

const FD_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
const FB_KEY   = 'AIzaSyAyOY_It3oq3Q4ferO_zE23sFLJ_bUZB9g'; // public Firebase web API key
const DB       = 'https://mondial2026-a77fc-default-rtdb.firebaseio.com';
const ROOT     = 'worldcup2026';
const WINDOW_END = Date.parse('2026-07-22T00:00:00Z');

async function signIn() {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' });
    if (!r.ok) throw new Error(`Firebase sign-in failed: HTTP ${r.status}`);
    return (await r.json()).idToken;
}
const utcDay = ms => new Date(ms).toISOString().slice(0, 10);

async function main() {
    if (!FD_TOKEN) throw new Error('FOOTBALL_DATA_TOKEN is not set');
    const now = Date.now();
    if (now > WINDOW_END) { console.log('Outside tournament window; nothing to do.'); return; }

    const token = await signIn();
    const url = `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${utcDay(now)}&dateTo=${utcDay(WINDOW_END)}`;
    const res = await fetch(url, { headers: { 'X-Auth-Token': FD_TOKEN } });
    if (!res.ok) { console.warn(`football-data request failed (HTTP ${res.status}); skipping this run.`); return; }
    const fdMatches = (await res.json()).matches || [];

    const existingMatches = (await (await fetch(`${DB}/${ROOT}/matches.json?auth=${token}`)).json()) || {};
    const toAdd = mapScheduledFixtures({ fdMatches, existingMatches, now, windowEndMs: WINDOW_END });

    if (toAdd.length === 0) {
        console.log(`No new fixtures to add (scanned ${fdMatches.length} football-data matches).`);
        return;
    }
    const updates = {};
    for (const { key, match } of toAdd) updates[`matches/${key}`] = match;
    const patch = await fetch(`${DB}/${ROOT}.json?auth=${token}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    if (!patch.ok) throw new Error(`Firebase PATCH failed: HTTP ${patch.status} ${await patch.text()}`);
    console.log(`Added ${toAdd.length} fixture(s):`);
    for (const { match } of toAdd) console.log(`  [${match.stage}] ${match.team1} vs ${match.team2} @ ${match.date}Z`);
}

main().catch(err => { console.error('sync-fixtures failed:', err.message); process.exit(1); });
```

- [ ] **Step 2: Create `.github/workflows/sync-fixtures.yml`**

```yaml
name: Sync scheduled fixtures

on:
  schedule:
    - cron: '0 6,18 * * *'   # twice a day (06:00 & 18:00 UTC)
  workflow_dispatch:

concurrency:
  group: sync-fixtures
  cancel-in-progress: false

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Insert newly-scheduled knockout fixtures
        run: node scripts/sync-fixtures.mjs
        env:
          FOOTBALL_DATA_TOKEN: ${{ secrets.FOOTBALL_DATA_TOKEN }}
```

- [ ] **Step 3: Syntax + no-regression check**

Run:
```bash
node --check scripts/sync-fixtures.mjs && echo "syntax OK"
node --test tests/results-core.test.mjs 2>&1 | tail -4
```
Expected: `syntax OK`; all results-core tests pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-fixtures.mjs .github/workflows/sync-fixtures.yml
git commit -m "feat: twice-daily GitHub Action to auto-add scheduled knockout fixtures"
```

- [ ] **Step 5: Post-merge verification (manual — needs the CI token)**

After merge/deploy, trigger the workflow once and confirm it inserts the upcoming round:
```bash
gh workflow run "Sync scheduled fixtures"
# wait for it to finish, then check the run log shows "Added N fixture(s)"
gh run list --workflow="Sync scheduled fixtures" --limit 1
```
Then confirm the new fixtures appear in the DB (e.g. R16 games with correct teams/dates). This step
validates the football-data fetch + PATCH glue, which can't be unit-tested locally (no token).

---

## Notes for the implementer

- Do NOT reuse or modify `update-results.mjs`; this is a separate, additive script.
- The sync must never write `result`, `live`, `points`, or touch group games — only insert scheduled knockout match rows.
- Dedup is by team-pair, not key, on purpose (older R32 keys embed a pre-UTC-fix time string, so key comparison would false-negative).
- `mapScheduledFixtures` is pure and fully unit-tested; the script glue is intentionally thin.
