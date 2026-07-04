# ESPN Live-Score Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the live in-play score source (API-Football, account keeps getting suspended) with ESPN's keyless public scoreboard API — no key, no quota, nothing to suspend. Finals + points stay on football-data.org.

**Architecture:** Add pure ESPN mappers to `results-core.mjs` that emit the SAME `live` entry shape the updater already consumes, so `buildResultUpdates` and the Firebase live-node shape are unchanged. Swap the updater's fetch/orchestration from API-Football to ESPN. Backend/updater-only — no frontend change, no cache bump.

**Tech Stack:** Node ESM (`scripts/lib/results-core.mjs`, `scripts/update-results.mjs`), `node --test`, GitHub Actions.

## Global Constraints

- **Live-entry contract (unchanged):** `mapEspnLive` returns `[{matchId, m, g1, g2, status, minute, extra, espnEventId, homeName, homeIsT1}]`; `status` ∈ `{'IN_PLAY','PAUSED','FT'}`. Scorer shape (unchanged): `{team:1|2, player, minute, extra, kind:'goal'|'pen'|'og'}`.
- **ESPN endpoints (keyless):** scoreboard `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard`; summary `…/summary?event={id}`.
- **Team matching:** reuse `norm` + `HEB_TO_EN`. Add 3 `API_ALIASES`: `'united states'→'usa'`, `'congo dr'→'dr congo'`, `'bosnia-herzegovina'→'bosnia and herzegovina'`.
- **ESPN-only — no API-Football fallback.** Remove all API-Football live code and the `FOOTBALL_API_KEY` dependency.
- Pure functions (`mapEspnLive`, `parseEspnGoals`, `espnMinute`) live in `results-core.mjs` and are exported; fetchers live in `update-results.mjs`.
- Tests run with bare `node --test tests/results-core.test.mjs`.
- football-data.org finals path (`classifyMatches`, `buildResultUpdates`) is UNCHANGED.
- No `app.js`/`i18n.js`/`index.html` edits; no cache-version bump.

---

### Task 1: ESPN pure mappers in `results-core.mjs`

**Files:**
- Modify: `scripts/lib/results-core.mjs`
- Test: `tests/results-core.test.mjs`

**Interfaces:**
- Produces: `espnMinute(displayClock)→{minute,extra}`, `mapEspnLive({matches,espnEvents,now,inPlayWindowMs})→[entry]`, `parseEspnGoals(keyEvents,{homeName,homeIsT1})→[scorer]`. Removes `mapApiFootballLive`, `parseGoalEvents`.

- [ ] **Step 1: Write the failing tests**

In `tests/results-core.test.mjs`: update the import to add the new names, and **remove** the existing `mapApiFootballLive` and `parseGoalEvents` test blocks (search for `mapApiFootballLive(` and `parseGoalEvents(` and delete those `test(...)` blocks). Add this block:

