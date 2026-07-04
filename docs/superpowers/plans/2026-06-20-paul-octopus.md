# פול התמנון (Paul the Octopus) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed dummy member, פול התמנון (Paul the Octopus), to every group that makes reasonable random predictions for every match plus a random champion and top scorer, shown with a 🐙 icon.

**Architecture:** A new pure module `scripts/lib/paul-core.mjs` generates Paul's bets/membership deterministically (seeded by `groupId:matchId`). The existing GitHub Action updater calls it every run and patches the result. Paul is scored by the existing `buildResultUpdates` like any normal member; `paul-core` only computes points for matches already finished when Paul first bets them. The frontend renders a 🐙 + i18n name wherever members appear.

**Tech Stack:** Vanilla ES modules (Node `node --test`) for the updater scripts; classic-script browser JS (`app.js`, `i18n.js`, `styles.css`) loaded directly; Firebase RTDB.

## Global Constraints

- `PAUL_USER_ID = 'paul-octopus'` — the same id in `paul-core.mjs` and `app.js`. Never email-derived.
- `PAUL_NAME = 'פול התמנון'` — stored Hebrew name (DB fallback).
- Match prediction seed = `` `${groupId}:${matchId}` `` (per-group, deterministic). Champion seed = `` `${groupId}:champion` ``; top scorer seed = `` `${groupId}:topscorer` ``.
- Goal distribution per team: `0:0.28, 1:0.34, 2:0.22, 3:0.10, 4:0.04, 5:0.02`.
- `TOURNAMENT_POINTS = 10` (mirrors `app.js`; no shared constants module).
- Scoring is `calcPoints` from `scripts/lib/results-core.mjs` (exact = 4, correct outcome = 1, miss = 0) — the single scoring source of truth.
- `paul-core` writes only paths that are **absent** in the data passed in (idempotent). It never rewrites an existing member's `totalPoints`.
- Tests run with bare `node --test tests/<file>` (NOT `node --test tests/`, which is broken on this Node).
- Cache-busting: bump every `?v=` string in `index.html` when JS/CSS changes ship.

---

### Task 1: `paul-core.mjs` pure bet generator

**Files:**
- Create: `scripts/lib/paul-core.mjs`
- Test: `tests/paul-core.test.mjs`

**Interfaces:**
- Consumes: `calcPoints(b1, b2, r1, r2)` from `./results-core.mjs`.
- Produces:
  - `PAUL_USER_ID: string`, `PAUL_NAME: string`
  - `seededRandom(str: string): () => number` — deterministic PRNG in `[0,1)`.
  - `randomScore(rng: () => number): { team1Goals: number, team2Goals: number }`
  - `randomPick(rng: () => number, list: any[]): any | null`
  - `buildPaulUpdates({ users, groups, matches, bets, specialBets, tournament, now }): { [path: string]: any }`

- [ ] **Step 1: Write the failing tests**

