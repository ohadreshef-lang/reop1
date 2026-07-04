# Live Standings Accumulate Across Concurrent Games — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When multiple games are live at once, the Live-tab projected standings accumulate each member's provisional points across all live games (consistent on every card), while each card's +N pill still shows its own game's contribution.

**Architecture:** A new pure helper `projectLiveStandings(games, members, bets, now)` computes the combined standings once; `renderLive` calls it and passes the result to each `buildLiveCard(m, ctx)`, which uses the shared totals/order/arrows but keeps its own per-game pill.

**Tech Stack:** Classic-script browser JS (`app.js`), Node `node --test` for the pure helper, headless Chrome harness.

## Global Constraints

- `projectLiveStandings(games, members, bets, now)` returns `{ orderedUids, projectedTotal, oldPos }`.
- A game's score = `result → live → {0,0} if started → null` (same rule as `buildLiveCard`). Null-score games contribute nothing.
- Per member: `projectedTotal = currentTotal − Σ counted + Σ provisional` over scored games, where `provisional = calcPoints(bet|0–0, score)` and `counted = bet.points` when present (finalized) else 0. A finalized game nets 0 (no double-count); an in-progress game adds its live points.
- `oldPos` ranks by current `totalPoints` desc (name tiebreak); `orderedUids` by `projectedTotal` desc, then `currentTotal` desc, then name.
- The card's **total column** = `ctx.projectedTotal[uid]` (identical across all live cards); **+N pill** = this card's own `matchOf(uid)`; **pick** = this card's bet. Single-live-game output must be identical to today.
- `projectLiveStandings` must be a `function` declaration (test vm sandbox exposes only those).
- Tests run with bare `node --test tests/<file>` (NOT `node --test tests/`).
- Cache-busting: bump every `?v=20260623a` in `index.html` to `20260624a`.

---

### Task 1: `projectLiveStandings` pure helper

**Files:**
- Modify: `app.js` (add `projectLiveStandings` just above `function buildLiveCard`, ~line 1316)
- Test: `tests/pure-logic.test.js`

**Interfaces:**
- Produces: `projectLiveStandings(games, members, bets, now) -> { orderedUids: string[], projectedTotal: {[uid]:number}, oldPos: {[uid]:number} }`. Uses existing `calcPoints`, `parseMatchDate`, `t`, `groupUsersCache`.

- [ ] **Step 1: Write the failing tests**

In `tests/pure-logic.test.js`, add:

```js
// --- projectLiveStandings (accumulate across concurrent live games) --------

test('projectLiveStandings: two in-play games accumulate per member', () => {
    const now = Date.parse('2026-06-24T20:30:00Z');
    const games = [
        { id: 'g1', date: '2026-06-24T20:00', live: { team1Goals: 1, team2Goals: 0 } },
        { id: 'g2', date: '2026-06-24T20:00', live: { team1Goals: 2, team2Goals: 1 } },
    ];
    const members = { u1: { totalPoints: 10, name: 'A' }, u2: { totalPoints: 20, name: 'B' } };
    const bets = {
        u1: { g1: { team1Goals: 1, team2Goals: 0 }, g2: { team1Goals: 2, team2Goals: 1 } }, // both exact → +4 +4
        u2: { g1: { team1Goals: 0, team2Goals: 0 }, g2: { team1Goals: 0, team2Goals: 0 } }, // both wrong → 0
    };
    const r = app.projectLiveStandings(games, members, bets, now);
    assert.equal(r.projectedTotal.u1, 18); // 10 + 8
    assert.equal(r.projectedTotal.u2, 20); // 20 + 0
    assert.deepEqual(r.orderedUids, ['u2', 'u1']); // 20 > 18
    assert.equal(r.oldPos.u2, 1);            // current standing by totalPoints
    assert.equal(r.oldPos.u1, 2);
});

test('projectLiveStandings: a member gaining in only one game adds only that game', () => {
    const now = Date.parse('2026-06-24T20:30:00Z');
    const games = [
        { id: 'g1', date: '2026-06-24T20:00', live: { team1Goals: 1, team2Goals: 0 } },
        { id: 'g2', date: '2026-06-24T20:00', live: { team1Goals: 2, team2Goals: 1 } },
    ];
    const members = { u3: { totalPoints: 5, name: 'C' } };
    const bets = { u3: { g1: { team1Goals: 1, team2Goals: 0 } } }; // exact g1 (+4); no g2 bet → 0–0 vs 2–1 → 0
    const r = app.projectLiveStandings(games, members, bets, now);
    assert.equal(r.projectedTotal.u3, 9); // 5 + 4
});

test('projectLiveStandings: a finalized game in the set contributes net 0 (no double-count)', () => {
    const now = Date.parse('2026-06-24T20:30:00Z');
    const games = [
        { id: 'gf', date: '2026-06-24T18:00', result: { team1Goals: 2, team2Goals: 0 } },          // finalized
        { id: 'gl', date: '2026-06-24T20:00', live: { team1Goals: 1, team2Goals: 0 } },             // in-play
    ];
    const members = { u1: { totalPoints: 14, name: 'A' } }; // 14 already includes gf's 4
    const bets = { u1: { gf: { team1Goals: 2, team2Goals: 0, points: 4 }, gl: { team1Goals: 1, team2Goals: 0 } } };
    const r = app.projectLiveStandings(games, members, bets, now);
    assert.equal(r.projectedTotal.u1, 18); // 14 + (gf net 0) + (gl +4)
});

test('projectLiveStandings: not-started game (null score) contributes nothing', () => {
    const now = Date.parse('2026-06-24T20:30:00Z');
    const games = [{ id: 'gns', date: '2026-06-24T23:00' }]; // future → no score
    const members = { u1: { totalPoints: 7, name: 'A' } };
    const bets = { u1: { gns: { team1Goals: 1, team2Goals: 1 } } };
    const r = app.projectLiveStandings(games, members, bets, now);
    assert.equal(r.projectedTotal.u1, 7);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/pure-logic.test.js`
