# Knockout-Stage Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Score knockout games (R32→Final) as exact=5 / +2 for 5+ total goals / direction=2 on the 90-minute result, while group stays 4/1/0 — applied forward-only.

**Architecture:** Two mirrored scoring implementations both become stage-aware (`app.js` for the browser, `scripts/lib/results-core.mjs` for the Node updater). The updater additionally sources finished knockout scores from football-data.org's `score.regularTime` (the 90' score) instead of `score.fullTime`. The user-facing rules screen gains a knockout section in all three languages.

**Tech Stack:** Vanilla classic-script browser JS (`app.js`, `i18n.js`), Node ESM module + `node --test` (`scripts/lib/results-core.mjs`, `tests/*.mjs`), VM-sandbox tests (`tests/pure-logic.test.js`).

## Global Constraints

- Knockout = any stage that is **not** `group` and **not** `special`. Helper:
  `function isKnockoutStage(stage){ return stage != null && stage !== 'group' && stage !== 'special'; }`
- Scoring (both files, identical):
  ```js
  function calcPoints(b1, b2, r1, r2, stage) {
      const ko = isKnockoutStage(stage);
      if (b1 === r1 && b2 === r2) { if (ko) return (r1 + r2) >= 5 ? 7 : 5; return 4; }
      if (getOutcome(b1, b2) === getOutcome(r1, r2)) return ko ? 2 : 1;
      return 0;
  }
  ```
