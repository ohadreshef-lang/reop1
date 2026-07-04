# Updater Correctness (Own Goals, Cancelled Goals, VAR Finals) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three updater bugs around goals/results being taken away: own-goal mis-attribution, a live scorer that sticks when the score returns to 0–0, and a finalized result that never updates after a VAR correction.

**Architecture:** Pure-logic fixes in `scripts/lib/results-core.mjs` (own-goal attribution + re-finalization in `classifyMatches`) and I/O-wiring fixes in `scripts/update-results.mjs` (clear scorers at 0 total; don't early-return when a recently-finished match needs re-checking; pass the re-finalize window).

**Tech Stack:** Vanilla ES modules (`scripts/lib/*.mjs`, Node `node --test`). Backend only — no browser assets change, so no `index.html` version bump.

## Global Constraints

- **Fix A:** own-goal events from API-Football already name the **benefiting** team; `parseGoalEvents` must NOT flip own goals. `kind: 'og'` stays as a display-only label.
- **Fix C:** in the updater scorer loop, when the live goal total is `0`, scorers become `[]` (cleared); reuse only when total is unchanged AND the stored list is already complete.
- **Fix B:** `classifyMatches` re-finalizes a match that already has a result only if `m.finishedAt` is within `refinalizeWindowMs` (default `6 * 3600 * 1000`) AND football-data's FINISHED score differs from the stored result. `buildResultUpdates` (unchanged) does the overwrite + points recalc. The updater must not early-return when such re-checkable matches exist, and must pass `refinalizeWindowMs`.
- Re-checkable/finished matches must NOT be added to `live` or `staleUnmatched`.
- Tests run with bare `node --test tests/<file>` (NOT `node --test tests/`).
- No `index.html` change (these are Node updater scripts, not browser-served).

---

### Task 1: `results-core.mjs` — own-goal attribution + re-finalization

**Files:**
- Modify: `scripts/lib/results-core.mjs` (`parseGoalEvents` ~line 147-151; `classifyMatches` ~line 152-189)
- Test: `tests/results-core.test.mjs`

**Interfaces:**
- Consumes: existing `findApiFixture`, `parseMatchDate`, `normAf` (module-local).
- Produces:
  - `parseGoalEvents(apiEvents, { homeName, homeIsT1 })` — own goals keep the event's (benefiting) team; no flip.
  - `classifyMatches({ matches, apiMatches, now, staleMinutes?, inPlayWindowMs?, refinalizeWindowMs = 6*3600*1000 })` — also returns, in `finished`, recently-finished matches whose football-data score changed.

- [ ] **Step 1: Update the own-goal test + add re-finalization tests**

In `tests/results-core.test.mjs`, replace the test `'parseGoalEvents: own goal counts for the opposing team, kind og'` (the one using `goalEv('Own Goal', 'Sweden', 'Lindelof', 80)`) with:

```js
test('parseGoalEvents: own goal credited to the benefiting team named by the API, kind og', () => {
  // API-Football names the BENEFITING team on an own-goal event (player = own-goaler).
  // Netherlands (home, team1) benefits from Lindelof's own goal.
  const out = parseGoalEvents([goalEv('Own Goal', 'Netherlands', 'Lindelof', 80)],
    { homeName: 'Netherlands', homeIsT1: true });
  assert.deepEqual(out, [{ team: 1, player: 'Lindelof', minute: 80, extra: null, kind: 'og' }]);
});
```

Then append these three re-finalization tests (they reuse the England/Croatia ↔ אנגליה/קרואטיה mapping already exercised by the existing finished-fixture test):

```js
const fdFinished = (h, a) => ([{ id: 1, status: 'FINISHED', utcDate: '2026-06-17T20:00:00Z',
  homeTeam: { name: 'England' }, awayTeam: { name: 'Croatia' },
  score: { duration: 'REGULAR', fullTime: { home: h, away: a } } }]);

test('classifyMatches: re-finalizes a recently-finished match whose score changed', () => {
  const matches = { m_fin: { team1: 'אנגליה', team2: 'קרואטיה', date: '2026-06-17T20:00',
    result: { team1Goals: 5, team2Goals: 2 }, finishedAt: Date.parse('2026-06-17T22:00:00Z') } };
  const now = Date.parse('2026-06-17T22:30:00Z'); // 30 min after finishedAt, within window
  const { finished } = classifyMatches({ matches, apiMatches: fdFinished(4, 2), now, refinalizeWindowMs: 6 * 3600 * 1000 });
  assert.equal(finished.length, 1);
  assert.equal(finished[0].matchId, 'm_fin');
  assert.equal(finished[0].g1, 4);
  assert.equal(finished[0].g2, 2);
});

test('classifyMatches: does NOT re-finalize when the score is unchanged', () => {
  const matches = { m_fin: { team1: 'אנגליה', team2: 'קרואטיה', date: '2026-06-17T20:00',
    result: { team1Goals: 4, team2Goals: 2 }, finishedAt: Date.parse('2026-06-17T22:00:00Z') } };
  const now = Date.parse('2026-06-17T22:30:00Z');
  const { finished } = classifyMatches({ matches, apiMatches: fdFinished(4, 2), now, refinalizeWindowMs: 6 * 3600 * 1000 });
  assert.equal(finished.length, 0);
});

test('classifyMatches: does NOT re-finalize past the window', () => {
  const matches = { m_fin: { team1: 'אנגליה', team2: 'קרואטיה', date: '2026-06-17T20:00',
    result: { team1Goals: 5, team2Goals: 2 }, finishedAt: Date.parse('2026-06-17T12:00:00Z') } };
  const now = Date.parse('2026-06-17T22:30:00Z'); // 10.5h after finishedAt, outside 6h window
  const { finished } = classifyMatches({ matches, apiMatches: fdFinished(4, 2), now, refinalizeWindowMs: 6 * 3600 * 1000 });
  assert.equal(finished.length, 0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/results-core.test.mjs`
Expected: FAIL — the own-goal test now expects no-flip (current code flips → team 2 ≠ 1), and `classifyMatches` ignores matches that already have a result (the re-finalize test finds 0).

- [ ] **Step 3: Remove the own-goal flip in `parseGoalEvents`**

In `scripts/lib/results-core.mjs`, find:

```js
        const kind = detail === 'Penalty' ? 'pen' : detail === 'Own Goal' ? 'og' : 'goal';
        const eventIsHome = normAf(e.team && e.team.name) === normAf(homeName);
        let team = eventIsHome ? (homeIsT1 ? 1 : 2) : (homeIsT1 ? 2 : 1);
        if (kind === 'og') team = team === 1 ? 2 : 1; // own goal counts for the opponent
        out.push({ team, player, minute, extra, kind });
```

Replace with (delete the flip line; `team` is now `const`):

```js
        const kind = detail === 'Penalty' ? 'pen' : detail === 'Own Goal' ? 'og' : 'goal';
        // API-Football already names the BENEFITING team on the event (including own
        // goals, where `player` is the own-goaler) — so no flip is needed for any kind.
        const eventIsHome = normAf(e.team && e.team.name) === normAf(homeName);
        const team = eventIsHome ? (homeIsT1 ? 1 : 2) : (homeIsT1 ? 2 : 1);
        out.push({ team, player, minute, extra, kind });
```

- [ ] **Step 4: Add re-finalization to `classifyMatches`**

In `scripts/lib/results-core.mjs`, change the signature line:

```js
export function classifyMatches({ matches, apiMatches, now, staleMinutes = 180, inPlayWindowMs = 3 * 3600 * 1000 }) {
```

to:

```js
export function classifyMatches({ matches, apiMatches, now, staleMinutes = 180, inPlayWindowMs = 3 * 3600 * 1000, refinalizeWindowMs = 6 * 3600 * 1000 }) {
```

Then replace the loop body. Find:

```js
        const hasResult = m.result && m.result.team1Goals !== undefined;
        if (hasResult) continue;
        const kickoff = parseMatchDate(m.date);
        if (kickoff > now) continue;                       // not started -> nothing to fetch
        const minsSince = (now - kickoff) / 60000;
        const isStale = minsSince >= staleMinutes;

        const found = findApiFixture(m, apiMatches);
        if (found.error) {
            if (isStale) staleUnmatched.push(`${matchId} — "${found.en1 || m.team1}" vs "${found.en2 || m.team2}", ${found.error}`);
            continue;
        }
        const am = found.am;
        const ft = am.score && am.score.fullTime;
        const g1 = found.t1IsHome ? (ft && ft.home) : (ft && ft.away);
        const g2 = found.t1IsHome ? (ft && ft.away) : (ft && ft.home);

        if (am.status === 'FINISHED' && ft && ft.home !== null && ft.away !== null) {
            finished.push({ matchId, m, g1, g2 });
        } else if ((am.status === 'IN_PLAY' || am.status === 'PAUSED') && ft && ft.home !== null && ft.away !== null
                   && (now - kickoff) <= inPlayWindowMs) {
            live.push({ matchId, m, g1, g2, status: am.status });
        } else if (isStale) {
            staleUnmatched.push(`${matchId} — "${found.en1}" vs "${found.en2}", status=${am.status}, no usable score`);
        }
```

Replace with:

```js
        const hasResult = m.result && m.result.team1Goals !== undefined;
        // A finalized match is normally done. Re-examine it only briefly after finishing
        // so a VAR correction to the final score can still be applied.
        const withinRefinalize = hasResult && m.finishedAt != null && (now - m.finishedAt) <= refinalizeWindowMs;
        if (hasResult && !withinRefinalize) continue;
        const kickoff = parseMatchDate(m.date);
        if (kickoff > now) continue;                       // not started -> nothing to fetch
        const minsSince = (now - kickoff) / 60000;
        const isStale = minsSince >= staleMinutes;

        const found = findApiFixture(m, apiMatches);
        if (found.error) {
            if (isStale && !hasResult) staleUnmatched.push(`${matchId} — "${found.en1 || m.team1}" vs "${found.en2 || m.team2}", ${found.error}`);
            continue;
        }
        const am = found.am;
        const ft = am.score && am.score.fullTime;
        const g1 = found.t1IsHome ? (ft && ft.home) : (ft && ft.away);
        const g2 = found.t1IsHome ? (ft && ft.away) : (ft && ft.home);

        if (am.status === 'FINISHED' && ft && ft.home !== null && ft.away !== null) {
            if (hasResult) {
                // Re-finalize only if the authoritative score actually changed.
                if (g1 !== m.result.team1Goals || g2 !== m.result.team2Goals) {
                    finished.push({ matchId, m, g1, g2 });
                }
            } else {
                finished.push({ matchId, m, g1, g2 });
            }
        } else if (!hasResult && (am.status === 'IN_PLAY' || am.status === 'PAUSED') && ft && ft.home !== null && ft.away !== null
                   && (now - kickoff) <= inPlayWindowMs) {
            live.push({ matchId, m, g1, g2, status: am.status });
        } else if (isStale && !hasResult) {
            staleUnmatched.push(`${matchId} — "${found.en1}" vs "${found.en2}", status=${am.status}, no usable score`);
        }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/results-core.test.mjs`
Expected: PASS (existing tests + the updated own-goal test + the 3 new re-finalize tests).

- [ ] **Step 6: Run the other suites (no regressions)**

Run: `node --test tests/results-core.test.mjs tests/paul-core.test.mjs tests/pure-logic.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/results-core.mjs tests/results-core.test.mjs
git commit -m "fix: own-goal attribution (no flip) + re-finalize VAR-corrected results"
```

---

### Task 2: `update-results.mjs` — clear scorers at 0, wire re-finalization

**Files:**
- Modify: `scripts/update-results.mjs` (consts near line 44; main-flow early-return ~line 188-202; classifyMatches call ~line 211; scorer-enrichment loop ~line 230-236)

**Interfaces:**
- Consumes: `classifyMatches({ …, refinalizeWindowMs })` (Task 1).
- Produces: nothing for later tasks (final task).

- [ ] **Step 1: Add the re-finalize window constant**

In `scripts/update-results.mjs`, just after the line `const IDLE_LOOKAHEAD_MS = 120 * 60 * 1000;` (~line 44), add:

```js
const REFINALIZE_WINDOW_MS = 6 * 60 * 60 * 1000; // re-check a finished match this long for VAR score corrections
```

- [ ] **Step 2: Fix C — clear scorers when the live total is 0**

In the scorer-enrichment loop, find:

```js
            // No new goal and the stored list is already complete -> reuse, no call.
            if (newTotal === 0 || (newTotal === prevTotal && prevScorers.length === newTotal)) {
                entry.scorers = prevScorers;
                continue;
            }
```

Replace with:

```js
            // Score back to 0 (e.g. a goal was cancelled) -> clear the list.
            if (newTotal === 0) { entry.scorers = []; continue; }
            // No change and the stored list is already complete -> reuse, no call.
            if (newTotal === prevTotal && prevScorers.length === newTotal) {
                entry.scorers = prevScorers;
                continue;
            }
```

- [ ] **Step 3: Fix B wiring — don't early-return when a re-check is pending**

In `main()`, find:

```js
    if (candidates.length === 0) {
        // Nothing live. Tell the polling loop whether to keep going: stay alive if a
        // match kicks off within IDLE_LOOKAHEAD_MS, otherwise emit LOOP_IDLE so the
        // workflow can end this run early (the cron re-triggers before the next game).
        const soon = Object.values(matches).some(m =>
            m && m.date && !(m.result && m.result.team1Goals !== undefined)
            && parseMatchDate(m.date) > now && (parseMatchDate(m.date) - now) <= IDLE_LOOKAHEAD_MS);
        console.log(`No started, unfinished matches. Nothing to do.${soon ? ' (a match starts soon — keep polling)' : ' LOOP_IDLE'}`);
        return;
    }
```

Replace with:

```js
    // Recently-finished matches are re-checked so a VAR correction to the final score
    // can be applied (classifyMatches with refinalizeWindowMs).
    const recheckable = Object.values(matches).filter(m =>
        m && m.result && m.result.team1Goals !== undefined
        && m.finishedAt != null && (now - m.finishedAt) <= REFINALIZE_WINDOW_MS);
    if (candidates.length === 0 && recheckable.length === 0) {
        // Nothing live. Tell the polling loop whether to keep going: stay alive if a
        // match kicks off within IDLE_LOOKAHEAD_MS, otherwise emit LOOP_IDLE so the
        // workflow can end this run early (the cron re-triggers before the next game).
        const soon = Object.values(matches).some(m =>
            m && m.date && !(m.result && m.result.team1Goals !== undefined)
            && parseMatchDate(m.date) > now && (parseMatchDate(m.date) - now) <= IDLE_LOOKAHEAD_MS);
        console.log(`No started, unfinished matches and nothing to re-check.${soon ? ' (a match starts soon — keep polling)' : ' LOOP_IDLE'}`);
        return;
    }
```

- [ ] **Step 4: Fix B wiring — pass the window to `classifyMatches`**

Find:

```js
    const { finished, staleUnmatched } = classifyMatches({
        matches, apiMatches, now, staleMinutes: STALE_MINUTES, inPlayWindowMs: 3 * 3600 * 1000,
    });
```

Replace with:

```js
    const { finished, staleUnmatched } = classifyMatches({
        matches, apiMatches, now, staleMinutes: STALE_MINUTES, inPlayWindowMs: 3 * 3600 * 1000,
        refinalizeWindowMs: REFINALIZE_WINDOW_MS,
    });
```

- [ ] **Step 5: Syntax-check both modules**

Run: `node --check scripts/lib/results-core.mjs && node --check scripts/update-results.mjs`
Expected: no output, exit 0.

- [ ] **Step 6: Run the unit suites (no regressions)**

Run: `node --test tests/results-core.test.mjs tests/paul-core.test.mjs tests/pure-logic.test.js`
Expected: PASS.

> Note: the updater is an I/O wrapper that needs the CI-only `FOOTBALL_DATA_TOKEN` / `FOOTBALL_API_KEY` secrets, so it can't run end-to-end locally. The re-finalize core logic is covered by Task 1's `classifyMatches` tests; this task is thin wiring (constant, early-return condition, one call arg, and the 2-line Fix C), verified by `node --check` + the unit suites.

- [ ] **Step 7: Commit**

```bash
git add scripts/update-results.mjs
git commit -m "fix: clear live scorers at 0 total; re-check recently-finished matches for VAR corrections"
```

---

## Notes for the implementer

- No `index.html` version bump — these are Node updater scripts, not browser-served assets.
- Keep every API call best-effort (the existing helpers already return `[]` on failure); this plan doesn't add API calls — re-finalization reuses the football-data fixtures already fetched.
- The DB requires auth and the updater secrets are CI-only; you cannot run `update-results.mjs` end-to-end locally. Rely on the unit tests + `node --check`.
- After merge + deploy, a fresh updater run (the current looping job is pre-merge — cancel + redispatch, as in prior deploys) will use the new code; re-finalization then auto-corrects any future VAR-changed result within the 6h window.
