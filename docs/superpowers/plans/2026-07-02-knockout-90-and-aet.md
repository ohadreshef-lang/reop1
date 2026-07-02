# Reliable 90′ Knockout Scoring + A.E.T. Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Score knockout bets reliably on the 90′ result by deriving it from ESPN goal minutes (football-data's `regularTime` is null on the free tier), and display both the 90′ and after-extra-time scores.

**Architecture:** A pure `splitKnockoutResult` in `results-core.mjs` uses football-data's authoritative total and subtracts ESPN-identified extra-time goals (minute > 90) to produce the 90′ `result` (scored) + a 120′ `resultAet` (display only). `buildResultUpdates` writes both and scores points against the 90′ result. The app shows `resultAet` under the headline score when it differs. Backend + a small frontend display change.

**Tech Stack:** Node ESM (`scripts/lib/results-core.mjs`) + `node --test`; classic-script browser (`app.js`, `i18n.js`, `styles.css`).

## Global Constraints

- `splitKnockoutResult({stage, g1, g2, scorers}) -> {result:{team1Goals,team2Goals}, resultAet:{team1Goals,team2Goals}|null}`. `g1/g2` are football-data full-time totals; ET goals = scorers with `typeof minute==='number' && minute>90`. Split only when knockout AND ET goals exist AND `et1<=g1 && et2<=g2 && scorers.length===g1+g2`; else `{result:{g1,g2}, resultAet:null}`.
- Points are scored against the **90′** `result`, never the raw full-time total.
- `resultAet` is additive/optional; group + normal-time knockout games never get it.
- Data model: `matches/{id}/result` = 90′ (scored, existing field); `matches/{id}/resultAet` = 120′ (display only).
- i18n `match.aet`: he `אחרי הארכה`, en `a.e.t.`, es `tras la prórroga`.
- App shows `resultAet` only when it differs from `result`.
- Cache-bust: bump every `?v=20260628c` in `index.html` to `20260702a`.
- Tests run with bare `node --test tests/results-core.test.mjs`. `splitKnockoutResult` is an `export function`.
- Do NOT change group-stage finalization, the football-data finals source, or `calcPoints`.

---

### Task 1: `splitKnockoutResult` + wire into the updater

**Files:**
- Modify: `scripts/lib/results-core.mjs` (add function; `buildResultUpdates` finished + scored loops)
- Test: `tests/results-core.test.mjs`

**Interfaces:**
- Consumes: existing `isKnockoutStage`, `calcPoints`.
- Produces: `splitKnockoutResult(...)`; `buildResultUpdates` now writes `resultAet` and scores against the 90′ result.

- [ ] **Step 1: Write the failing tests**

Add to `tests/results-core.test.mjs` (import `splitKnockoutResult` in the existing import line):