Expected: FAIL — `app.projectLiveStandings is not a function`.

- [ ] **Step 3: Add `projectLiveStandings` to `app.js`**

In `app.js`, immediately **before** `function buildLiveCard(m) {` (~line 1316), add:

```js
// Projected live standings across ALL currently-live games, so concurrent games
// accumulate. Pure. For each member: currentTotal − Σ already-counted + Σ provisional
// over every scored game (a finalized game nets 0; an in-play game adds its live points).
function projectLiveStandings(games, members, bets, now) {
    const uids = Object.keys(members || {});
    const nameOf = uid => (groupUsersCache[uid] && groupUsersCache[uid].name) || (members[uid] && members[uid].name) || t('groupSettings.unknownUser');
    const scoreOf = g => {
        const hasResult = g.result !== null && g.result !== undefined;
        const started = parseMatchDate(g.date).getTime() <= now;
        return hasResult ? g.result : (g.live ? g.live : (started ? { team1Goals: 0, team2Goals: 0 } : null));
    };
    const scored = (games || []).map(g => ({ g, s: scoreOf(g) })).filter(x => x.s);
    const currentTotal = uid => (members[uid] && members[uid].totalPoints) || 0;
    const projectedTotal = {};
    for (const uid of uids) {
        let delta = 0;
        for (const { g, s } of scored) {
            const b = (bets[uid] || {})[g.id];
            const provisional = calcPoints(b ? b.team1Goals : 0, b ? b.team2Goals : 0, s.team1Goals, s.team2Goals);
            const counted = (b && typeof b.points === 'number') ? b.points : 0;
            delta += provisional - counted;
        }
        projectedTotal[uid] = currentTotal(uid) + delta;
    }
    const oldPos = {};
    [...uids].sort((a, b) => currentTotal(b) - currentTotal(a) || nameOf(a).localeCompare(nameOf(b)))
        .forEach((uid, i) => { oldPos[uid] = i + 1; });
    const orderedUids = [...uids].sort((a, b) =>
        projectedTotal[b] - projectedTotal[a] || currentTotal(b) - currentTotal(a) || nameOf(a).localeCompare(nameOf(b)));
    return { orderedUids, projectedTotal, oldPos };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/pure-logic.test.js`
Expected: PASS (4 new tests + all existing).

- [ ] **Step 5: Commit**

```bash
git add app.js tests/pure-logic.test.js
git commit -m "feat: projectLiveStandings — accumulate live points across concurrent games"
```

---

### Task 2: Wire shared standings into renderLive + buildLiveCard

**Files:**
- Modify: `app.js` (`renderLive` map line ~1313; `buildLiveCard` signature + projection block ~1348-1366 + rows ~1368-1388)
- Modify: `index.html` (bump `20260623a` → `20260624a`)
- Test: `tests/manual/live-accumulate-harness.html`

**Interfaces:**
- Consumes: `projectLiveStandings` (Task 1).

- [ ] **Step 1: Pass the shared context from `renderLive`**

In `app.js` `renderLive`, replace:

```js
    if (games.length === 0) { container.innerHTML = `<p class="state-msg">${t('live.empty')}</p>`; return; }
    container.innerHTML = games.map(buildLiveCard).join('');
```