Create `tests/paul-core.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAUL_USER_ID, PAUL_NAME, seededRandom, randomScore, randomPick, buildPaulUpdates,
} from '../scripts/lib/paul-core.mjs';

const NOW = 1_750_000_000_000;

test('seededRandom: deterministic for the same seed', () => {
  const a = seededRandom('g1:m1');
  const b = seededRandom('g1:m1');
  assert.equal(a(), b());
  assert.equal(a(), b()); // sequences stay in lockstep
});

test('seededRandom: different seeds diverge (per-group difference)', () => {
  assert.notEqual(seededRandom('g1:m1')(), seededRandom('g2:m1')());
});

test('randomScore: both sides within [0,5]', () => {
  for (let i = 0; i < 300; i++) {
    const s = randomScore(seededRandom('m' + i));
    assert.ok(s.team1Goals >= 0 && s.team1Goals <= 5, `t1=${s.team1Goals}`);
    assert.ok(s.team2Goals >= 0 && s.team2Goals <= 5, `t2=${s.team2Goals}`);
  }
});

test('randomPick: element of the list; null for empty/missing', () => {
  assert.equal(randomPick(seededRandom('s'), []), null);
  assert.equal(randomPick(seededRandom('s'), null), null);
  const list = ['a', 'b', 'c'];
  assert.ok(list.includes(randomPick(seededRandom('s'), list)));
});

test('buildPaulUpdates: creates user record when absent, omits when present', () => {
  const base = { users: {}, groups: { g1: { members: {} } }, matches: {}, bets: {}, specialBets: {}, tournament: {}, now: NOW };
  assert.deepEqual(buildPaulUpdates(base)[`users/${PAUL_USER_ID}`], { name: PAUL_NAME, email: '' });
  const present = buildPaulUpdates({ ...base, users: { [PAUL_USER_ID]: { name: PAUL_NAME } } });
  assert.equal(present[`users/${PAUL_USER_ID}`], undefined);
});

test('buildPaulUpdates: writes a bet for every unbet match, skips already-bet', () => {
  const matches = {
    m1: { team1: 'A', team2: 'B', date: '2026-07-01T20:00' },
    m2: { team1: 'C', team2: 'D', date: '2026-07-02T20:00' },
  };
  const bets = { g1: { [PAUL_USER_ID]: { m1: { team1Goals: 1, team2Goals: 1, placedAt: 1 } } } };
  const u = buildPaulUpdates({
    users: { [PAUL_USER_ID]: {} }, groups: { g1: { members: { [PAUL_USER_ID]: {} } } },
    matches, bets, specialBets: {}, tournament: {}, now: NOW,
  });
  assert.equal(u[`bets/g1/${PAUL_USER_ID}/m1`], undefined); // already bet -> untouched
  assert.ok(u[`bets/g1/${PAUL_USER_ID}/m2`]);               // unbet -> written
  assert.equal(u[`bets/g1/${PAUL_USER_ID}/m2`].placedAt, NOW);
});

test('buildPaulUpdates: same match differs across groups (per-group seed)', () => {
  const matches = { m1: { team1: 'A', team2: 'B', date: '2026-07-01T20:00' } };
  const u = buildPaulUpdates({
    users: {}, groups: { g1: { members: {} }, g2: { members: {} } },
    matches, bets: {}, specialBets: {}, tournament: {}, now: NOW,
  });
  assert.ok(u[`bets/g1/${PAUL_USER_ID}/m1`] && u[`bets/g2/${PAUL_USER_ID}/m1`]);
});

test('buildPaulUpdates: finished match scored; future match unscored; new total sums finished', () => {
  const matches = {
    done: { team1: 'A', team2: 'B', date: '2026-06-01T20:00', result: { team1Goals: 2, team2Goals: 1 } },
    fut:  { team1: 'C', team2: 'D', date: '2026-07-01T20:00' },
  };
  const u = buildPaulUpdates({
    users: {}, groups: { g1: { members: {} } },
    matches, bets: {}, specialBets: {}, tournament: {}, now: NOW,
  });
  const doneBet = u[`bets/g1/${PAUL_USER_ID}/done`];
  const futBet = u[`bets/g1/${PAUL_USER_ID}/fut`];
  assert.equal(typeof doneBet.points, 'number'); // finished -> scored here
  assert.equal(futBet.points, undefined);        // not finished -> scored later by buildResultUpdates
  const member = u[`groups/g1/members/${PAUL_USER_ID}`];
  assert.equal(member.name, PAUL_NAME);
  assert.equal(member.totalPoints, doneBet.points); // initial total = finished points only
});

test('buildPaulUpdates: special bets from tournament lists; scored only when finals set', () => {
  const u = buildPaulUpdates({
    users: {}, groups: { g1: { members: {} } }, matches: {}, bets: {}, specialBets: {},
    tournament: { teams: ['A', 'B', 'C'], scorers: ['P1', 'P2'], winner: null, topScorer: null }, now: NOW,
  });
  const w = u[`specialBets/g1/${PAUL_USER_ID}/winner`];
  const ts = u[`specialBets/g1/${PAUL_USER_ID}/topScorer`];
  assert.ok(['A', 'B', 'C'].includes(w.team));
  assert.ok(['P1', 'P2'].includes(ts.player));
  assert.equal(w.points, undefined); // winner not set -> unscored
});

test('buildPaulUpdates: special bets skipped when lists empty', () => {
  const u = buildPaulUpdates({
    users: {}, groups: { g1: { members: {} } }, matches: {}, bets: {}, specialBets: {},
    tournament: { teams: [], scorers: [] }, now: NOW,
  });
  assert.equal(u[`specialBets/g1/${PAUL_USER_ID}/winner`], undefined);
  assert.equal(u[`specialBets/g1/${PAUL_USER_ID}/topScorer`], undefined);
});

test('buildPaulUpdates: existing membership total not rewritten', () => {
  const u = buildPaulUpdates({
    users: { [PAUL_USER_ID]: {} },
    groups: { g1: { members: { [PAUL_USER_ID]: { totalPoints: 7 } } } },
    matches: {}, bets: {}, specialBets: {}, tournament: {}, now: NOW,
  });
  assert.equal(u[`groups/g1/members/${PAUL_USER_ID}`], undefined);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/paul-core.test.mjs`