```js
// --- splitKnockoutResult ---------------------------------------------------

test('splitKnockoutResult: group stage never splits', () => {
  const scorers = [{ team: 1, minute: 120 }];
  assert.deepEqual(splitKnockoutResult({ stage: 'group', g1: 3, g2: 2, scorers }),
    { result: { team1Goals: 3, team2Goals: 2 }, resultAet: null });
});

test('splitKnockoutResult: knockout with no ET goals -> no split', () => {
  const scorers = [{ team: 1, minute: 20 }, { team: 1, minute: 80 }, { team: 2, minute: 55 }];
  assert.deepEqual(splitKnockoutResult({ stage: 'R32', g1: 2, g2: 1, scorers }),
    { result: { team1Goals: 2, team2Goals: 1 }, resultAet: null });
});

test('splitKnockoutResult: knockout ET goal splits 90 vs a.e.t. (Belgium-Senegal)', () => {
  const scorers = [
    { team: 2, minute: 25 }, { team: 2, minute: 51 },
    { team: 1, minute: 86 }, { team: 1, minute: 89 }, { team: 1, minute: 120 },
  ];
  assert.deepEqual(splitKnockoutResult({ stage: 'R32', g1: 3, g2: 2, scorers }),
    { result: { team1Goals: 2, team2Goals: 2 }, resultAet: { team1Goals: 3, team2Goals: 2 } });
});

test('splitKnockoutResult: ET goals but scorer count != total (penalty/missed) -> no split', () => {
  const scorers = [{ team: 1, minute: 120 }]; // only 1 scorer but total says 2
  assert.deepEqual(splitKnockoutResult({ stage: 'SF', g1: 1, g2: 1, scorers }),
    { result: { team1Goals: 1, team2Goals: 1 }, resultAet: null });
});

test('splitKnockoutResult: et count exceeding a team total -> no split (guard)', () => {
  const scorers = [{ team: 1, minute: 100 }, { team: 1, minute: 110 }]; // et1=2 but g1=1
  assert.deepEqual(splitKnockoutResult({ stage: 'QF', g1: 1, g2: 1, scorers }),
    { result: { team1Goals: 1, team2Goals: 1 }, resultAet: null });
});

test('buildResultUpdates: knockout ET game scores on 90-minute result + writes resultAet', () => {
  const now = Date.parse('2026-07-01T23:00:00Z');
  const m = { team1: 'A', team2: 'B', date: '2026-07-01T20:00', stage: 'R32',
    scorers: [{ team: 2, minute: 25 }, { team: 2, minute: 51 }, { team: 1, minute: 86 }, { team: 1, minute: 89 }, { team: 1, minute: 120 }] };
  const finished = [{ matchId: 'ko', m, g1: 3, g2: 2 }];
  const groups = { g1: { members: { u1: {}, u2: {} } } };
  const bets = { g1: { u1: { ko: { team1Goals: 1, team2Goals: 1 } }, u2: { ko: { team1Goals: 3, team2Goals: 2 } } } };
  const updates = buildResultUpdates({ finished, live: [], groups, bets, specialBets: {}, now });
  assert.deepEqual(updates['matches/ko/result'], { team1Goals: 2, team2Goals: 2 });   // 90'
  assert.deepEqual(updates['matches/ko/resultAet'], { team1Goals: 3, team2Goals: 2 }); // 120'
  assert.equal(updates['bets/g1/u1/ko/points'], 2);   // 1-1 vs 2-2 draw -> knockout direction = 2
  assert.equal(updates['bets/g1/u2/ko/points'], 0);   // 3-2 vs 2-2 -> wrong (win1 vs draw) = 0
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/results-core.test.mjs`
Expected: FAIL — `splitKnockoutResult` not exported; `resultAet` undefined; u2 points still scored against 3-2.

- [ ] **Step 3: Add `splitKnockoutResult`**

Add to `scripts/lib/results-core.mjs` (near `calcPoints`/`isKnockoutStage`):

```js
// Split a finished knockout score into the 90-minute result (scored) and the after-extra-time
// result (display). g1/g2 are football-data's authoritative full-time total; ESPN scorers'
// minutes identify extra-time goals (minute > 90). Only splits for knockout games with ET goals
// when the goal count agrees with the total (high confidence); otherwise returns the total with
// no a.e.t. (group games, normal-time games, or ambiguous data like penalty shootouts).
export function splitKnockoutResult({ stage, g1, g2, scorers }) {
    const result = { team1Goals: g1, team2Goals: g2 };
    if (!isKnockoutStage(stage) || !Array.isArray(scorers)) return { result, resultAet: null };
    const et1 = scorers.filter(s => s && s.team === 1 && typeof s.minute === 'number' && s.minute > 90).length;
    const et2 = scorers.filter(s => s && s.team === 2 && typeof s.minute === 'number' && s.minute > 90).length;
    if (et1 + et2 === 0) return { result, resultAet: null };
    if (et1 > g1 || et2 > g2 || scorers.length !== g1 + g2) return { result, resultAet: null };
    return { result: { team1Goals: g1 - et1, team2Goals: g2 - et2 }, resultAet: { team1Goals: g1, team2Goals: g2 } };
}
```

- [ ] **Step 4: Rewrite the `finished` loop in `buildResultUpdates`**

Replace:

