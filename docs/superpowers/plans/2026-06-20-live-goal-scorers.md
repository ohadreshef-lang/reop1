# Live Goal Scorers + Minutes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each goal's scorer and minute in the Live tab card (two columns under the score) while staying within the API-Football free 100/day quota.

**Architecture:** A new pure parser (`parseGoalEvents`) maps API-Football goal events to a per-team scorer list. `mapApiFootballLive` is enriched to expose the matched fixture id, home-team name, home/team1 orientation, and any inline events. The updater fetches `/fixtures/events` only when a match's goal total changes (preferring inline events from `live=all` when present), parses them, and `buildResultUpdates` writes the `scorers` array into the live node. The frontend renders two scorer columns under the score.

**Tech Stack:** Vanilla ES modules (`scripts/lib/*.mjs`, Node `node --test`); classic-script browser JS (`app.js`, `i18n.js`, `styles.css`); Firebase RTDB.

## Global Constraints

- API-Football free tier = 100 requests/day. Events are fetched **only when a live match's goal total changed** vs the stored `matches/{id}/live` node (prefer inline `f.events` from `live=all` to avoid a call entirely). Every API call is best-effort: on non-OK / 429 / `errors` payload / throw, return `[]` and never break the run.
- Goal event = `e.type === 'Goal'` AND `e.detail !== 'Missed Penalty'`. `kind`: `'pen'` if `detail === 'Penalty'`, `'og'` if `detail === 'Own Goal'`, else `'goal'`. Own goals count for the **opposing** team.
- Scorer object shape: `{ team: 1|2, player: string, minute: number|null, extra: number|null, kind: 'goal'|'pen'|'og' }`, ordered by `minute` then `extra` ascending.
- Live node shape becomes: `{ team1Goals, team2Goals, status, updatedAt, minute, extra, scorers }` (`scorers` defaults `[]`).
- Scorers are live-only (the live node is cleared when football-data.org finalizes the match — unchanged behavior).
- i18n marks: `live.penaltyMark` = he `'(פנדל)'` / en `'(pen)'` / es `'(pen)'`; `live.ownGoalMark` = he `'(ש.ע)'` / en `'(OG)'` / es `'(a.p.)'`.
- Player names are shown as the API provides (Latin), HTML-escaped. Not translated.
- Tests run with bare `node --test tests/<file>` (NOT `node --test tests/`).
- Cache-busting: bump every `?v=` string in `index.html` (currently `20260620f`).

---

### Task 1: `parseGoalEvents` pure parser

**Files:**
- Modify: `scripts/lib/results-core.mjs` (add one exported function; uses the existing module-local `normAf`)
- Test: `tests/results-core.test.mjs` (add a `parseGoalEvents` test block)

**Interfaces:**
- Consumes: the module-local `normAf(name)` (already defined at `results-core.mjs:82`).
- Produces: `parseGoalEvents(apiEvents, { homeName, homeIsT1 }): Array<{team:1|2, player:string, minute:number|null, extra:number|null, kind:'goal'|'pen'|'og'}>`

- [ ] **Step 1: Write the failing tests**

Append to `tests/results-core.test.mjs`:

```js
// --- parseGoalEvents (API-Football goal events -> scorer list) -------------

import { parseGoalEvents } from '../scripts/lib/results-core.mjs';

const goalEv = (detail, teamName, player, elapsed, extra = null) => ({
  type: 'Goal', detail, team: { name: teamName }, player: { name: player }, time: { elapsed, extra },
});

test('parseGoalEvents: normal goal -> scoring team, minute, kind goal', () => {
  const out = parseGoalEvents([goalEv('Normal Goal', 'Netherlands', 'Brobbey', 5)],
    { homeName: 'Netherlands', homeIsT1: true });
  assert.deepEqual(out, [{ team: 1, player: 'Brobbey', minute: 5, extra: null, kind: 'goal' }]);
});

test('parseGoalEvents: penalty -> kind pen; missed penalty excluded', () => {
  const out = parseGoalEvents([
    goalEv('Penalty', 'Netherlands', 'Depay', 60),
    goalEv('Missed Penalty', 'Netherlands', 'Depay', 70),
  ], { homeName: 'Netherlands', homeIsT1: true });
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'pen');
  assert.equal(out[0].player, 'Depay');
});

test('parseGoalEvents: own goal counts for the opposing team, kind og', () => {
  // Home = Netherlands (team1). A Sweden player own-goals -> counts for Netherlands (team1).
  const out = parseGoalEvents([goalEv('Own Goal', 'Sweden', 'Lindelof', 80)],
    { homeName: 'Netherlands', homeIsT1: true });
  assert.deepEqual(out, [{ team: 1, player: 'Lindelof', minute: 80, extra: null, kind: 'og' }]);
});

test('parseGoalEvents: away orientation (homeIsT1 false) flips team numbers', () => {
  // Home side scores but home is our team2.
  const out = parseGoalEvents([goalEv('Normal Goal', 'Sweden', 'Gyokeres', 10)],
    { homeName: 'Sweden', homeIsT1: false });
  assert.equal(out[0].team, 2);
});

test('parseGoalEvents: stoppage captured and sorted by minute then extra', () => {
  const out = parseGoalEvents([
    goalEv('Normal Goal', 'Netherlands', 'C', 45, 2),
    goalEv('Normal Goal', 'Netherlands', 'B', 45),
    goalEv('Normal Goal', 'Netherlands', 'A', 10),
  ], { homeName: 'Netherlands', homeIsT1: true });
  assert.deepEqual(out.map(s => s.player), ['A', 'B', 'C']);
  assert.equal(out[2].extra, 2);
});

test('parseGoalEvents: malformed/non-goal events skipped, never throws', () => {
  const out = parseGoalEvents([
    null,
    { type: 'Card', detail: 'Yellow Card', team: { name: 'Netherlands' }, player: { name: 'X' }, time: { elapsed: 5 } },
    { type: 'Goal', detail: 'Normal Goal', team: { name: 'Netherlands' }, time: { elapsed: 5 } }, // no player
  ], { homeName: 'Netherlands', homeIsT1: true });
  assert.deepEqual(out, []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/results-core.test.mjs`
Expected: FAIL — `parseGoalEvents` is not exported (import error or "not a function").

- [ ] **Step 3: Implement `parseGoalEvents`**

In `scripts/lib/results-core.mjs`, add this exported function (place it directly after the `mapApiFootballLive` function so it sits next to the other API-Football logic and can use the module-local `normAf`):

```js
// Map API-Football goal events to our scorer list. Pure. Keeps real goals (incl.
// penalties), drops missed penalties, attributes own goals to the opposing team, and
// returns them time-ordered. `homeName` is the API home-team name; `homeIsT1` says
// whether the API home side is our team1.
export function parseGoalEvents(apiEvents, { homeName, homeIsT1 }) {
    const out = [];
    for (const e of (apiEvents || [])) {
        if (!e || e.type !== 'Goal') continue;
        const detail = e.detail || '';
        if (detail === 'Missed Penalty') continue;
        const player = e.player && e.player.name;
        if (!player) continue;
        const time = e.time || {};
        const minute = typeof time.elapsed === 'number' ? time.elapsed : null;
        const extra = typeof time.extra === 'number' ? time.extra : null;
        const kind = detail === 'Penalty' ? 'pen' : detail === 'Own Goal' ? 'og' : 'goal';
        const eventIsHome = normAf(e.team && e.team.name) === normAf(homeName);
        let team = eventIsHome ? (homeIsT1 ? 1 : 2) : (homeIsT1 ? 2 : 1);
        if (kind === 'og') team = team === 1 ? 2 : 1; // own goal counts for the opponent
        out.push({ team, player, minute, extra, kind });
    }
    out.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0) || (a.extra ?? 0) - (b.extra ?? 0));
    return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/results-core.test.mjs`
Expected: PASS (existing tests + the 6 new ones).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/results-core.mjs tests/results-core.test.mjs
git commit -m "feat: parseGoalEvents — map API-Football goal events to scorer list"
```

---

### Task 2: Enrich `mapApiFootballLive` + write `scorers` in `buildResultUpdates`

**Files:**
- Modify: `scripts/lib/results-core.mjs` (`mapApiFootballLive` push at ~line 125; `buildResultUpdates` live loop at ~line 192-195)
- Test: `tests/results-core.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `mapApiFootballLive` entries now also carry `fixtureId`, `homeName`, `homeIsT1`, `inlineEvents` (array or `null`).
  - `buildResultUpdates` writes `scorers` (array, default `[]`) into `matches/{id}/live`, consuming `scorers` from each live entry.

- [ ] **Step 1: Write the failing tests**

Append to `tests/results-core.test.mjs`:

```js
test('mapApiFootballLive: entry exposes fixtureId, homeName, homeIsT1, inlineEvents', () => {
  const f = afFixture('Ghana', 'Panama', 1, 0, '1H');
  f.fixture.id = 4242;
  f.events = [{ type: 'Goal', detail: 'Normal Goal', team: { name: 'Ghana' }, player: { name: 'Z' }, time: { elapsed: 8 } }];
  const live = mapApiFootballLive({ matches: afMatches, apiFixtures: [f], now: afNow });
  assert.equal(live.length, 1);
  assert.equal(live[0].fixtureId, 4242);
  assert.equal(live[0].homeName, 'Ghana');
  assert.equal(live[0].homeIsT1, true);       // Ghana is team1 in afMatches.m_live
  assert.equal(live[0].inlineEvents.length, 1);
});

test('mapApiFootballLive: no events array -> inlineEvents null', () => {
  const live = mapApiFootballLive({ matches: afMatches, apiFixtures: [afFixture('Ghana', 'Panama', 0, 0, '1H')], now: afNow });
  assert.equal(live[0].inlineEvents, null);
});

test('buildResultUpdates: live node includes scorers (passed through; default [])', () => {
  const now = 1750000000000;
  const withScorers = [{ matchId: 'm_live', m: { team1: 'גאנה', team2: 'פנמה' }, g1: 1, g2: 0, status: 'IN_PLAY',
    scorers: [{ team: 1, player: 'Z', minute: 8, extra: null, kind: 'goal' }] }];
  const u1 = buildResultUpdates({ finished: [], live: withScorers, groups: {}, bets: {}, specialBets: {}, now });
  assert.deepEqual(u1['matches/m_live/live'].scorers, [{ team: 1, player: 'Z', minute: 8, extra: null, kind: 'goal' }]);

  const noScorers = [{ matchId: 'm_live', m: { team1: 'גאנה', team2: 'פנמה' }, g1: 0, g2: 0, status: 'IN_PLAY' }];
  const u2 = buildResultUpdates({ finished: [], live: noScorers, groups: {}, bets: {}, specialBets: {}, now });
  assert.deepEqual(u2['matches/m_live/live'].scorers, []);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/results-core.test.mjs`
Expected: FAIL — entries lack `fixtureId`/`homeName`/`homeIsT1`/`inlineEvents`; live node lacks `scorers`.

- [ ] **Step 3: Enrich the `mapApiFootballLive` push**

In `scripts/lib/results-core.mjs`, replace the push line (currently `live.push({ matchId, m, g1, g2, status, minute, extra });`, ~line 125) with:

```js
        const inlineEvents = Array.isArray(f.events) ? f.events : null;
        live.push({ matchId, m, g1, g2, status, minute, extra,
            fixtureId: f.fixture && f.fixture.id, homeName: f.teams.home.name, homeIsT1, inlineEvents });
```

- [ ] **Step 4: Write `scorers` in `buildResultUpdates`**

In `scripts/lib/results-core.mjs`, replace the live loop (currently):

```js
    for (const { matchId, g1, g2, status, minute, extra } of live) {
        updates[`matches/${matchId}/live`] = { team1Goals: g1, team2Goals: g2, status, updatedAt: now, minute: minute == null ? null : minute, extra: extra == null ? null : extra };
    }
```

with:

```js
    for (const { matchId, g1, g2, status, minute, extra, scorers } of live) {
        updates[`matches/${matchId}/live`] = { team1Goals: g1, team2Goals: g2, status, updatedAt: now, minute: minute == null ? null : minute, extra: extra == null ? null : extra, scorers: Array.isArray(scorers) ? scorers : [] };
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/results-core.test.mjs`
Expected: PASS (all, including the 3 new tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/results-core.mjs tests/results-core.test.mjs
git commit -m "feat: expose fixtureId/home info on live entries; write scorers to live node"
```

---

### Task 3: Updater wiring — fetch events only on goal change

**Files:**
- Modify: `scripts/update-results.mjs` (import line ~19; live block in `main()` ~line 188-196; new `fetchApiFootballEvents` helper)

**Interfaces:**
- Consumes: `parseGoalEvents` from `./lib/results-core.mjs`; existing `AF_KEY`, `mapApiFootballLive`, and the live entries' new `fixtureId`/`homeName`/`homeIsT1`/`inlineEvents` fields.
- Produces: each live entry gets a `scorers` array before `buildResultUpdates` runs (terminal I/O wiring).

**Why:** events are cumulative, so one fetch rebuilds the full list. Fetch only when the goal total changed (or the stored list is incomplete), and prefer inline `live=all` events to avoid a call. This bounds event calls to ≈1 per goal.

- [ ] **Step 1: Add `parseGoalEvents` to the results-core import**

In `scripts/update-results.mjs`, change the import (line ~19):

```js
import { classifyMatches, buildResultUpdates, mapApiFootballLive, parseMatchDate } from './lib/results-core.mjs';
```

to:

```js
import { classifyMatches, buildResultUpdates, mapApiFootballLive, parseMatchDate, parseGoalEvents } from './lib/results-core.mjs';
```

- [ ] **Step 2: Add the `fetchApiFootballEvents` helper**

Add this function next to `fetchApiFootballLive` in `scripts/update-results.mjs`:

```js
// Goal events for one fixture (scorers + minutes). Best-effort, single attempt, same
// quota-graceful contract as fetchApiFootballLive: any failure -> [] (scorers stay
// empty; score/finals unaffected).
async function fetchApiFootballEvents(fixtureId) {
    if (!fixtureId) return [];
    try {
        const res = await fetch(`https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`, {
            headers: { 'x-apisports-key': AF_KEY },
        });
        if (!res.ok) {
            console.warn(`API-Football events unavailable (HTTP ${res.status}) for fixture ${fixtureId} — scorers skipped.`);
            return [];
        }
        const json = await res.json();
        const errs = json.errors;
        if (errs && ((Array.isArray(errs) && errs.length) || (typeof errs === 'object' && Object.keys(errs).length))) {
            console.warn('API-Football events limit/error — scorers skipped:', JSON.stringify(errs));
            return [];
        }
        return json.response || [];
    } catch (err) {
        console.warn(`API-Football events fetch failed for fixture ${fixtureId} (scorers skipped):`, err.message);
        return [];
    }
}
```

- [ ] **Step 3: Enrich live entries with scorers**

In `main()`, find the live block (currently):

```js
    let live = [];
    if (AF_KEY) {
        const apiFixtures = await fetchApiFootballLive();
        live = mapApiFootballLive({ matches, apiFixtures, now, inPlayWindowMs: 3 * 3600 * 1000 });
    } else {
        console.warn('FOOTBALL_API_KEY not set — skipping live scores.');
    }
```

Replace it with (adds the scorer-enrichment loop inside the `if (AF_KEY)` branch):

```js
    let live = [];
    if (AF_KEY) {
        const apiFixtures = await fetchApiFootballLive();
        live = mapApiFootballLive({ matches, apiFixtures, now, inPlayWindowMs: 3 * 3600 * 1000 });
        for (const entry of live) {
            const prev = entry.m.live;
            const prevScorers = (prev && Array.isArray(prev.scorers)) ? prev.scorers : [];
            const prevTotal = (prev && prev.team1Goals != null ? prev.team1Goals : 0)
                            + (prev && prev.team2Goals != null ? prev.team2Goals : 0);
            const newTotal = entry.g1 + entry.g2;
            // No new goal and the stored list is already complete -> reuse, no call.
            if (newTotal === 0 || (newTotal === prevTotal && prevScorers.length === newTotal)) {
                entry.scorers = prevScorers;
                continue;
            }
            // Prefer inline events from live=all (no extra call); fall back to a single
            // /fixtures/events call only if inline didn't yield enough goals.
            const opts = { homeName: entry.homeName, homeIsT1: entry.homeIsT1 };
            let scorers = entry.inlineEvents && entry.inlineEvents.length ? parseGoalEvents(entry.inlineEvents, opts) : [];
            if (scorers.length < newTotal && entry.fixtureId) {
                scorers = parseGoalEvents(await fetchApiFootballEvents(entry.fixtureId), opts);
            }
            entry.scorers = scorers;
        }
    } else {
        console.warn('FOOTBALL_API_KEY not set — skipping live scores.');
    }
```

- [ ] **Step 4: Syntax-check both modules**

Run: `node --check scripts/lib/results-core.mjs && node --check scripts/update-results.mjs`
Expected: no output, exit 0.

- [ ] **Step 5: Run the updater test suite (no regressions)**

Run: `node --test tests/results-core.test.mjs tests/paul-core.test.mjs`
Expected: PASS.

> Note: a full end-to-end run needs the CI-only `FOOTBALL_API_KEY` secret, so it can't run locally. Verification is `node --check` + the pure unit tests (the scorer logic is fully covered by Task 1). This task is thin I/O glue, matching the existing untested-wrapper pattern of `update-results.mjs`.

- [ ] **Step 6: Commit**

```bash
git add scripts/update-results.mjs
git commit -m "feat: fetch goal events only on goal change (prefer inline), attach scorers"
```

---

### Task 4: Frontend — render scorer columns

**Files:**
- Modify: `app.js` (add top-level `scorerLine`; render `.live-scorers` in `buildLiveCard` between `.live-scoreline` and `.live-people`)
- Modify: `i18n.js` (add `live.penaltyMark` + `live.ownGoalMark` after each `'live.notStarted'`: lines ~126, ~420, ~703)
- Modify: `styles.css` (add `.live-scorers` rules)
- Modify: `index.html` (bump `20260620f` → `20260620g`)
- Test: `tests/pure-logic.test.js` (add `scorerLine` test)
- Test: `tests/manual/live-scorers-harness.html` (headless verification)

**Interfaces:**
- Consumes: `escapeHtml`, `t` (existing in `app.js`); the live node's `scorers` array.
- Produces: `scorerLine(s): string` (HTML for one scorer; leaks onto the test sandbox as a function declaration).

- [ ] **Step 1: Write the failing test**

In `tests/pure-logic.test.js`, add after the `memberLabel` tests:

```js
// --- scorerLine ------------------------------------------------------------

test('scorerLine: goal shows minute + escaped name, no mark', () => {
    const html = app.scorerLine({ team: 1, player: 'Brobbey', minute: 5, extra: null, kind: 'goal' });
    assert.match(html, /⚽/);
    assert.match(html, /5'/);
    assert.match(html, /Brobbey/);
    assert.doesNotMatch(html, /penaltyMark|ownGoalMark/);
});

test('scorerLine: stoppage minute formatted as N+M', () => {
    assert.match(app.scorerLine({ team: 1, player: 'X', minute: 45, extra: 2, kind: 'goal' }), /45\+2'/);
});

test('scorerLine: penalty and own-goal marks via i18n', () => {
    assert.match(app.scorerLine({ team: 1, player: 'X', minute: 60, extra: null, kind: 'pen' }), /live\.penaltyMark/);
    assert.match(app.scorerLine({ team: 2, player: 'Y', minute: 80, extra: null, kind: 'og' }), /live\.ownGoalMark/);
});

test('scorerLine: escapes player name', () => {
    assert.match(app.scorerLine({ team: 1, player: 'A & B', minute: 1, extra: null, kind: 'goal' }), /A &amp; B/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/pure-logic.test.js`
Expected: FAIL — `app.scorerLine is not a function`.

- [ ] **Step 3: Add `scorerLine` to `app.js`**

In `app.js`, directly below the `memberLabel` function, add:

```js
// One scorer line for the live card: "⚽ <minute> <name>" with a penalty/own-goal mark.
// Returns markup, so callers insert it directly.
function scorerLine(s) {
    const min = typeof s.minute === 'number'
        ? (typeof s.extra === 'number' && s.extra > 0 ? `${s.minute}+${s.extra}'` : `${s.minute}'`)
        : '';
    const mark = s.kind === 'pen' ? ` ${t('live.penaltyMark')}` : s.kind === 'og' ? ` ${t('live.ownGoalMark')}` : '';
    return `<div class="live-scorer">⚽ <span class="live-scorer-min">${min}</span> ${escapeHtml(s.player)}${mark}</div>`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/pure-logic.test.js`
Expected: PASS.

- [ ] **Step 5: Render the scorer columns in `buildLiveCard`**

In `app.js` `buildLiveCard`, just after the `const scoreHtml = …` block (before the projected-leaderboard section), add:

```js
    const scorers = (live && Array.isArray(live.scorers)) ? live.scorers : [];
    const scorersCol = team => scorers.filter(s => s.team === team).map(scorerLine).join('');
    const scorersHtml = scorers.length
        ? `<div class="live-scorers"><div class="live-scorers-col">${scorersCol(1)}</div><div class="live-scorers-col">${scorersCol(2)}</div></div>`
        : '';
```

Then, in the card's returned template, insert `${scorersHtml}` immediately after the closing `</div>` of `.live-scoreline` and before `<div class="live-people">`:

```js
        </div>
        ${scorersHtml}
        <div class="live-people">
```

- [ ] **Step 6: Add the i18n marks in all three languages**

In `i18n.js`, after the Hebrew `'live.notStarted': 'טרם החל',` (line ~126) add:

```js
        'live.penaltyMark': '(פנדל)',
        'live.ownGoalMark': '(ש.ע)',
```

After the English `'live.notStarted': 'Not started',` (line ~420) add:

```js
        'live.penaltyMark': '(pen)',
        'live.ownGoalMark': '(OG)',
```

After the Spanish `'live.notStarted': 'No empezó',` (line ~703) add:

```js
        'live.penaltyMark': '(pen)',
        'live.ownGoalMark': '(a.p.)',
```

- [ ] **Step 7: Add the CSS**

In `styles.css`, after the `.live-scoreline` rule block, add:

```css
.live-scorers { display:flex; gap:12px; padding:2px 16px 10px; }
.live-scorers-col { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
.live-scorers-col:first-child { text-align:right; }
.live-scorers-col:last-child { text-align:left; }
.live-scorer { font-size:0.82em; color:#5b6b62; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.live-scorer-min { font-weight:700; color:#1a4731; direction:ltr; display:inline-block; }
```

- [ ] **Step 8: Create the headless harness**

Create `tests/manual/live-scorers-harness.html`:

```html
<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="../../styles.css">
<body style="direction:rtl">
<div id="tab-live" class="tab-panel active"><div id="live-container" class="app-content"></div></div>
<script>window.firebase=undefined;window.db=null;window.currentUser={userId:'u1'};
window.t=k=>({'live.statusLive':'משחק חי','live.notStarted':'טרם החל','live.total':'סה"כ','leaderboard.meTag':'אני','groupSettings.unknownUser':'?','live.empty':'אין'}[k]||k);
window.translateTeam=n=>n;window.currentLang='he';</script>
<script src="../../app.js?cb=1"></script>
<script>
  const ago=ms=>new Date(Date.now()-ms).toISOString().slice(0,16);
  Object.assign(matches,{g:{team1:'הולנד',team2:'שוודיה',date:ago(23*60000),group:'D',stage:'group',
    live:{team1Goals:2,team2Goals:1,status:'IN_PLAY',updatedAt:Date.now()-60000,minute:80,
      scorers:[{team:1,player:'Brobbey',minute:5,extra:null,kind:'goal'},
               {team:1,player:'Depay',minute:60,extra:null,kind:'pen'},
               {team:2,player:'Lindelof',minute:80,extra:null,kind:'og'}]}}});
  Object.assign(groupMembers,{u1:{name:'shay',totalPoints:10}});
  Object.assign(groupUsersCache,groupMembers);
  window.activeTournament='worldcup2026';window.stageFilter='all';renderLive();
  const h=document.querySelector('#live-container').innerHTML;
  document.title='SCORERS:'+h.includes('live-scorers')+' EMOJI:'+h.includes('⚽')
    +' PEN:'+h.includes('live.penaltyMark')+' OG:'+h.includes('live.ownGoalMark')+' NAME:'+h.includes('Brobbey');
</script></body>
```

- [ ] **Step 9: Render headless and verify**

Run:
```bash
CHROME=$(ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
"$CHROME" --headless --disable-gpu --dump-dom "file://$PWD/tests/manual/live-scorers-harness.html" 2>/dev/null | grep -oE '<title>[^<]*</title>'
```
Expected: `<title>SCORERS:true EMOJI:true PEN:true OG:true NAME:true</title>`.

- [ ] **Step 10: Bump cache-busting versions**

Run: `sed -i '' 's/20260620f/20260620g/g' index.html && grep -c '20260620g' index.html`
Expected: `6`.

- [ ] **Step 11: Final full test run**

Run: `node --test tests/pure-logic.test.js tests/results-core.test.mjs tests/paul-core.test.mjs`
Expected: PASS (all suites).

- [ ] **Step 12: Commit**

```bash
git add app.js i18n.js styles.css index.html tests/pure-logic.test.js tests/manual/live-scorers-harness.html
git commit -m "feat: render goal scorers + minutes in the live card"
```

---

## Notes for the implementer

- Keep every API call best-effort (return `[]` on any failure). Never let a scorer fetch break the live/finals flow.
- Do not fetch events when the goal total is unchanged and the stored scorer list is already complete — that is the quota guard.
- The DB requires auth and the API key is CI-only; you cannot run the updater end-to-end locally. Rely on the unit tests + `node --check`.
- Scorers are intentionally live-only; do not try to persist them past the official final result.
- After merge + deploy, the next live match will populate scorers; verify on `mondial.guru` that the Live card shows ⚽ minute + name under each team.