with:

```js
    if (games.length === 0) { container.innerHTML = `<p class="state-msg">${t('live.empty')}</p>`; return; }
    // Combined standings across ALL live games, computed once and shared by every card.
    const standings = projectLiveStandings(games, groupMembers, allGroupBets, now);
    container.innerHTML = games.map(m => buildLiveCard(m, standings)).join('');
```

- [ ] **Step 2: Update `buildLiveCard` signature**

Change `function buildLiveCard(m) {` to `function buildLiveCard(m, ctx) {`.

- [ ] **Step 3: Replace the per-card projection block with the shared context**

In `buildLiveCard`, replace this block (the `const uids` … `newOrder` section):

```js
    const uids   = Object.keys(groupMembers);
    const nameOf = uid => (groupUsersCache[uid] && groupUsersCache[uid].name) || (groupMembers[uid] && groupMembers[uid].name) || t('groupSettings.unknownUser');
    // Once the updater finalizes a match it writes this match's points into the bet
    // AND folds them into totalPoints. The projection adds the match's provisional
    // points itself (matchOf), so we must strip any already-counted points out of the
    // base first — otherwise the finished match is counted twice (base + matchOf) and
    // totals jump the moment the leaderboard updates. During the live phase no points
    // are stored yet, so countedOf is 0 and base == totalPoints as before.
    const countedOf = uid => { const b = (allGroupBets[uid] || {})[m.id]; return (b && typeof b.points === 'number') ? b.points : 0; };
    const baseOf = uid => (((groupMembers[uid] && groupMembers[uid].totalPoints) || 0) - countedOf(uid));
    // A missing bet counts as 0–0 (matches how the updater auto-fills no-bets when a
    // match finishes), so no-betters are scored and shown as 0–0, never "—".
    const matchOf = uid => { if (!score) return 0; const b = (allGroupBets[uid] || {})[m.id]; return calcPoints(b ? b.team1Goals : 0, b ? b.team2Goals : 0, score.team1Goals, score.team2Goals); };
    const betOf  = uid => { const b = (allGroupBets[uid] || {})[m.id]; return b ? `${b.team1Goals}–${b.team2Goals}` : '0–0'; };
    // Current standing (tie-break by name so positions are stable), then projected.
    const oldPos = {};
    [...uids].sort((a, b) => baseOf(b) - baseOf(a) || nameOf(a).localeCompare(nameOf(b))).forEach((uid, i) => { oldPos[uid] = i + 1; });
    const newOrder = [...uids].sort((a, b) =>
        (baseOf(b) + matchOf(b)) - (baseOf(a) + matchOf(a)) || baseOf(b) - baseOf(a) || nameOf(a).localeCompare(nameOf(b)));
```

with:

```js
    const nameOf = uid => (groupUsersCache[uid] && groupUsersCache[uid].name) || (groupMembers[uid] && groupMembers[uid].name) || t('groupSettings.unknownUser');
    // This card's OWN provisional points (for the +N pill / pick). Missing bet = 0–0,
    // matching the updater's auto-fill.
    const matchOf = uid => { if (!score) return 0; const b = (allGroupBets[uid] || {})[m.id]; return calcPoints(b ? b.team1Goals : 0, b ? b.team2Goals : 0, score.team1Goals, score.team2Goals); };
    const betOf  = uid => { const b = (allGroupBets[uid] || {})[m.id]; return b ? `${b.team1Goals}–${b.team2Goals}` : '0–0'; };
    // Standings are computed once across ALL live games (so concurrent games accumulate)
    // and shared via ctx — every live card shows the same combined projected total.
    const { orderedUids, projectedTotal, oldPos } = ctx;
```

- [ ] **Step 4: Use the shared totals/order in the rows**

In `buildLiveCard`'s `rowsHtml`, change the iterator and the total line. Replace:

```js
    const rowsHtml = newOrder.map((uid, i) => {
        const rank  = i + 1;
        const isMe  = currentUser && uid === currentUser.userId;
        const mp    = matchOf(uid);
        const total = baseOf(uid) + mp;
```

with:

```js
    const rowsHtml = orderedUids.map((uid, i) => {
        const rank  = i + 1;
        const isMe  = currentUser && uid === currentUser.userId;
        const mp    = matchOf(uid);
        const total = projectedTotal[uid];
```

(Everything else in the row — `delta`, `chg`, `rankLabel`, `meTag`, `pillCls`, `pillTxt`, the returned markup — stays exactly as is.)

- [ ] **Step 5: Create the headless harness**

Create `tests/manual/live-accumulate-harness.html`:

```html
<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="../../styles.css">
<body style="direction:rtl">
<div id="tab-live" class="tab-panel active"><div id="live-container" class="app-content"></div></div>
<script>window.firebase=undefined;window.db=null;window.currentUser={userId:'u1'};
window.t=k=>({'live.statusLive':'משחק חי','live.notStarted':'טרם החל','live.total':'סה"כ','leaderboard.meTag':'אני','match.yourBet':'ניחוש','groupSettings.unknownUser':'?','live.empty':'אין'}[k]||k);
window.translateTeam=n=>n;window.currentLang='he';</script>
<script src="../../app.js?cb=1"></script>
<script>
  const ago=ms=>new Date(Date.now()-ms).toISOString().slice(0,16);
  // Two in-play games. u1 gains only in g1, u2 gains only in g2 -> combined totals must
  // appear identically on BOTH cards, while each card's pill reflects its own game.
  Object.assign(matches,{
    g1:{team1:'הולנד',team2:'שוודיה',date:ago(30*60000),group:'A',stage:'group',live:{team1Goals:1,team2Goals:0,status:'IN_PLAY',updatedAt:Date.now()-60000,minute:30}},
    g2:{team1:'ברזיל',team2:'ספרד',date:ago(30*60000),group:'B',stage:'group',live:{team1Goals:2,team2Goals:1,status:'IN_PLAY',updatedAt:Date.now()-60000,minute:30}},
  });
  Object.assign(groupMembers,{u1:{name:'A',totalPoints:10},u2:{name:'B',totalPoints:10}});
  Object.assign(groupUsersCache,groupMembers);
  Object.assign(allGroupBets,{
    u1:{g1:{team1Goals:1,team2Goals:0},g2:{team1Goals:0,team2Goals:0}}, // +4 in g1, 0 in g2 -> 14
    u2:{g1:{team1Goals:0,team2Goals:0},g2:{team1Goals:2,team2Goals:1}}, // 0 in g1, +4 in g2 -> 14
  });
  window.activeTournament='worldcup2026';window.stageFilter='all';renderLive();
  const cards=[...document.querySelectorAll('.live-card')];
  const totalsOf=c=>[...c.querySelectorAll('.live-lb-total')].map(e=>e.textContent).join(',');
  const sameTotals = cards.length===2 && totalsOf(cards[0])===totalsOf(cards[1]);
  // both u1 and u2 should project to 14 (10 + their one +4)
  const has14 = totalsOf(cards[0]).split(',').filter(x=>x==='14').length===2;
  // pills differ between the two cards (each shows its own game's contribution)
  const pills=c=>[...c.querySelectorAll('.live-lb-pill')].map(e=>e.textContent).join(',');
  const pillsDiffer = cards.length===2 && pills(cards[0])!==pills(cards[1]);
  document.title='CARDS:'+cards.length+' SAME_TOTALS:'+sameTotals+' BOTH14:'+has14+' PILLS_DIFFER:'+pillsDiffer;
</script></body>
```

- [ ] **Step 6: Render the harness and verify**

Run:
```bash
CHROME=$(ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
"$CHROME" --headless --disable-gpu --dump-dom "file://$PWD/tests/manual/live-accumulate-harness.html" 2>/dev/null | grep -oE '<title>[^<]*</title>'
```
Expected: `<title>CARDS:2 SAME_TOTALS:true BOTH14:true PILLS_DIFFER:true</title>` (both cards show identical combined totals — u1 and u2 each at 14 — while their per-game pills differ).

- [ ] **Step 7: Bump cache-busting versions**

Run: `sed -i '' 's/20260623a/20260624a/g' index.html && grep -c '20260624a' index.html`
Expected: `6`.

- [ ] **Step 8: Full unit run (no regressions)**

Run: `node --test tests/pure-logic.test.js tests/results-core.test.mjs tests/paul-core.test.mjs tests/poll-interval.test.mjs`
Expected: PASS (all suites).

- [ ] **Step 9: Commit**

```bash
git add app.js index.html tests/manual/live-accumulate-harness.html
git commit -m "feat: live cards share combined standings across concurrent games"
```

---

## Notes for the implementer

- Single live game: `projectedTotal` equals the old `baseOf + matchOf`, so the one-game view is byte-for-byte unchanged.
- Keep `matchOf` per-card (it drives the +N pill / pill color and the pick column); only the **total column, ordering, and arrows** come from `ctx`.
- The `delta`/`chg`/medal/pill code in the rows is unchanged — only the iterator (`orderedUids`) and `total` source change.
- Frontend-only; no backend or data change beyond the cache-bust bump.
