# Persist Goal Scorers + Show in Matches Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist goal scorers so they survive match finalization, and show them in the Matches tab (with the per-match breakdown ordered like the leaderboard).

**Architecture:** Move scorers out of the ephemeral `matches/{id}/live` node into a persistent `matches/{id}/scorers` path (never cleared at finalize). The Live card reads the persistent field (falling back to the live node); the Matches card renders the same two-column scorers block and orders its breakdown rows by total points.

**Tech Stack:** Vanilla ES module (`scripts/lib/results-core.mjs`, Node `node --test`); classic-script browser JS (`app.js`); Firebase RTDB.

## Global Constraints

- Scorers persist at `matches/{id}/scorers` (array). `buildResultUpdates` writes it in the live loop; the finished loop must NOT clear it. Nothing else ever clears it.
- The live node (`matches/{id}/live`) no longer carries a `scorers` key.
- Scorer object shape: `{ team: 1|2, player, minute, extra, kind: 'goal'|'pen'|'og' }`.
- Live card scorers source: `m.scorers` with fallback to `m.live.scorers`. Matches card source: `m.scorers`.
- Matches breakdown order = members by `totalPoints` descending (leaderboard order), name tiebreak for stability.
- Reuse the existing `scorerLine(s)` helper and `.live-scorers` / `.live-scorers-col` / `.live-scorer` CSS classes (already shipped) — do not duplicate them.
- Tests run with bare `node --test tests/<file>` (NOT `node --test tests/`).
- Cache-busting: bump every `?v=` string in `index.html` (currently `20260620g`).

---

### Task 1: Persist scorers to `matches/{id}/scorers` (backend)

**Files:**
- Modify: `scripts/lib/results-core.mjs` (`buildResultUpdates` live loop, ~line 220-221)
- Test: `tests/results-core.test.mjs` (update the two tests that assert the live-node shape: ~line 59 and ~line 238)

**Interfaces:**
- Consumes: live entries already carry `scorers` (from the live-scorers feature).
- Produces: `buildResultUpdates` writes `matches/{id}/scorers` (array, default `[]`); the live node no longer has a `scorers` key. The finished loop still nulls `matches/{id}/live` and leaves `matches/{id}/scorers` untouched.

- [ ] **Step 1: Update the two failing tests**

In `tests/results-core.test.mjs`, replace the assertion line in the test `'buildResultUpdates: live entry writes a live node only'` (the `deepEqual` of `updates['matches/m_live/live']`, ~line 63) with these two lines (live node no longer has scorers; scorers default to `[]` at the persistent path):

```js
  assert.deepEqual(updates['matches/m_live/live'], { team1Goals: 1, team2Goals: 0, status: 'IN_PLAY', updatedAt: now, minute: null, extra: null });
  assert.deepEqual(updates['matches/m_live/scorers'], []);
```

Then replace the entire test `'buildResultUpdates: live node includes scorers (passed through; default [])'` (~line 238) with:

```js
test('buildResultUpdates: scorers persisted to matches/{id}/scorers, not in the live node', () => {
  const now = 1750000000000;
  const withScorers = [{ matchId: 'm_live', m: { team1: 'גאנה', team2: 'פנמה' }, g1: 1, g2: 0, status: 'IN_PLAY',
    scorers: [{ team: 1, player: 'Z', minute: 8, extra: null, kind: 'goal' }] }];
  const u1 = buildResultUpdates({ finished: [], live: withScorers, groups: {}, bets: {}, specialBets: {}, now });
  assert.deepEqual(u1['matches/m_live/scorers'], [{ team: 1, player: 'Z', minute: 8, extra: null, kind: 'goal' }]);
  assert.equal('scorers' in u1['matches/m_live/live'], false); // scorers no longer in the live node

  const noScorers = [{ matchId: 'm_live', m: { team1: 'גאנה', team2: 'פנמה' }, g1: 0, g2: 0, status: 'IN_PLAY' }];
  const u2 = buildResultUpdates({ finished: [], live: noScorers, groups: {}, bets: {}, specialBets: {}, now });
  assert.deepEqual(u2['matches/m_live/scorers'], []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/results-core.test.mjs`
Expected: FAIL — the live node still has `scorers` and `matches/m_live/scorers` is undefined.

- [ ] **Step 3: Move scorers to the persistent path**

In `scripts/lib/results-core.mjs`, replace the live loop (currently):

```js
    for (const { matchId, g1, g2, status, minute, extra, scorers } of live) {
        updates[`matches/${matchId}/live`] = { team1Goals: g1, team2Goals: g2, status, updatedAt: now, minute: minute == null ? null : minute, extra: extra == null ? null : extra, scorers: Array.isArray(scorers) ? scorers : [] };
    }
```

with:

```js
    for (const { matchId, g1, g2, status, minute, extra, scorers } of live) {
        updates[`matches/${matchId}/live`] = { team1Goals: g1, team2Goals: g2, status, updatedAt: now, minute: minute == null ? null : minute, extra: extra == null ? null : extra };
        // Scorers live on a PERSISTENT path so they survive finalize (when the live node
        // is nulled). Never cleared — becomes part of the match's history.
        updates[`matches/${matchId}/scorers`] = Array.isArray(scorers) ? scorers : [];
    }
```