- Group stage unchanged: exact=4, direction=1, miss=0.
- `stage` is a trailing parameter; omitted/unknown → group scoring (backward compatible).
- High-score bonus keys off the actual result total `r1 + r2 >= 5`.
- Knockout finished score comes from `score.regularTime` (90'), falling back to `score.fullTime`.
- Forward-only: no bulk recompute; group untouched; do not touch already-stored points.
- In `app.js` and `tests/pure-logic.test.js`, `calcPoints`/`isKnockoutStage`/`getOutcome` must be top-level `function` declarations (the VM sandbox exposes only those as `app.<name>`).
- Tests run with bare `node --test tests/<file>` (NOT `node --test tests/`).
- Cache-busting: bump every `?v=20260626a` in `index.html` to `20260628a`.
- Do NOT touch the dead `leaderboard.scoringExact`/`leaderboard.scoringWinner` keys, group scoring, special bets, or the existing lock-time wording in `rules.html`.

---

### Task 1: Stage-aware scoring + 90' source in the updater (`results-core.mjs`)

**Files:**
- Modify: `scripts/lib/results-core.mjs` (`getOutcome` `:48`, `calcPoints` `:52`, score source `:204`, `buildResultUpdates` calls `:256`/`:260`)
- Test: `tests/results-core.test.mjs`

**Interfaces:**
- Produces: `calcPoints(b1, b2, r1, r2, stage) -> number`, `isKnockoutStage(stage) -> boolean` (exported). `classifyMatches` now finalizes on the 90' score.

- [ ] **Step 1: Write the failing tests**

In `tests/results-core.test.mjs`, update the import line (add `isKnockoutStage`):

```js
import { classifyMatches, buildResultUpdates, mapApiFootballLive, parseMatchDate, calcPoints, isKnockoutStage } from '../scripts/lib/results-core.mjs';
```

Replace the existing `calcPoints` test (the `test('calcPoints: exact score = 4, correct outcome = 1, miss = 0', ...)` block) with:

```js
test('calcPoints (group): exact=4, direction=1, miss=0', () => {
  assert.equal(calcPoints(2, 1, 2, 1, 'group'), 4);
  assert.equal(calcPoints(2, 1, 3, 0, 'group'), 1);
  assert.equal(calcPoints(2, 1, 1, 2, 'group'), 0);
  assert.equal(calcPoints(2, 1, 2, 1), 4); // missing stage -> group scoring
});

test('calcPoints (knockout): exact=5, exact w/ 5+ goals=7, direction=2, miss=0', () => {
  assert.equal(calcPoints(2, 1, 2, 1, 'R32'), 5);   // exact, 3 goals
  assert.equal(calcPoints(0, 0, 0, 0, 'Final'), 5); // exact, 0 goals
  assert.equal(calcPoints(3, 2, 3, 2, 'QF'), 7);    // exact, 5 goals -> +2
  assert.equal(calcPoints(5, 0, 5, 0, 'R16'), 7);   // exact, 5 goals -> +2
  assert.equal(calcPoints(2, 1, 3, 0, 'SF'), 2);    // direction only
  assert.equal(calcPoints(2, 1, 1, 2, '3rd'), 0);   // wrong
});

test('isKnockoutStage: group/special -> false, knockout stages -> true', () => {
  assert.equal(isKnockoutStage('group'), false);
  assert.equal(isKnockoutStage('special'), false);
  assert.equal(isKnockoutStage(undefined), false);
  assert.equal(isKnockoutStage('R32'), true);
  assert.equal(isKnockoutStage('Final'), true);
});

test('classifyMatches: finalizes a knockout extra-time game on regularTime (90 min), not fullTime', () => {
  const now = Date.parse('2026-07-01T22:00:00Z');
  const matches = { ko: { team1: 'A', team2: 'B', date: '2026-07-01T19:00', stage: 'R32' } };
  const apiMatches = [{
    homeTeam: { name: 'A' }, awayTeam: { name: 'B' }, status: 'FINISHED',
    utcDate: '2026-07-01T16:00:00Z',
    score: { duration: 'EXTRA_TIME', fullTime: { home: 2, away: 1 }, regularTime: { home: 1, away: 1 } },
  }];
  const { finished } = classifyMatches({ matches, apiMatches, now, staleMinutes: 180, inPlayWindowMs: 9000000 });
  assert.equal(finished.length, 1);
  assert.equal(finished[0].g1, 1);  // 90' score, not 2
  assert.equal(finished[0].g2, 1);
});
```

> Note: the existing finished-fixture test (`score: { duration: 'REGULAR', fullTime: { home: 4, away: 2 } }` with no `regularTime`) must still pass via the `fullTime` fallback — do not change it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/results-core.test.mjs`
Expected: FAIL — `isKnockoutStage` is not exported; knockout calcPoints values wrong; regularTime test sees `g1=2`.

- [ ] **Step 3: Make scoring stage-aware**

In `scripts/lib/results-core.mjs`, replace:

```js
export function calcPoints(b1, b2, r1, r2) {
    if (b1 === r1 && b2 === r2) return 4;
    if (getOutcome(b1, b2) === getOutcome(r1, r2)) return 1;
    return 0;
}
```

with:

```js
// Knockout = any stage that isn't the group stage or the special (champion/top-scorer) bets.
export function isKnockoutStage(stage) {
    return stage != null && stage !== 'group' && stage !== 'special';
}

// Group: exact=4, direction=1, miss=0. Knockout (R32+): exact=5 (+2 if 5+ total goals), direction=2.
// Knockout games are scored on the 90-minute result (see classifyMatches regularTime sourcing).
export function calcPoints(b1, b2, r1, r2, stage) {
    const ko = isKnockoutStage(stage);
    if (b1 === r1 && b2 === r2) { if (ko) return (r1 + r2) >= 5 ? 7 : 5; return 4; }
    if (getOutcome(b1, b2) === getOutcome(r1, r2)) return ko ? 2 : 1;
    return 0;
}
```

- [ ] **Step 4: Source the finished score from the 90-minute result**

In `classifyMatches`, replace:

```js
        const am = found.am;
        const ft = am.score && am.score.fullTime;
        const g1 = found.t1IsHome ? (ft && ft.home) : (ft && ft.away);
        const g2 = found.t1IsHome ? (ft && ft.away) : (ft && ft.home);

        if (am.status === 'FINISHED' && ft && ft.home !== null && ft.away !== null) {
```

with:

```js
        const am = found.am;
        // Score the 90-minute (regulation) result. football-data.org exposes score.regularTime
        // (goals after 90') separately from extra time / penalties; for normal-time games it may
        // be absent, so fall back to fullTime (which equals the 90' score when there was no ET).
        const ft = (am.score && am.score.regularTime && am.score.regularTime.home != null)
            ? am.score.regularTime
            : (am.score && am.score.fullTime);
        const g1 = found.t1IsHome ? (ft && ft.home) : (ft && ft.away);
        const g2 = found.t1IsHome ? (ft && ft.away) : (ft && ft.home);

        if (am.status === 'FINISHED' && ft && ft.home !== null && ft.away !== null) {
```

> The downstream `else if (!hasResult && (am.status === 'IN_PLAY' ...) && ft && ft.home !== null ...)` branch keeps using the same `ft` variable — no further change needed.

- [ ] **Step 5: Pass stage to calcPoints in buildResultUpdates**

The points loop is `for (const { matchId, g1, g2 } of scored)` (where `scored = finished.filter(f => !f.m.noPoints)`, so every entry has `.m`). Add `m` to the destructuring:

```js
                for (const { matchId, g1, g2 } of scored) {
```
→
```js
                for (const { matchId, g1, g2, m } of scored) {
```

Then replace the two `calcPoints` calls in that loop:

```js
                        const filled = { team1Goals: 0, team2Goals: 0, placedAt: 0, points: calcPoints(0, 0, g1, g2) };
```
→
```js
                        const filled = { team1Goals: 0, team2Goals: 0, placedAt: 0, points: calcPoints(0, 0, g1, g2, m.stage) };
```

and

```js
                        bet.points = calcPoints(bet.team1Goals, bet.team2Goals, g1, g2);
```
→
```js
                        bet.points = calcPoints(bet.team1Goals, bet.team2Goals, g1, g2, m.stage);
```

> `scored` entries come from `finished` (`{ matchId, m, g1, g2 }`), and `.m` is guaranteed (the filter dereferences `f.m.noPoints`), so `m.stage` is safe.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test tests/results-core.test.mjs`
Expected: PASS (all existing + new). If the `buildResultUpdates` exact-points test (`assert.equal(updates['bets/g1/u1/m_fin/points'], 4)`) uses a group-stage fixture, it stays 4; confirm it still passes.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/results-core.mjs tests/results-core.test.mjs
git commit -m "feat(updater): knockout-stage scoring on the 90-minute result"
```

---

### Task 2: Stage-aware scoring in the browser app (`app.js`)

**Files:**
- Modify: `app.js` (`calcPoints` `:195`, call sites `:1214`, `:1345`, `:1406`, `recalcPoints` `:2063`/`:2076`/`:2080`)
- Test: `tests/pure-logic.test.js`

**Interfaces:**
- Consumes: nothing from Task 1 (mirrored, independent file).
- Produces: `app.calcPoints(b1,b2,r1,r2,stage)`, `app.isKnockoutStage(stage)`.

- [ ] **Step 1: Write the failing tests**

In `tests/pure-logic.test.js`, replace the three existing `calcPoints` tests (the block under `// --- calcPoints ---`, the `returns 4` / `returns 1` / `returns 0` tests) with:

```js
test('calcPoints (group): exact=4', () => {
    assert.equal(app.calcPoints(2, 1, 2, 1, 'group'), 4);
    assert.equal(app.calcPoints(0, 0, 0, 0, 'group'), 4);
    assert.equal(app.calcPoints(2, 1, 2, 1), 4);          // missing stage -> group
});

test('calcPoints (group): correct direction but wrong score = 1', () => {
    assert.equal(app.calcPoints(2, 1, 3, 0, 'group'), 1);
    assert.equal(app.calcPoints(0, 2, 1, 4, 'group'), 1);
    assert.equal(app.calcPoints(1, 1, 2, 2, 'group'), 1);
});

test('calcPoints (group): wrong = 0', () => {
    assert.equal(app.calcPoints(2, 1, 1, 2, 'group'), 0);
    assert.equal(app.calcPoints(0, 0, 1, 0, 'group'), 0);
});

test('calcPoints (knockout): exact=5, exact 5+ goals=7, direction=2, miss=0', () => {
    assert.equal(app.calcPoints(2, 1, 2, 1, 'R32'), 5);
    assert.equal(app.calcPoints(0, 0, 0, 0, 'Final'), 5);
    assert.equal(app.calcPoints(3, 2, 3, 2, 'QF'), 7);
    assert.equal(app.calcPoints(4, 1, 4, 1, 'R16'), 7);
    assert.equal(app.calcPoints(2, 1, 3, 0, 'SF'), 2);
    assert.equal(app.calcPoints(2, 1, 1, 2, '3rd'), 0);
});

test('isKnockoutStage: group/special/undefined=false, knockout=true', () => {
    assert.equal(app.isKnockoutStage('group'), false);
    assert.equal(app.isKnockoutStage('special'), false);
    assert.equal(app.isKnockoutStage(undefined), false);
    assert.equal(app.isKnockoutStage('R32'), true);
    assert.equal(app.isKnockoutStage('Final'), true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/pure-logic.test.js`
Expected: FAIL — `app.isKnockoutStage` undefined; knockout values wrong.

- [ ] **Step 3: Make scoring stage-aware**

In `app.js`, replace:

```js
function calcPoints(betGoals1, betGoals2, resGoals1, resGoals2) {
    if (betGoals1 === resGoals1 && betGoals2 === resGoals2) return 4;
    if (getOutcome(betGoals1, betGoals2) === getOutcome(resGoals1, resGoals2)) return 1;
    return 0;
}
```

with:

```js
// Knockout = any stage that isn't the group stage or the special (champion/top-scorer) bets.
function isKnockoutStage(stage) {
    return stage != null && stage !== 'group' && stage !== 'special';
}

// Group: exact=4, direction=1, miss=0. Knockout (R32+): exact=5 (+2 if 5+ total goals), direction=2.
// Knockout results are entered as the 90-minute score (see the updater's regularTime sourcing).
function calcPoints(betGoals1, betGoals2, resGoals1, resGoals2, stage) {
    const ko = isKnockoutStage(stage);
    if (betGoals1 === resGoals1 && betGoals2 === resGoals2) {
        if (ko) return (resGoals1 + resGoals2) >= 5 ? 7 : 5;
        return 4;
    }
    if (getOutcome(betGoals1, betGoals2) === getOutcome(resGoals1, resGoals2)) return ko ? 2 : 1;
    return 0;
}
```

- [ ] **Step 4: Pass stage at the three render call sites**

At `app.js:1214`, change:
```js
            const pts = b ? calcPoints(b.team1Goals, b.team2Goals, m.result.team1Goals, m.result.team2Goals) : 0;
```
→ add `, m.stage`:
```js
            const pts = b ? calcPoints(b.team1Goals, b.team2Goals, m.result.team1Goals, m.result.team2Goals, m.stage) : 0;
```

At `app.js:1345`, change:
```js
            const provisional = calcPoints(b ? b.team1Goals : 0, b ? b.team2Goals : 0, s.team1Goals, s.team2Goals);
```
→ add `, g.stage`:
```js
            const provisional = calcPoints(b ? b.team1Goals : 0, b ? b.team2Goals : 0, s.team1Goals, s.team2Goals, g.stage);
```

At `app.js:1406` (`matchOf`), change:
```js
    const matchOf = uid => { if (!score) return 0; const b = (allGroupBets[uid] || {})[m.id]; return calcPoints(b ? b.team1Goals : 0, b ? b.team2Goals : 0, score.team1Goals, score.team2Goals); };
```
→ add `, m.stage`:
```js
    const matchOf = uid => { if (!score) return 0; const b = (allGroupBets[uid] || {})[m.id]; return calcPoints(b ? b.team1Goals : 0, b ? b.team2Goals : 0, score.team1Goals, score.team2Goals, m.stage); };
```

- [ ] **Step 5: Pass stage inside recalcPoints**

In `recalcPoints` (`app.js:2063`), add a stage lookup at the top of the function body (right after `if (!db) return;`):

```js
    const stage = (matches[matchId] || {}).stage;
```

Then change the two calls:
```js
                const pts = calcPoints(0, 0, resG1, resG2);
```
→
```js
                const pts = calcPoints(0, 0, resG1, resG2, stage);
```
and
```js
                const pts = calcPoints(bet.team1Goals, bet.team2Goals, resG1, resG2);
```
→
```js
                const pts = calcPoints(bet.team1Goals, bet.team2Goals, resG1, resG2, stage);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test tests/pure-logic.test.js`
Expected: PASS (all existing + new).

- [ ] **Step 7: Commit**

```bash
git add app.js tests/pure-logic.test.js
git commit -m "feat: knockout-stage scoring in the app (exact 5 / +2 / direction 2)"
```

---

### Task 3: Rules screen (he/en/es) + cache bump

**Files:**
- Modify: `i18n.js` (`rules.html` he `:31`, en `:334`, es `:621`)
- Modify: `index.html` (cache-bust)

**Interfaces:** none (copy + version only).

- [ ] **Step 1: Hebrew rules — split scoring into group + knockout**

In `i18n.js` (Hebrew block), replace:

```html
            <h4>🏆 מערכת הניקוד</h4>
            <ul>
                <li><span class="rule-points">4 נק'</span> תוצאה מדויקת (גם התוצאה הסופית וגם מספר השערים של כל קבוצה נכונים)</li>
                <li><span class="rule-points">1 נק'</span> רק הקבוצה המנצחת (או תיקו) נכונה – התוצאה שגויה</li>
                <li><span class="rule-points">0 נק'</span> ניחוש שגוי או ללא ניחוש</li>
            </ul>
```

with:

```html
            <h4>🏆 מערכת הניקוד</h4>
            <p><b>שלב הבתים</b></p>
            <ul>
                <li><span class="rule-points">4 נק'</span> תוצאה מדויקת (גם המנצח וגם מספר השערים של כל קבוצה נכונים)</li>
                <li><span class="rule-points">1 נק'</span> רק כיוון התוצאה נכון (ניצחון או תיקו) – התוצאה שגויה</li>
                <li><span class="rule-points">0 נק'</span> ניחוש שגוי או ללא ניחוש</li>
            </ul>
            <p><b>שלב הנוקאאוט (משלב 32 ואילך)</b> — הניקוד נקבע לפי התוצאה בתום <b>90 הדקות</b> (כולל זמן פציעות; ללא הארכה ופנדלים):</p>
            <ul>
                <li><span class="rule-points">5 נק'</span> תוצאה מדויקת</li>
                <li><span class="rule-points">+2 נק'</span> בונוס על תוצאה מדויקת עם <b>5 שערים או יותר</b> בסך הכול (כלומר 7 נק')</li>
                <li><span class="rule-points">2 נק'</span> רק כיוון התוצאה נכון</li>
                <li><span class="rule-points">0 נק'</span> ניחוש שגוי או ללא ניחוש</li>
            </ul>
```

- [ ] **Step 2: English rules**

In `i18n.js` (English block), replace:

```html
            <h4>🏆 Scoring</h4>
            <ul>
                <li><span class="rule-points">4 pts</span> Exact score (both teams' goal counts correct)</li>
                <li><span class="rule-points">1 pt</span> Correct winner (or draw) but wrong score</li>
                <li><span class="rule-points">0 pts</span> Wrong prediction or no prediction</li>
            </ul>
```

with:

```html
            <h4>🏆 Scoring</h4>
            <p><b>Group stage</b></p>
            <ul>
                <li><span class="rule-points">4 pts</span> Exact score (winner and both teams' goal counts correct)</li>
                <li><span class="rule-points">1 pt</span> Correct direction only (winner or draw) — wrong score</li>
                <li><span class="rule-points">0 pts</span> Wrong prediction or no prediction</li>
            </ul>
            <p><b>Knockout stage (Round of 32 onward)</b> — scored on the <b>90-minute</b> result (incl. stoppage time; no extra time or penalties):</p>
            <ul>
                <li><span class="rule-points">5 pts</span> Exact score</li>
                <li><span class="rule-points">+2 pts</span> Bonus for an exact score with <b>5 or more total goals</b> (i.e. 7 pts)</li>
                <li><span class="rule-points">2 pts</span> Correct direction only</li>
                <li><span class="rule-points">0 pts</span> Wrong prediction or no prediction</li>
            </ul>
```

- [ ] **Step 3: Spanish rules**

In `i18n.js` (Spanish block), replace:

```html
            <h4>🏆 Puntuación</h4>
            <ul>
                <li><span class="rule-points">4 pts</span> Resultado exacto (goles de ambos equipos correctos)</li>
                <li><span class="rule-points">1 pt</span> Ganador correcto (o empate) pero resultado incorrecto</li>
                <li><span class="rule-points">0 pts</span> Predicción incorrecta o sin predicción</li>
            </ul>
```

with:

```html
            <h4>🏆 Puntuación</h4>
            <p><b>Fase de grupos</b></p>
            <ul>
                <li><span class="rule-points">4 pts</span> Resultado exacto (ganador y goles de ambos equipos correctos)</li>
                <li><span class="rule-points">1 pt</span> Solo la dirección correcta (ganador o empate) — resultado incorrecto</li>
                <li><span class="rule-points">0 pts</span> Predicción incorrecta o sin predicción</li>
            </ul>
            <p><b>Fase eliminatoria (desde dieciseisavos)</b> — se puntúa con el resultado a los <b>90 minutos</b> (incluido el tiempo añadido; sin prórroga ni penales):</p>
            <ul>
                <li><span class="rule-points">5 pts</span> Resultado exacto</li>
                <li><span class="rule-points">+2 pts</span> Bono por un resultado exacto con <b>5 o más goles</b> en total (es decir, 7 pts)</li>
                <li><span class="rule-points">2 pts</span> Solo la dirección correcta</li>
                <li><span class="rule-points">0 pts</span> Predicción incorrecta o sin predicción</li>
            </ul>
```

- [ ] **Step 4: Bump cache-busting versions**

Run: `sed -i '' 's/20260626a/20260628a/g' index.html && grep -c '20260628a' index.html`
Expected: `6`.

- [ ] **Step 5: Sanity-check the rules render**

Run:
```bash
node -e "global.window={};const fs=require('fs');eval(fs.readFileSync('i18n.js','utf8'));for(const l of ['he','en','es']){const h=TRANSLATIONS[l]['rules.html'];if(!/5|\+2/.test(h)) throw new Error('missing knockout copy in '+l);}console.log('rules copy OK for he/en/es');"
```
Expected: `rules copy OK for he/en/es` (confirms each language's `rules.html` parses and contains the new points). If `i18n.js` is not safely `eval`-able standalone, instead verify by `grep -c 'rule-points">5' i18n.js` → expect `3`.

- [ ] **Step 6: Commit**

```bash
git add i18n.js index.html
git commit -m "docs(rules): explain knockout scoring in he/en/es; bump cache version"
```

---

## Notes for the implementer

- `app.js` and `results-core.mjs` carry **separate** copies of `calcPoints`/`getOutcome` by design — change both; do not try to share code between a classic script and an ESM module.
- The high-score bonus is **only** on an exact match (it's inside the exact branch), so a 4–4 prediction that misses is never bonused.
- Forward-only is automatic: you are not running any recompute. Do not write a migration or re-score anything.
- Leave the dead `leaderboard.scoring*` keys and the lock-time wording in `rules.html` untouched.