```js
    for (const { matchId, g1, g2 } of finished) {
        updates[`matches/${matchId}/result`] = { team1Goals: g1, team2Goals: g2 };
        updates[`matches/${matchId}/status`] = 'completed';
        updates[`matches/${matchId}/finishedAt`] = now;
        updates[`matches/${matchId}/live`] = null;
    }
```

with:

```js
    for (const f of finished) {
        const { matchId, m, g1, g2 } = f;
        const split = splitKnockoutResult({ stage: m.stage, g1, g2, scorers: m.scorers });
        f.r1 = split.result.team1Goals;   // 90-minute score — used by the points loop below
        f.r2 = split.result.team2Goals;
        updates[`matches/${matchId}/result`] = split.result;
        updates[`matches/${matchId}/status`] = 'completed';
        updates[`matches/${matchId}/finishedAt`] = now;
        updates[`matches/${matchId}/live`] = null;
        if (split.resultAet) updates[`matches/${matchId}/resultAet`] = split.resultAet;
    }
```

- [ ] **Step 5: Score the points loop against the 90′ result**

Replace the `scored` inner loop:

```js
                for (const { matchId, g1, g2, m } of scored) {
                    const bet = userBets[matchId];
                    if (!bet) {
                        const filled = { team1Goals: 0, team2Goals: 0, placedAt: 0, points: calcPoints(0, 0, g1, g2, m.stage) };
                        updates[`bets/${groupId}/${userId}/${matchId}`] = filled;
                        userBets[matchId] = filled;
                    } else {
                        bet.points = calcPoints(bet.team1Goals, bet.team2Goals, g1, g2, m.stage);
                        updates[`bets/${groupId}/${userId}/${matchId}/points`] = bet.points;
                    }
                }
```

with (uses `r1/r2` = the 90′ score stashed on each finished/scored entry in Step 4):

```js
                for (const { matchId, r1, r2, m } of scored) {
                    const bet = userBets[matchId];
                    if (!bet) {
                        const filled = { team1Goals: 0, team2Goals: 0, placedAt: 0, points: calcPoints(0, 0, r1, r2, m.stage) };
                        updates[`bets/${groupId}/${userId}/${matchId}`] = filled;
                        userBets[matchId] = filled;
                    } else {
                        bet.points = calcPoints(bet.team1Goals, bet.team2Goals, r1, r2, m.stage);
                        updates[`bets/${groupId}/${userId}/${matchId}/points`] = bet.points;
                    }
                }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test tests/results-core.test.mjs`
Expected: PASS (new `splitKnockoutResult` + `buildResultUpdates` ET tests, plus all pre-existing).

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/results-core.mjs tests/results-core.test.mjs
git commit -m "feat(updater): derive 90' knockout result from ESPN goals; store resultAet"
```

---

### Task 2: Display both scores in the app

**Files:**
- Modify: `app.js` (result-score render, ~line 1202)
- Modify: `i18n.js` (add `match.aet` in he/en/es)
- Modify: `styles.css` (`.result-aet`, near `.result-score` ~line 592)
- Modify: `index.html` (cache bump)
- Test: `tests/manual/aet-display-harness.html`

**Interfaces:** consumes `m.resultAet` written by Task 1; `t('match.aet')`.

- [ ] **Step 1: Render the a.e.t. line**

In `app.js`, replace:

```js
        middleHtml = `<div class="result-score">${m.result.team1Goals} – ${m.result.team2Goals}</div>`;
```

with:

```js
        middleHtml = `<div class="result-score">${m.result.team1Goals} – ${m.result.team2Goals}</div>`
            + (m.resultAet && (m.resultAet.team1Goals !== m.result.team1Goals || m.resultAet.team2Goals !== m.result.team2Goals)
                ? `<div class="result-aet">${t('match.aet')} ${m.resultAet.team1Goals}–${m.resultAet.team2Goals}</div>` : '');