Expected: FAIL — `Cannot find module '../scripts/lib/paul-core.mjs'`.

- [ ] **Step 3: Implement `paul-core.mjs`**

Create `scripts/lib/paul-core.mjs`:

```js
// פול התמנון (Paul the Octopus) — a dummy member that makes reasonable random
// predictions in every group. Pure bet GENERATOR: it writes Paul's user record,
// per-group membership, and random bets. The existing buildResultUpdates scores
// him like any normal member. Match points are computed HERE only for matches that
// are already finished when Paul first bets them (a self-running one-time past calc).
import { calcPoints } from './results-core.mjs';

export const PAUL_USER_ID = 'paul-octopus';
export const PAUL_NAME = 'פול התמנון';
// Mirrors TOURNAMENT_POINTS in app.js (there is no shared constants module).
const TOURNAMENT_POINTS = 10;

// Deterministic PRNG from a string seed: FNV-1a hash -> mulberry32.
export function seededRandom(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Realistic per-team goal distribution.
const GOAL_WEIGHTS = [[0, 0.28], [1, 0.34], [2, 0.22], [3, 0.10], [4, 0.04], [5, 0.02]];
function weightedGoals(rng) {
  let r = rng();
  for (const [goals, w] of GOAL_WEIGHTS) {
    if (r < w) return goals;
    r -= w;
  }
  return 0;
}

// A full scoreline from one rng.
export function randomScore(rng) {
  return { team1Goals: weightedGoals(rng), team2Goals: weightedGoals(rng) };
}

// Deterministic element of a non-empty array; null for empty/missing.
export function randomPick(rng, list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(rng() * list.length)];
}

function hasResult(m) {
  return m && m.result && m.result.team1Goals !== undefined && m.result.team1Goals !== null;
}

// Build the flat { path: value } updates that create/extend Paul. Writes only paths
// absent in the data passed in, so it is idempotent.
export function buildPaulUpdates({ users, groups, matches, bets, specialBets, tournament, now }) {
  const updates = {};
  users = users || {};
  groups = groups || {};
  matches = matches || {};
  bets = bets || {};
  specialBets = specialBets || {};
  tournament = tournament || {};

  // 1. User record (once).
  if (!users[PAUL_USER_ID]) {
    updates[`users/${PAUL_USER_ID}`] = { name: PAUL_NAME, email: '' };
  }

  const winner = tournament.winner || null;
  const topScorer = tournament.topScorer || null;

  for (const gid of Object.keys(groups)) {
    const groupBets = ((bets[gid] || {})[PAUL_USER_ID]) || {};
    const memberExists = !!(((groups[gid] || {}).members || {})[PAUL_USER_ID]);
    // Sum of points written THIS run, used only to seed a NEW member's initial total.
    let initialPoints = 0;

    // 2. Match bets — every match Paul hasn't bet in this group.
    for (const matchId of Object.keys(matches)) {
      const m = matches[matchId];
      if (!m) continue;
      if (groupBets[matchId]) continue; // already bet -> leave untouched
      const score = randomScore(seededRandom(`${gid}:${matchId}`));
      const bet = { team1Goals: score.team1Goals, team2Goals: score.team2Goals, placedAt: now };
      if (hasResult(m)) {
        bet.points = calcPoints(score.team1Goals, score.team2Goals, m.result.team1Goals, m.result.team2Goals);
        initialPoints += bet.points;
      }
      updates[`bets/${gid}/${PAUL_USER_ID}/${matchId}`] = bet;
    }

    // 3. Special bets — champion + top scorer (per group), only if absent.
    const groupSpecial = ((specialBets[gid] || {})[PAUL_USER_ID]) || {};
    if (!groupSpecial.winner) {
      const team = randomPick(seededRandom(`${gid}:champion`), tournament.teams);
      if (team) {
        const sb = { team, placedAt: now };
        if (winner) { sb.points = team === winner ? TOURNAMENT_POINTS : 0; initialPoints += sb.points; }
        updates[`specialBets/${gid}/${PAUL_USER_ID}/winner`] = sb;
      }
    }
    if (!groupSpecial.topScorer) {
      const player = randomPick(seededRandom(`${gid}:topscorer`), tournament.scorers);
      if (player) {
        const sb = { player, placedAt: now };
        if (topScorer) { sb.points = player === topScorer ? TOURNAMENT_POINTS : 0; initialPoints += sb.points; }
        updates[`specialBets/${gid}/${PAUL_USER_ID}/topScorer`] = sb;
      }
    }

    // 4. Membership with seeded initial total — only when membership is new.
    // Once Paul is a member, buildResultUpdates owns his totalPoints.
    if (!memberExists) {
      updates[`groups/${gid}/members/${PAUL_USER_ID}`] = { joinedAt: now, totalPoints: initialPoints, name: PAUL_NAME };
    }
  }

  return updates;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/paul-core.test.mjs`