```js
// --- ESPN live mapping -----------------------------------------------------

const espnEvent = (homeName, awayName, hs, as, state, opts = {}) => ({
  id: opts.id || '900', date: opts.date || '2026-06-29T17:00Z',
  competitions: [{
    status: { type: { state, completed: state === 'post', detail: opts.detail || '', shortDetail: opts.shortDetail || '' }, displayClock: opts.displayClock || "41'", period: 1 },
    competitors: [
      { homeAway: 'home', score: String(hs), team: { displayName: homeName } },
      { homeAway: 'away', score: String(as), team: { displayName: awayName } },
    ],
  }],
});

test('espnMinute parses the display clock', () => {
  assert.deepEqual(espnMinute("29'"), { minute: 29, extra: null });
  assert.deepEqual(espnMinute("45'+2'"), { minute: 45, extra: 2 });
  assert.deepEqual(espnMinute(""), { minute: null, extra: null });
});

test('mapEspnLive: in-play event -> entry with score/status/minute', () => {
  const now = Date.parse('2026-06-29T17:41:00Z');
  const matches = { m1: { team1: 'ברזיל', team2: 'יפן', date: '2026-06-29T17:00' } };
  const live = mapEspnLive({ matches, espnEvents: [espnEvent('Brazil', 'Japan', 0, 1, 'in', { displayClock: "41'" })], now });
  assert.equal(live.length, 1);
  assert.equal(live[0].g1, 0); assert.equal(live[0].g2, 1);
  assert.equal(live[0].status, 'IN_PLAY'); assert.equal(live[0].minute, 41);
  assert.equal(live[0].homeIsT1, true); assert.equal(live[0].espnEventId, '900');
});

test('mapEspnLive: orientation when our team1 is the ESPN away side', () => {
  const now = Date.parse('2026-06-29T17:41:00Z');
  const matches = { m1: { team1: 'יפן', team2: 'ברזיל', date: '2026-06-29T17:00' } };
  const live = mapEspnLive({ matches, espnEvents: [espnEvent('Brazil', 'Japan', 0, 1, 'in')], now });
  assert.equal(live[0].g1, 1); assert.equal(live[0].g2, 0); assert.equal(live[0].homeIsT1, false);
});

test('mapEspnLive: halftime -> PAUSED, post -> FT, pre -> ignored', () => {
  const now = Date.parse('2026-06-29T17:41:00Z');
  const m = { m1: { team1: 'ברזיל', team2: 'יפן', date: '2026-06-29T17:00' } };
  assert.equal(mapEspnLive({ matches: m, espnEvents: [espnEvent('Brazil', 'Japan', 0, 1, 'in', { detail: 'Halftime' })], now })[0].status, 'PAUSED');
  assert.equal(mapEspnLive({ matches: m, espnEvents: [espnEvent('Brazil', 'Japan', 0, 1, 'post')], now })[0].status, 'FT');
  assert.equal(mapEspnLive({ matches: m, espnEvents: [espnEvent('Brazil', 'Japan', 0, 0, 'pre')], now }).length, 0);
});

test('mapEspnLive: alias teams resolve (United States / Bosnia-Herzegovina)', () => {
  const now = Date.parse('2026-07-02T00:30:00Z');
  const matches = { m1: { team1: 'ארצות הברית', team2: 'בוסניה והרצגובינה', date: '2026-07-02T00:00' } };
  const live = mapEspnLive({ matches, espnEvents: [espnEvent('United States', 'Bosnia-Herzegovina', 1, 0, 'in', { date: '2026-07-02T00:00Z' })], now });
  assert.equal(live.length, 1); assert.equal(live[0].g1, 1);
});

test('parseEspnGoals: structured goal -> scorer; non-goal and shootout ignored', () => {
  const keyEvents = [
    { scoringPlay: true, shootout: false, type: { type: 'goal', text: 'Goal' }, clock: { displayValue: "29'" }, team: { displayName: 'Japan' }, participants: [{ athlete: { displayName: 'Kaishu Sano' } }], text: 'Goal! Brazil 0, Japan 1. Kaishu Sano (Japan)...' },
    { scoringPlay: false, type: { type: 'yellow-card', text: 'Yellow Card' }, team: { displayName: 'Brazil' } },
    { scoringPlay: true, shootout: true, type: { type: 'goal' }, clock: { displayValue: "0'" }, team: { displayName: 'Brazil' }, participants: [{ athlete: { displayName: 'X' } }] },
  ];
  const goals = parseEspnGoals(keyEvents, { homeName: 'Brazil', homeIsT1: true });
  assert.equal(goals.length, 1);
  assert.deepEqual(goals[0], { team: 2, player: 'Kaishu Sano', minute: 29, extra: null, kind: 'goal' });
});

test('parseEspnGoals: penalty and own-goal kinds', () => {
  const keyEvents = [
    { scoringPlay: true, type: { type: 'goal', text: 'Penalty - Scored' }, clock: { displayValue: "55'" }, team: { displayName: 'Brazil' }, participants: [{ athlete: { displayName: 'P' } }], text: 'Penalty! converts the penalty' },
    { scoringPlay: true, type: { type: 'own-goal', text: 'Own Goal' }, clock: { displayValue: "70'" }, team: { displayName: 'Brazil' }, participants: [{ athlete: { displayName: 'O' } }], text: 'Own Goal!' },
  ];
  const goals = parseEspnGoals(keyEvents, { homeName: 'Brazil', homeIsT1: true });
  assert.equal(goals.find(g => g.player === 'P').kind, 'pen');
  assert.equal(goals.find(g => g.player === 'O').kind, 'og');
});
```