```

- [ ] **Step 2: Add the `match.aet` i18n string (all three languages)**

In `i18n.js`, add a `'match.aet'` entry to each language block (place it near other `match.*` keys):
- Hebrew: `'match.aet': 'אחרי הארכה',`
- English: `'match.aet': 'a.e.t.',`
- Spanish: `'match.aet': 'tras la prórroga',`

- [ ] **Step 3: Add the CSS**

In `styles.css`, after the `.result-score { … }` rule (~line 592), add:

```css
.result-aet {
    font-size: .72rem;
    color: #6b7280;
    font-weight: 600;
    text-align: center;
    margin-top: 2px;
}
```

- [ ] **Step 4: Bump cache-busting versions**

Run: `sed -i '' 's/20260628c/20260702a/g' index.html && grep -c '20260702a' index.html`
Expected: `6`.

- [ ] **Step 5: Headless harness**

Create `tests/manual/aet-display-harness.html`:

```html
<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="../../styles.css">
<body style="direction:rtl">
<div id="tab-matches" class="tab-panel active"><div id="matches-container" class="app-content"></div></div>
<script>window.firebase=undefined;window.db=null;window.currentUser={userId:'u1'};
window.t=k=>({'match.aet':'אחרי הארכה','match.yourBet':'ניחוש','match.editBet':'ערוך','live.total':'סה"כ','common.pts':'נק׳'}[k]||k);
window.translateTeam=n=>n;window.currentLang='he';</script>
<script src="../../app.js?cb=1"></script>
<script>
  // A finished knockout game: 90' 2-2, a.e.t. 3-2.
  Object.assign(matches,{
    ko:{team1:'בלגיה',team2:'סנגל',date:'2026-07-01T20:00',stage:'R32',status:'completed',
        result:{team1Goals:2,team2Goals:2},resultAet:{team1Goals:3,team2Goals:2},scorers:[]},
    grp:{team1:'ברזיל',team2:'יפן',date:'2026-06-29T17:00',stage:'group',status:'completed',
        result:{team1Goals:2,team2Goals:1},scorers:[]},
  });
  Object.assign(groupMembers,{u1:{name:'A',totalPoints:0}});Object.assign(groupUsersCache,groupMembers);
  Object.assign(allGroupBets,{u1:{}});Object.assign(userBets,{});
  window.activeTournament='worldcup2026';window.stageFilter='all';renderMatches();
  const aet=[...document.querySelectorAll('.result-aet')];
  const koCard=[...document.querySelectorAll('.match-card')].find(c=>c.textContent.includes('בלגיה'));
  const grpCard=[...document.querySelectorAll('.match-card')].find(c=>c.textContent.includes('ברזיל'));
  const koHasAet=koCard&&/אחרי הארכה 3–2/.test(koCard.textContent);
  const grpHasAet=grpCard&&grpCard.querySelector('.result-aet');
  document.title='AETCOUNT:'+aet.length+' KO:'+!!koHasAet+' GRPNONE:'+!grpHasAet;
</script></body>
```

- [ ] **Step 6: Render the harness and verify**

Run:
```bash
CHROME=$(ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
"$CHROME" --headless --disable-gpu --dump-dom "file://$PWD/tests/manual/aet-display-harness.html" 2>/dev/null | grep -oE '<title>[^<]*</title>'
```
Expected: `<title>AETCOUNT:1 KO:true GRPNONE:true</title>` (a.e.t. shown for the ET knockout game, absent for the group game).

- [ ] **Step 7: Full unit run (no regressions)**

Run: `node --test tests/pure-logic.test.js tests/results-core.test.mjs tests/paul-core.test.mjs`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app.js i18n.js styles.css index.html tests/manual/aet-display-harness.html
git commit -m "feat: show a.e.t. score under the 90' result for knockout games"
```

---

## Notes for the implementer

- `resultAet` is written by the updater only when a knockout game had extra-time goals and the ESPN count matched the total — so the app must tolerate its absence (the `m.resultAet && …` guard).
- Points are scored against the 90′ `result`; never reintroduce `g1/g2` into the points loop.
- Backend `splitKnockoutResult` and the app guard both compare `resultAet` vs `result` for equality — a game that "went to ET" but was 2-2 at both 90′ and 120′ (impossible if ET goals exist, but harmless) simply shows no a.e.t. line.
- The Belgium–Senegal one-off was already corrected manually; this task prevents recurrence and adds the display.