Expected: PASS (all tests).

- [ ] **Step 5: Run the full updater test suite (regression)**

Run: `node --test tests/paul-core.test.mjs tests/results-core.test.mjs`
Expected: PASS (no regressions in results-core).

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/paul-core.mjs tests/paul-core.test.mjs
git commit -m "feat: paul-core — deterministic random-bet generator for פול התמנון"
```

---

### Task 2: Wire `buildPaulUpdates` into the updater

**Files:**
- Modify: `scripts/update-results.mjs` (import at line 19; new `ensurePaul` call + function in `main()`)

**Interfaces:**
- Consumes: `buildPaulUpdates(...)`, `PAUL_USER_ID` from `./lib/paul-core.mjs`; existing `fbGet`, `fbPatch`, `firebaseSignIn`, `DRY_RUN` in the same file.
- Produces: nothing for later tasks (terminal I/O wiring).

**Why here:** `ensurePaul` must run on **every** invocation, before the "nothing live" early return (`scripts/update-results.mjs:160-170`), so Paul bets on matches well ahead of kickoff regardless of live state. Running it first also means the later results read of `bets` includes Paul's freshly-written bets, so `buildResultUpdates` scores him normally.

- [ ] **Step 1: Add the import**

Modify `scripts/update-results.mjs` line 19. Change:

```js
import { classifyMatches, buildResultUpdates, mapApiFootballLive, parseMatchDate } from './lib/results-core.mjs';
```

to add a second import line directly below it:

```js
import { classifyMatches, buildResultUpdates, mapApiFootballLive, parseMatchDate } from './lib/results-core.mjs';
import { buildPaulUpdates } from './lib/paul-core.mjs';
```

- [ ] **Step 2: Call `ensurePaul` right after matches are fetched**

In `main()`, find (around line 153-154):

```js
    const token = await firebaseSignIn();
    const matches = (await fbGet('matches', token)) || {};
```

Insert immediately after:

```js

    // Ensure פול התמנון exists in every group with random predictions. Runs every
    // invocation (independent of live state) so Paul bets on matches well before
    // kickoff. buildPaulUpdates only writes absent paths, so this is idempotent.
    await ensurePaul(token, matches, now);
```

- [ ] **Step 3: Add the `ensurePaul` function**

Add this function at the end of the file (after `main()`'s definition, alongside the other top-level helpers):

```js
// One Firebase read of the nodes paul-core needs, build, and patch. Best-effort:
// reuses the same token and the existing fbGet/fbPatch helpers.
async function ensurePaul(token, matches, now) {
  const [users, groups, bets, specialBets, tournament] = await Promise.all([
    fbGet('users', token),
    fbGet('groups', token),
    fbGet('bets', token),
    fbGet('specialBets', token),
    fbGet('settings/tournament', token),
  ]);
  const updates = buildPaulUpdates({
    users: users || {},
    groups: groups || {},
    matches: matches || {},
    bets: bets || {},
    specialBets: specialBets || {},
    tournament: tournament || {},
    now,
  });
  const n = Object.keys(updates).length;
  if (n === 0) { console.log('Paul: nothing to write.'); return; }
  if (DRY_RUN) { console.log(`Paul DRY RUN — ${n} path(s):\n${JSON.stringify(updates, null, 2)}`); return; }
  await fbPatch(updates, token);
  console.log(`Paul: wrote ${n} path(s).`);
}
```

- [ ] **Step 4: Syntax-check both modules**

Run: `node --check scripts/lib/paul-core.mjs && node --check scripts/update-results.mjs`
Expected: no output, exit 0 (both parse).

- [ ] **Step 5: Re-run the updater test suite (no regressions)**

Run: `node --test tests/paul-core.test.mjs tests/results-core.test.mjs`
Expected: PASS.

> Note: a real end-to-end run needs the Firebase/API credentials that live only as GitHub Action secrets, so it cannot run locally. Verification here is `node --check` + the pure unit tests + code review of the wiring. The logic is fully covered by Task 1's tests; this task is thin I/O glue, matching the existing untested-wrapper pattern of `update-results.mjs`.

- [ ] **Step 6: Commit**

```bash
git add scripts/update-results.mjs
git commit -m "feat: run buildPaulUpdates every updater invocation"
```

---

### Task 3: Frontend foundation — `PAUL_USER_ID`, `isPaul`, i18n name

**Files:**
- Modify: `app.js` (add constant + `isPaul` near the other top-level constants, after `TOP_SCORER_CANDIDATES`)
- Modify: `i18n.js` (add `paul.name` after each `leaderboard.meTag`: he line 164, en line 454, es line 736)
- Test: `tests/pure-logic.test.js` (add `isPaul` test)

**Interfaces:**
- Produces: `PAUL_USER_ID: string`, `isPaul(uid: string): boolean` (both visible to later frontend code and to the test sandbox — `isPaul` is a function declaration, so it leaks onto the vm sandbox).

- [ ] **Step 1: Write the failing test**

In `tests/pure-logic.test.js`, add after the `emailToId` tests block:

```js
// --- isPaul ----------------------------------------------------------------