Update the import line at the top of `tests/results-core.test.mjs` to include `espnMinute, mapEspnLive, parseEspnGoals` and drop `mapApiFootballLive, parseGoalEvents` (keep `classifyMatches, buildResultUpdates, parseMatchDate, calcPoints, isKnockoutStage`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/results-core.test.mjs`
Expected: FAIL — `espnMinute`/`mapEspnLive`/`parseEspnGoals` are not exported.

- [ ] **Step 3: Add the 3 ESPN name aliases**

Find the `API_ALIASES` object in `scripts/lib/results-core.mjs` and add these entries (keep existing ones):

```js
    'united states': 'usa',
    'congo dr': 'dr congo',
    'bosnia-herzegovina': 'bosnia and herzegovina',
```

- [ ] **Step 4: Add the ESPN pure functions**

Add to `scripts/lib/results-core.mjs` (near the old live mappers):

```js
// Parse an ESPN displayClock ("29'", "45'+2'") to {minute, extra}.
export function espnMinute(displayClock) {
    const s = String(displayClock || '').replace(/'/g, '').trim();
    if (!s) return { minute: null, extra: null };
    const [base, plus] = s.split('+');
    const minute = parseInt(base, 10);
    const extra = plus != null ? parseInt(plus, 10) : null;
    return { minute: Number.isNaN(minute) ? null : minute, extra: (extra == null || Number.isNaN(extra)) ? null : extra };
}

// Map ESPN scoreboard events to our live entries. Pure. One DB match -> a single ESPN event
// by team pair (norm/HEB_TO_EN) within ±36h of kickoff, in a live-or-just-finished state.
export function mapEspnLive({ matches, espnEvents, now, inPlayWindowMs = 3 * 3600 * 1000 }) {
    const out = [];
    for (const [matchId, m] of Object.entries(matches || {})) {
        if (!m || !m.team1 || !m.team2 || !m.date) continue;
        if (m.result && m.result.team1Goals !== undefined) continue;
        const en1 = HEB_TO_EN[m.team1], en2 = HEB_TO_EN[m.team2];
        if (!en1 || !en2) continue;
        const t1 = norm(en1), t2 = norm(en2);
        const kickoff = parseMatchDate(m.date);
        const hits = (espnEvents || []).filter(e => {
            const comp = (e.competitions || [])[0] || {};
            const state = comp.status && comp.status.type && comp.status.type.state;
            if (state !== 'in' && state !== 'post') return false;
            const cs = comp.competitors || [];
            const home = cs.find(c => c.homeAway === 'home') || {};
            const away = cs.find(c => c.homeAway === 'away') || {};
            const hn = norm(home.team && home.team.displayName);
            const an = norm(away.team && away.team.displayName);
            const same = (hn === t1 && an === t2) || (hn === t2 && an === t1);
            if (!same) return false;
            const edate = e.date ? Date.parse(e.date) : NaN;
            return Number.isNaN(edate) ? true : Math.abs(edate - kickoff) <= 36 * 3600 * 1000;
        });
        if (hits.length !== 1) continue;
        const e = hits[0];
        const comp = (e.competitions || [])[0] || {};
        const cs = comp.competitors || [];
        const home = cs.find(c => c.homeAway === 'home') || {};
        const away = cs.find(c => c.homeAway === 'away') || {};
        const hs = parseInt(home.score, 10), as = parseInt(away.score, 10);
        if (Number.isNaN(hs) || Number.isNaN(as)) continue;
        const homeIsT1 = norm(home.team && home.team.displayName) === t1;
        const g1 = homeIsT1 ? hs : as;
        const g2 = homeIsT1 ? as : hs;
        const type = (comp.status && comp.status.type) || {};
        const det = `${type.detail || ''} ${type.shortDetail || ''}`;
        const status = (type.state === 'post' || type.completed) ? 'FT'
            : /half|halftime|(^|\s)ht(\s|$)/i.test(det) ? 'PAUSED' : 'IN_PLAY';
        const { minute, extra } = espnMinute(comp.status && comp.status.displayClock);
        out.push({ matchId, m, g1, g2, status, minute, extra,
                   espnEventId: e.id, homeName: home.team && home.team.displayName, homeIsT1 });
    }
    return out;
}

// Parse ESPN summary keyEvents into our scorer shape. Pure. Best-effort: structured
// participants give the scorer; own-goal/penalty inferred from type/text.
export function parseEspnGoals(keyEvents, { homeName, homeIsT1 }) {
    const out = [];
    for (const e of (keyEvents || [])) {
        if (!e || e.scoringPlay !== true || e.shootout === true) continue;
        const player = e.participants && e.participants[0] && e.participants[0].athlete && e.participants[0].athlete.displayName;
        if (!player) continue;
        const { minute, extra } = espnMinute(e.clock && e.clock.displayValue);
        const blob = `${(e.type && e.type.type) || ''} ${(e.type && e.type.text) || ''} ${e.text || ''}`.toLowerCase();
        const kind = /own/.test(blob) ? 'og' : /penalt/.test(blob) ? 'pen' : 'goal';
        const eventIsHome = norm(e.team && e.team.displayName) === norm(homeName);
        const team = eventIsHome ? (homeIsT1 ? 1 : 2) : (homeIsT1 ? 2 : 1);
        out.push({ team, player, minute, extra, kind });
    }
    out.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0) || (a.extra ?? 0) - (b.extra ?? 0));
    return out;
}
```

- [ ] **Step 5: Remove the dead API-Football live code**

Delete from `scripts/lib/results-core.mjs`: `export function mapApiFootballLive(...)`, `export function parseGoalEvents(...)`, and the now-unused `AF_INPLAY`, `AF_FINISHED`, `AF_NAME_FIX`, `normAf` (these are only used by those two functions). Then verify nothing else references them:

Run: `grep -n "mapApiFootballLive\|parseGoalEvents\|AF_INPLAY\|AF_FINISHED\|AF_NAME_FIX\|normAf" scripts/lib/results-core.mjs`
Expected: no matches (empty). If any remain (e.g. a comment), confirm it's not a live reference. `classifyMatches` must still use `norm` + football-data `status === 'FINISHED'` — do not touch it.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test tests/results-core.test.mjs`
Expected: PASS (all ESPN tests + the unchanged finals/calcPoints tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/results-core.mjs tests/results-core.test.mjs
git commit -m "feat(updater): ESPN live-score + scorer mappers (replaces API-Football)"
```

---

### Task 2: Wire ESPN into the updater + drop API-Football

**Files:**
- Modify: `scripts/update-results.mjs`
- Modify: `.github/workflows/update-results.yml`

**Interfaces:**
- Consumes Task 1's `mapEspnLive`, `parseEspnGoals`.

- [ ] **Step 1: Swap the import**

In `scripts/update-results.mjs`, change:
```js
import { classifyMatches, buildResultUpdates, mapApiFootballLive, parseMatchDate, parseGoalEvents } from './lib/results-core.mjs';
```
to:
```js
import { classifyMatches, buildResultUpdates, mapEspnLive, parseMatchDate, parseEspnGoals } from './lib/results-core.mjs';
```

- [ ] **Step 2: Add the ESPN fetchers**

Add to `scripts/update-results.mjs` (where `fetchApiFootballLive`/`fetchApiFootballEvents` currently sit):

```js
// Live in-play scores from ESPN's keyless public API (no key, no quota). Best-effort:
// any failure -> [] (finals via football-data.org are unaffected). One scoreboard call
// covers all current games.
async function fetchEspnScoreboard() {
    try {
        const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard');
        if (!res.ok) { console.warn(`ESPN scoreboard unavailable (HTTP ${res.status}) — skipping live this run.`); return []; }
        const j = await res.json();
        return j.events || [];
    } catch (err) {
        console.warn('ESPN scoreboard fetch failed (live skipped this run):', err.message);
        return [];
    }
}

// Goal events (scorers) for one ESPN event. Best-effort: failure -> [] (scorers stay empty).
async function fetchEspnSummary(eventId) {
    try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${eventId}`);
        if (!res.ok) return [];
        const j = await res.json();
        return j.keyEvents || [];
    } catch (err) {
        console.warn(`ESPN summary fetch failed for event ${eventId} (scorers skipped):`, err.message);
        return [];
    }
}
```

- [ ] **Step 3: Replace the live block in `main()`**

Replace the entire `let live = [];` block (the `if (AF_KEY && candidates.length > 0) { ... } else { console.warn('FOOTBALL_API_KEY not set...'); }`) with:

```js
    let live = [];
    if (candidates.length > 0) {
        const espnEvents = await fetchEspnScoreboard();
        live = mapEspnLive({ matches, espnEvents, now, inPlayWindowMs: 3 * 3600 * 1000 });
        for (const entry of live) {
            const prev = entry.m.live;
            // Scorers live on the persistent matches/{id}/scorers path; fall back to the
            // live node only for transitional data written before that move.
            const prevScorers = Array.isArray(entry.m.scorers) ? entry.m.scorers
                : ((prev && Array.isArray(prev.scorers)) ? prev.scorers : []);
            const prevTotal = (prev && prev.team1Goals != null ? prev.team1Goals : 0)
                            + (prev && prev.team2Goals != null ? prev.team2Goals : 0);
            const newTotal = entry.g1 + entry.g2;
            // Score back to 0 (e.g. a goal was cancelled) -> clear the list.
            if (newTotal === 0) { entry.scorers = []; continue; }
            // No change and the stored list is already complete -> reuse, no extra call.
            if (newTotal === prevTotal && prevScorers.length === newTotal) {
                entry.scorers = prevScorers;
                continue;
            }
            const keyEvents = await fetchEspnSummary(entry.espnEventId);
            entry.scorers = parseEspnGoals(keyEvents, { homeName: entry.homeName, homeIsT1: entry.homeIsT1 });
        }
    }
    console.log(`Classified: ${finished.length} finished, ${live.length} live.`);
```

- [ ] **Step 4: Remove API-Football leftovers**

Delete from `scripts/update-results.mjs`: the `const AF_KEY = process.env.FOOTBALL_API_KEY;` line, the `fetchApiFootballLive` function, and the `fetchApiFootballEvents` function. Update the file's header comment that documents `FOOTBALL_API_KEY` (replace the env note with one line: live scores now come from ESPN's keyless API, no key needed). Then verify:

Run: `grep -n "AF_KEY\|FOOTBALL_API_KEY\|fetchApiFootball\|mapApiFootballLive\|parseGoalEvents" scripts/update-results.mjs`
Expected: no matches.

- [ ] **Step 5: Drop the workflow secret env**

In `.github/workflows/update-results.yml`, remove the line:
```yaml
          FOOTBALL_API_KEY: ${{ secrets.FOOTBALL_API_KEY }}
```
(Leave `FOOTBALL_DATA_TOKEN` and everything else.)

- [ ] **Step 6: Verify syntax, references, and tests**

Run:
```bash
node --check scripts/update-results.mjs && echo "syntax OK"
node --test tests/results-core.test.mjs 2>&1 | tail -4
grep -rn "AF_KEY\|FOOTBALL_API_KEY\|fetchApiFootball\|mapApiFootballLive\|parseGoalEvents" scripts/ .github/ || echo "no API-Football refs remain"
```
Expected: `syntax OK`; tests pass; no API-Football references remain.

- [ ] **Step 7: Live end-to-end smoke (manual, not committed)**

Confirm the real ESPN feed maps against the real DB matches. Write `/tmp/espn-smoke.mjs`:
```js
import { mapEspnLive } from '/Users/shaytsadok/MyProjects/mondial/scripts/lib/results-core.mjs';
const KEY='AIzaSyAyOY_It3oq3Q4ferO_zE23sFLJ_bUZB9g', DB='https://mondial2026-a77fc-default-rtdb.firebaseio.com';
const tok=(await(await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"returnSecureToken":true}'})).json()).idToken;
const matches=await(await fetch(`${DB}/worldcup2026/matches.json?auth=${tok}`)).json();
const sb=await(await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard')).json();
console.log(JSON.stringify(mapEspnLive({matches, espnEvents: sb.events||[], now: Date.now()}).map(e=>({t:e.m.team1+' v '+e.m.team2,g:e.g1+'-'+e.g2,status:e.status,min:e.minute})), null, 1));
```
Run: `node /tmp/espn-smoke.mjs`
Expected: any currently-live WC game appears with a sane score/status/minute (e.g. `ברזיל v יפן 0-1 IN_PLAY 41`). If no game is live, it prints `[]` — that's fine; re-run during a match. (This step only validates; do not commit the smoke script.)

- [ ] **Step 8: Commit**

```bash
git add scripts/update-results.mjs .github/workflows/update-results.yml
git commit -m "feat(updater): source live scores from ESPN; drop API-Football key"
```

---

## Notes for the implementer

- The live-node shape written by `buildResultUpdates` is unchanged — do not touch `buildResultUpdates`, `classifyMatches`, or any `app.js` rendering.
- `mapEspnLive`/`parseEspnGoals` must be `export function` (the updater imports them; tests import them).
- ESPN scores arrive as strings (`"1"`) — the `parseInt` in `mapEspnLive` handles that; don't remove it.
- This is forward-only and key-free: once deployed, the updater stops depending on any API-Football key. The suspended key can be ignored; the `FOOTBALL_API_KEY` GitHub secret can be left in place (now unused) or deleted later.