(The finished loop is unchanged: it nulls `matches/{id}/live` and does not touch `matches/{id}/scorers`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/results-core.test.mjs`
Expected: PASS.

- [ ] **Step 5: Verify no other suite regressed**

Run: `node --test tests/results-core.test.mjs tests/paul-core.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/results-core.mjs tests/results-core.test.mjs
git commit -m "feat: persist scorers to matches/{id}/scorers (survives finalize)"
```

---

### Task 2: Show scorers in both cards + order Matches breakdown like the leaderboard (frontend)

**Files:**
- Modify: `app.js` (`buildLiveCard` scorers source ~line 1308; `buildMatchCard` — add scorers block + reorder breakdown)
- Modify: `index.html` (bump `20260620g` → `20260621a`)
- Test: `tests/manual/live-finished-scorers-harness.html` (new), `tests/manual/matches-scorers-harness.html` (new)

**Interfaces:**
- Consumes: persistent `m.scorers` (Task 1); existing `scorerLine`, `escapeHtml`, `t`, `calcPoints`, `groupMembers`, `groupUsersCache`, `allGroupBets`.
- Produces: nothing for later tasks (final task).

- [ ] **Step 1: Live card reads the persistent field (with fallback)**

In `app.js` `buildLiveCard`, replace (line ~1308):

```js
    const scorers = (live && Array.isArray(live.scorers)) ? live.scorers : [];
```

with:

```js
    const scorers = Array.isArray(m.scorers) ? m.scorers : ((live && Array.isArray(live.scorers)) ? live.scorers : []);
```

- [ ] **Step 2: Add the scorers block to the Matches card**

In `app.js` `buildMatchCard`, add this just before the `return \`` template line (after `breakdownHtml` is built):

```js
    const matchScorers = Array.isArray(m.scorers) ? m.scorers : [];
    const matchScorersCol = team => matchScorers.filter(s => s.team === team).map(scorerLine).join('');
    const scorersHtml = matchScorers.length
        ? `<div class="live-scorers"><div class="live-scorers-col">${matchScorersCol(1)}</div><div class="live-scorers-col">${matchScorersCol(2)}</div></div>`
        : '';
```

Then, in the returned template, insert `${scorersHtml}` immediately after the `.match-teams-row` closing `</div>` and before `${betAreaHtml}`:

```js
            </div>
            ${scorersHtml}
            ${betAreaHtml}
            ${pointsHtml}
            ${breakdownHtml}
```

(The `</div>` shown is the one closing `<div class="match-teams-row">`.)

- [ ] **Step 3: Order the Matches breakdown rows like the leaderboard**

In `app.js` `buildMatchCard`, inside the `if (hasResult)` block that builds `breakdownHtml`, replace the row-building line (currently `const rows = Object.keys(groupMembers).map(uid => {`) and its surrounding so the uids are sorted first. Concretely, replace:

```js
        const rows = Object.keys(groupMembers).map(uid => {
            const name = (groupUsersCache[uid] && groupUsersCache[uid].name)
                || (groupMembers[uid] && groupMembers[uid].name) || t('groupSettings.unknownUser');
```

with:

```js
        const nameForUid = uid => (groupUsersCache[uid] && groupUsersCache[uid].name)
            || (groupMembers[uid] && groupMembers[uid].name) || t('groupSettings.unknownUser');
        const orderedUids = Object.keys(groupMembers).sort((a, b) =>
            (((groupMembers[b] && groupMembers[b].totalPoints) || 0) - ((groupMembers[a] && groupMembers[a].totalPoints) || 0))
            || nameForUid(a).localeCompare(nameForUid(b)));
        const rows = orderedUids.map(uid => {
            const name = nameForUid(uid);
```

(Everything else inside the `.map(...)` body — `b`, `betStr`, `pts`, `cls`, the returned row markup — stays exactly as is.)

- [ ] **Step 4: Create the live-card finished-game harness**

Create `tests/manual/live-finished-scorers-harness.html`:

```html
<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="../../styles.css">
<body style="direction:rtl">
<div id="tab-live" class="tab-panel active"><div id="live-container" class="app-content"></div></div>
<script>window.firebase=undefined;window.db=null;window.currentUser={userId:'u1'};
window.t=k=>({'live.statusLive':'משחק חי','live.notStarted':'טרם החל','live.total':'סה"כ','match.status.completed':'הסתיים','leaderboard.meTag':'אני','groupSettings.unknownUser':'?','live.empty':'אין'}[k]||k);
window.translateTeam=n=>n;window.currentLang='he';</script>
<script src="../../app.js?cb=1"></script>
<script>
  const ago=ms=>new Date(Date.now()-ms).toISOString().slice(0,16);
  // FINISHED game still in the live view (finishedAt recent), live node nulled,
  // scorers on the PERSISTENT field.
  Object.assign(matches,{g:{team1:'הולנד',team2:'שוודיה',date:ago(110*60000),group:'F',stage:'group',
    result:{team1Goals:2,team2Goals:1}, finishedAt:Date.now()-10*60000, live:null,
    scorers:[{team:1,player:'Brobbey',minute:5,extra:null,kind:'goal'},
             {team:1,player:'Gakpo',minute:54,extra:null,kind:'goal'},
             {team:2,player:'Elanga',minute:59,extra:null,kind:'goal'}]}});
  Object.assign(groupMembers,{u1:{name:'shay',totalPoints:10}});
  Object.assign(groupUsersCache,groupMembers);
  window.activeTournament='worldcup2026';window.stageFilter='all';renderLive();
  const h=document.querySelector('#live-container').innerHTML;
  document.title='SCORERS:'+h.includes('live-scorers')+' EMOJI:'+h.includes('⚽')+' NAME:'+h.includes('Brobbey');
</script></body>
```

- [ ] **Step 5: Render the live harness and verify**

Run:
```bash
CHROME=$(ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
"$CHROME" --headless --disable-gpu --dump-dom "file://$PWD/tests/manual/live-finished-scorers-harness.html" 2>/dev/null | grep -oE '<title>[^<]*</title>'
```
Expected: `<title>SCORERS:true EMOJI:true NAME:true</title>`.

- [ ] **Step 6: Create the Matches-card harness (scorers + breakdown order)**

Create `tests/manual/matches-scorers-harness.html`:

```html
<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="../../styles.css">
<body style="direction:rtl">
<div id="out"></div>
<script>window.firebase=undefined;window.db=null;window.currentUser={userId:'u1'};
window.t=k=>({'match.yourBet':'ניחוש','match.status.completed':'הסתיים','match.showBreakdown':'פירוט','match.pointsLabel':'נק׳','groupSettings.unknownUser':'?'}[k]||k);
window.translateTeam=n=>n;window.currentLang='he';</script>
<script src="../../app.js?cb=1"></script>
<script>
  const ago=ms=>new Date(Date.now()-ms).toISOString().slice(0,16);
  const m={id:'g',team1:'הולנד',team2:'שוודיה',date:ago(110*60000),group:'F',stage:'group',
    result:{team1Goals:2,team2Goals:1},
    scorers:[{team:1,player:'Brobbey',minute:5,extra:null,kind:'goal'},
             {team:2,player:'Elanga',minute:59,extra:null,kind:'goal'}]};
  Object.assign(matches,{g:m});
  // three members with differing totals -> leaderboard order is High, Mid, Low
  Object.assign(groupMembers,{u1:{name:'Low',totalPoints:3},u2:{name:'High',totalPoints:30},u3:{name:'Mid',totalPoints:15}});
  Object.assign(groupUsersCache,groupMembers);
  Object.assign(allGroupBets,{u1:{g:{team1Goals:0,team2Goals:0}},u2:{g:{team1Goals:2,team2Goals:1}},u3:{g:{team1Goals:1,team2Goals:1}}});
  window.activeTournament='worldcup2026';window.stageFilter='all';
  document.getElementById('out').innerHTML=buildMatchCard(m);
  const names=[...document.querySelectorAll('#breakdown-g .lp-name')].map(e=>e.textContent);
  const h=document.getElementById('out').innerHTML;
  document.title='SCORERS:'+h.includes('live-scorers')+' ORDER:'+names.join(',');
</script></body>
```

- [ ] **Step 7: Render the Matches harness and verify order**

Run:
```bash
CHROME=$(ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
"$CHROME" --headless --disable-gpu --dump-dom "file://$PWD/tests/manual/matches-scorers-harness.html" 2>/dev/null | grep -oE '<title>[^<]*</title>'
```
Expected: `<title>SCORERS:true ORDER:High,Mid,Low</title>` (breakdown rows sorted by total points descending).

- [ ] **Step 8: Re-run the unit suites (no regressions)**

Run: `node --test tests/pure-logic.test.js tests/results-core.test.mjs tests/paul-core.test.mjs`
Expected: PASS (all suites — `app.js` still loads in the vm sandbox; the frontend edits don't change exported helpers).

- [ ] **Step 9: Bump cache-busting versions**

Run: `sed -i '' 's/20260620g/20260621a/g' index.html && grep -c '20260621a' index.html`
Expected: `6`.

- [ ] **Step 10: Commit**

```bash
git add app.js index.html tests/manual/live-finished-scorers-harness.html tests/manual/matches-scorers-harness.html
git commit -m "feat: show persisted scorers in Live + Matches cards; order Matches breakdown by leaderboard"
```

---

## Notes for the implementer

- Reuse `scorerLine` and the `.live-scorers*` CSS — do not redefine them.
- The DB requires auth and the updater key is CI-only; you cannot run the updater end-to-end locally. Backend coverage is the unit tests; frontend coverage is the headless harnesses.
- After merge + deploy, the next updater poll writes `matches/{id}/scorers`; verify on `mondial.guru` that a finished game keeps its scorers in the Live view and shows them in the Matches tab, with the breakdown ordered like the leaderboard.