test('isPaul: true only for the octopus id', () => {
    assert.equal(app.isPaul('paul-octopus'), true);
    assert.equal(app.isPaul('shay_t@helloflare_com'), false);
    assert.equal(app.isPaul(''), false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/pure-logic.test.js`
Expected: FAIL — `app.isPaul is not a function`.

- [ ] **Step 3: Add the constant + helper to `app.js`**

In `app.js`, immediately after the `TOP_SCORER_CANDIDATES` array's closing `];` (near line 146+), add:

```js

// פול התמנון (Paul the Octopus) — the automated dummy member. Same id as the
// updater's paul-core PAUL_USER_ID; he is created/scored server-side.
const PAUL_USER_ID = 'paul-octopus';
function isPaul(uid) { return uid === PAUL_USER_ID; }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/pure-logic.test.js`
Expected: PASS.

- [ ] **Step 5: Add the `paul.name` i18n key in all three languages**

In `i18n.js`, after the Hebrew `'leaderboard.meTag': 'אני',` (line ~164) add:

```js
        'paul.name': 'פול התמנון',
```

After the English `'leaderboard.meTag': 'you',` (line ~454) add:

```js
        'paul.name': 'Paul the Octopus',
```

After the Spanish `'leaderboard.meTag': 'tú',` (line ~736) add:

```js
        'paul.name': 'Paul el Pulpo',
```

- [ ] **Step 6: Verify the key exists in all three languages**

Run: `grep -c "'paul.name'" i18n.js`
Expected: `3`.

- [ ] **Step 7: Commit**

```bash
git add app.js i18n.js tests/pure-logic.test.js
git commit -m "feat: PAUL_USER_ID + isPaul + paul.name i18n"
```

---

### Task 4: Frontend render — 🐙 icon + name in leaderboard & live board

**Files:**
- Modify: `app.js` (add `memberLabel`; use it in `renderLeaderboard` ~line 1417 and `buildLiveCard` ~line 1301)
- Modify: `styles.css` (add `.octo-icon` after `.lb-me-tag`, ~line 792)
- Modify: `index.html` (bump every `?v=20260620e` to `?v=20260620f`)
- Test: `tests/pure-logic.test.js` (add `memberLabel` test)
- Test: `tests/manual/paul-harness.html` (headless visual verification)

**Interfaces:**
- Consumes: `isPaul`, `PAUL_USER_ID` (Task 3), `escapeHtml`, `t` (existing in `app.js`).
- Produces: `memberLabel(uid: string, fallbackName: string): string` — returns ready-to-insert HTML (icon span + name); leaks onto the test sandbox.

- [ ] **Step 1: Write the failing test**

In `tests/pure-logic.test.js`, add after the `isPaul` test:

```js
// --- memberLabel -----------------------------------------------------------

test('memberLabel: Paul gets octopus icon + i18n name', () => {
    const paul = app.memberLabel('paul-octopus', 'ignored-fallback');
    assert.match(paul, /octo-icon/);
    assert.match(paul, /🐙/);
    assert.match(paul, /paul\.name/); // t() stub returns the key
});

test('memberLabel: other members get their escaped name', () => {
    assert.equal(app.memberLabel('u1', 'Tom & Jerry'), 'Tom &amp; Jerry');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/pure-logic.test.js`
Expected: FAIL — `app.memberLabel is not a function`.

- [ ] **Step 3: Add `memberLabel` to `app.js`**

In `app.js`, directly below the `isPaul` function added in Task 3, add:

```js
// HTML label for a member in lists: Paul gets a 🐙 + his localized name; everyone
// else their (escaped) stored name. Returns markup, so callers insert it directly.
function memberLabel(uid, fallbackName) {
    if (isPaul(uid)) return `<span class="octo-icon">🐙</span>${escapeHtml(t('paul.name'))}`;
    return escapeHtml(fallbackName);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/pure-logic.test.js`
Expected: PASS.

- [ ] **Step 5: Use `memberLabel` in the leaderboard**

In `app.js` `renderLeaderboard`, find (line ~1417):

```js
            <span class="lb-name">${escapeHtml(u.name)} ${meTag}</span>
```

Replace with:

```js
            <span class="lb-name">${memberLabel(u.userId, u.name)} ${meTag}</span>
```

- [ ] **Step 6: Use `memberLabel` in the live board**

In `app.js` `buildLiveCard`, find (line ~1301):

```js
             + `<span class="live-lb-name">${escapeHtml(nameOf(uid))}${meTag}</span>`
```

Replace with:

```js
             + `<span class="live-lb-name">${memberLabel(uid, nameOf(uid))}${meTag}</span>`
```

- [ ] **Step 7: Add the `.octo-icon` style**

In `styles.css`, after the `.lb-me-tag { ... }` rule (ends ~line 792-800), add:

```css
.octo-icon { margin-inline-end: 0.25em; font-size: 0.95em; }
```

- [ ] **Step 8: Create the headless verification harness**

Create `tests/manual/paul-harness.html`:

```html
<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="../../styles.css">
<body style="direction:rtl">
<div id="tab-leaderboard" class="tab-panel active"><div id="leaderboard-container" class="app-content"></div></div>
<script>window.firebase=undefined;window.db=null;window.currentUser={userId:'u1'};
window.t=k=>({ 'paul.name':'פול התמנון','leaderboard.meTag':'אני','leaderboard.empty':'ריק','common.pts':'נק׳','groupSettings.unknownUser':'?' }[k]||k);
window.translateTeam=n=>n;window.currentLang='he';</script>
<script src="../../app.js?cb=1"></script>
<script>
  Object.assign(groupMembers,{
    u1:{name:'shay',totalPoints:20},
    'paul-octopus':{name:'פול התמנון',totalPoints:14} });
  Object.assign(groupUsersCache,groupMembers);
  window.activeTournament='worldcup2026';window.stageFilter='all';renderLeaderboard();
  document.title='HAS_OCTO:'+document.querySelector('#leaderboard-container').innerHTML.includes('octo-icon')
    + ' EMOJI:'+document.querySelector('#leaderboard-container').innerHTML.includes('🐙');
</script></body>
```

- [ ] **Step 9: Render headless and verify the icon appears**

Run:
```bash
CHROME=$(ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
"$CHROME" --headless --disable-gpu --dump-dom "file://$PWD/tests/manual/paul-harness.html" 2>/dev/null | grep -oE '<title>[^<]*</title>'
```
Expected: `<title>HAS_OCTO:true EMOJI:true</title>`.

- [ ] **Step 10: Bump cache-busting versions**

Run: `sed -i '' 's/20260620e/20260620f/g' index.html && grep -c '20260620f' index.html`
Expected: `6`.

- [ ] **Step 11: Final full test run**

Run: `node --test tests/pure-logic.test.js tests/paul-core.test.mjs tests/results-core.test.mjs`
Expected: PASS (all suites).

- [ ] **Step 12: Commit**

```bash
git add app.js styles.css index.html tests/pure-logic.test.js tests/manual/paul-harness.html
git commit -m "feat: render 🐙 + name for פול התמנון in leaderboard and live board"
```

---

## Notes for the implementer

- **Do not** add an `excludeUserIds` param to `buildResultUpdates` — the design deliberately treats Paul as a normal member there.
- The DB requires auth; you cannot run the updater end-to-end locally. That is expected — rely on the unit tests and `node --check`.
- Keep `PAUL_USER_ID` identical in `paul-core.mjs` and `app.js` (`'paul-octopus'`). They are independent declarations in two runtimes (Node module vs browser classic script); there is no shared import between them.
- After merge + deploy, the updater creates Paul on its next run; verify on `mondial.guru` that 🐙 פול התמנון appears in a group's leaderboard.
