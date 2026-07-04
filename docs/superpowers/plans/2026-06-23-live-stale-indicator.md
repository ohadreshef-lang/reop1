# Live "Updates Paused" Indicator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a live game's data hasn't refreshed for 10 minutes (the live API failed), freeze the clock, dim the score, and replace the live badge with a neutral "⏸ updated X min ago" so the user knows the live view isn't updating.

**Architecture:** Frontend-only. The live node already carries `updatedAt`; a pure `isLiveStale(now, upd, status)` helper drives both initial render and the existing 1-second ticker. `computeLiveMinute` freezes the clock when stale; CSS keyed on a `.live-stale` card class dims the score and swaps the badge.

**Tech Stack:** Classic-script browser JS (`app.js`, `i18n.js`, `styles.css`) loaded directly; Node `node --test` for the pure helpers.

## Global Constraints

- Stale threshold `LIVE_STALE_MS = 10 * 60 * 1000`; only `status === 'IN_PLAY'` games can be stale.
- `isLiveStale(now, upd, status)` returns true iff `status === 'IN_PLAY' && typeof upd === 'number' && (now - upd) > LIVE_STALE_MS`.
- `computeLiveMinute` gains a final `staleMs = LIVE_STALE_MS` param; when stale it clocks from `upd` (frozen), not `now`. Existing callers (no new arg) keep working via the default.
- Stale visual: card gets `.live-stale`; CSS dims `.live-score` and swaps the red live badge for a neutral `.badge-stale` "⏸ <updated X min ago>"; the "X min ago" text is `t('live.updatedAgo').replace('{n}', X)` with `X = Math.round((now - upd) / 60000)`.
- i18n `live.updatedAgo`: he `'עודכן לפני {n} דק׳'`, en `'updated {n} min ago'`, es `'actualizado hace {n} min'`.
- `isLiveStale` and `computeLiveMinute` must be `function` declarations (so the test vm sandbox exposes them as `app.*`).
- Tests run with bare `node --test tests/<file>` (NOT `node --test tests/`).
- Cache-busting: bump every `?v=20260621a` in `index.html` to `20260623a`.

---

### Task 1: Pure logic — `isLiveStale` + `computeLiveMinute` freeze

**Files:**
- Modify: `app.js` (add `LIVE_STALE_MS` + `isLiveStale` just before `computeLiveMinute` at ~line 300; modify `computeLiveMinute`)
- Test: `tests/pure-logic.test.js`

**Interfaces:**
- Produces: `isLiveStale(now, upd, status): boolean`; `computeLiveMinute(now, kickoffMs, elapsed, extra, upd, status, staleMs?)` — freezes when stale. Both leak onto the test sandbox.

- [ ] **Step 1: Write the failing tests**

In `tests/pure-logic.test.js`, add after the existing `computeLiveMinute` tests:

```js
// --- isLiveStale -----------------------------------------------------------

test('isLiveStale: in-play with an update older than 10 min -> true', () => {
    const now = 1_000_000_000_000;
    assert.equal(app.isLiveStale(now, now - 11 * 60000, 'IN_PLAY'), true);
});
test('isLiveStale: in-play with a recent update -> false', () => {
    const now = 1_000_000_000_000;
    assert.equal(app.isLiveStale(now, now - 3 * 60000, 'IN_PLAY'), false);
});
test('isLiveStale: PAUSED/FT or missing upd -> false', () => {
    const now = 1_000_000_000_000;
    assert.equal(app.isLiveStale(now, now - 30 * 60000, 'PAUSED'), false);
    assert.equal(app.isLiveStale(now, now - 30 * 60000, 'FT'), false);
    assert.equal(app.isLiveStale(now, null, 'IN_PLAY'), false);
});

// --- computeLiveMinute: stale freeze ---------------------------------------

test('computeLiveMinute: freezes once data is stale (>10 min since upd)', () => {
    const now = 1_000_000_000_000;
    // elapsed 50 captured 12 min ago -> frozen at 50, not 50+12
    assert.equal(app.computeLiveMinute(now, now - 62 * 60000, 50, null, now - 12 * 60000, 'IN_PLAY'), "50'");
});
test('computeLiveMinute: still ticks when data is fresh (<10 min)', () => {
    const now = 1_000_000_000_000;
    assert.equal(app.computeLiveMinute(now, now - 52 * 60000, 50, null, now - 2 * 60000, 'IN_PLAY'), "52'");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/pure-logic.test.js`
Expected: FAIL — `app.isLiveStale is not a function`, and the freeze test fails (current `computeLiveMinute` ticks to `"62'"`).

- [ ] **Step 3: Add `LIVE_STALE_MS` + `isLiveStale` and update `computeLiveMinute`**

In `app.js`, find the start of `computeLiveMinute` (~line 300):

```js
function computeLiveMinute(now, kickoffMs, elapsed, extra, upd, status) {
    if (status === 'PAUSED' || status === 'FT') return '';   // badge conveys these
    const tick = (upd != null && status === 'IN_PLAY') ? Math.max(0, Math.floor((now - upd) / 60000)) : 0;
    if (elapsed == null) {                                    // estimate from kickoff (rough)
        const est = Math.floor((now - kickoffMs) / 60000);
        return est > 90 ? "90+'" : (est < 0 ? 0 : est) + "'";
    }
    // API caps elapsed at 45/90; stoppage lives in `extra`, shown as "45+2'" / "90+3'".
    if (extra != null && extra > 0) return `${elapsed}+${extra + tick}'`;
    return `${elapsed + tick}'`;
}
```

Replace it with (adds the constant + helper above it, and the freeze logic inside):

```js
// A live game whose data hasn't refreshed in LIVE_STALE_MS is "stale" — the live API
// stopped updating. Only in-play games run a clock, so only they can go stale.
const LIVE_STALE_MS = 10 * 60 * 1000;
function isLiveStale(now, upd, status) {
    return status === 'IN_PLAY' && typeof upd === 'number' && (now - upd) > LIVE_STALE_MS;
}

function computeLiveMinute(now, kickoffMs, elapsed, extra, upd, status, staleMs = LIVE_STALE_MS) {
    if (status === 'PAUSED' || status === 'FT') return '';   // badge conveys these
    // When data is stale, freeze the clock at the last real update instead of ticking
    // forward off wall-clock.
    const stale = typeof upd === 'number' && (now - upd) > staleMs;
    const clock = stale ? upd : now;
    const tick = (upd != null && status === 'IN_PLAY') ? Math.max(0, Math.floor((clock - upd) / 60000)) : 0;
    if (elapsed == null) {                                    // estimate from kickoff (rough)
        const est = Math.floor((clock - kickoffMs) / 60000);
        return est > 90 ? "90+'" : (est < 0 ? 0 : est) + "'";
    }
    // API caps elapsed at 45/90; stoppage lives in `extra`, shown as "45+2'" / "90+3'".
    if (extra != null && extra > 0) return `${elapsed}+${extra + tick}'`;
    return `${elapsed + tick}'`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/pure-logic.test.js`
Expected: PASS (new tests + all existing `computeLiveMinute` tests, which still pass via the default `staleMs`).

- [ ] **Step 5: Commit**

```bash
git add app.js tests/pure-logic.test.js
git commit -m "feat: isLiveStale + computeLiveMinute freezes clock on stale live data"
```

---

### Task 2: Card rendering, ticker, CSS, i18n

**Files:**
- Modify: `app.js` (`buildLiveCard` badge + card root ~line 1374-1391; `updateLiveMinutes` ~line 314)
- Modify: `i18n.js` (add `live.updatedAgo` after each `'live.statusLive'`: he ~121, en ~415, es ~698)
- Modify: `styles.css` (add `.live-stale` / `.badge-stale` rules)
- Modify: `index.html` (bump `20260621a` → `20260623a`)
- Test: `tests/manual/live-stale-harness.html`

**Interfaces:**
- Consumes: `isLiveStale`, `computeLiveMinute` (Task 1), `t`, `escapeHtml`.

- [ ] **Step 1: Compute stale + dual badge in `buildLiveCard`**

In `app.js` `buildLiveCard`, find the minute block (lines ~1374-1378):

```js
    const upd = live && live.updatedAt ? live.updatedAt : '';
    const minStatus = isPaused ? 'PAUSED' : 'IN_PLAY';
    const minuteHtml = (inPlay || isPaused)
        ? `<span class="live-minute" data-kickoff="${kickoffMs}" data-min="${apiMin}" data-extra="${apiExtra}" data-upd="${upd}" data-status="${minStatus}">${computeLiveMinute(Date.now(), kickoffMs, apiMin === '' ? null : apiMin, apiExtra === '' ? null : apiExtra, upd === '' ? null : upd, minStatus)}</span>`
        : '';
```

Insert immediately after that block:

```js
    // "Updates paused" (stale) state — only for actively-playing games. The card carries
    // both a live badge and a paused badge; CSS shows one based on the .live-stale class
    // (set here initially, kept current by updateLiveMinutes).
    const liveUpd = live && typeof live.updatedAt === 'number' ? live.updatedAt : null;
    const stale = inPlay && isLiveStale(Date.now(), liveUpd, 'IN_PLAY');
    const agoInit = stale ? escapeHtml(t('live.updatedAgo').replace('{n}', String(Math.round((Date.now() - liveUpd) / 60000)))) : '';
    const badgeHtml = inPlay
        ? `<span class="match-status-badge badge-live live-badge-active">${dot}${t('live.statusLive')}</span>`
          + `<span class="match-status-badge badge-stale live-badge-stale">⏸ <span class="live-stale-ago">${agoInit}</span></span>`
        : `<span class="match-status-badge ${badgeClass}">${dot}${t(statusKey)}</span>`;
```

- [ ] **Step 2: Use the stale class + badge in the returned template**

In the same `return` template, change the card root line:

```js
    <div class="match-card live-card" id="live-${m.id}">
```

to:

```js
    <div class="match-card live-card${stale ? ' live-stale' : ''}" id="live-${m.id}">
```

and change the header badge line:

```js
            <span class="match-status-badge ${badgeClass}">${dot}${t(statusKey)}</span>
```

to:

```js
            ${badgeHtml}
```

- [ ] **Step 3: Maintain the stale state in `updateLiveMinutes`**

In `app.js`, replace `updateLiveMinutes` (~line 314):

```js
function updateLiveMinutes() {
    const now = Date.now();
    document.querySelectorAll('.live-minute').forEach(el => {
        const elapsed = el.dataset.min === '' ? null : +el.dataset.min;
        const extra = el.dataset.extra === '' ? null : +el.dataset.extra;
        const upd = el.dataset.upd === '' ? null : +el.dataset.upd;
        el.textContent = computeLiveMinute(now, +el.dataset.kickoff, elapsed, extra, upd, el.dataset.status);
    });
}
```

with:

```js
function updateLiveMinutes() {
    const now = Date.now();
    document.querySelectorAll('.live-minute').forEach(el => {
        const elapsed = el.dataset.min === '' ? null : +el.dataset.min;
        const extra = el.dataset.extra === '' ? null : +el.dataset.extra;
        const upd = el.dataset.upd === '' ? null : +el.dataset.upd;
        const status = el.dataset.status;
        el.textContent = computeLiveMinute(now, +el.dataset.kickoff, elapsed, extra, upd, status);
        // Toggle the "updates paused" (stale) state on the card and refresh the "X min ago".
        const card = el.closest('.live-card');
        if (!card) return;
        const stale = isLiveStale(now, upd, status);
        card.classList.toggle('live-stale', stale);
        if (stale) {
            const ago = card.querySelector('.live-stale-ago');
            if (ago) ago.textContent = t('live.updatedAgo').replace('{n}', String(Math.round((now - upd) / 60000)));
        }
    });
}
```

- [ ] **Step 4: Add the i18n string in all three languages**

In `i18n.js`, after the Hebrew `'live.statusLive': 'משחק חי',` (~line 121) add:

```js
        'live.updatedAgo': 'עודכן לפני {n} דק׳',
```

After the English `'live.statusLive': 'Live',` (~line 415) add:

```js
        'live.updatedAgo': 'updated {n} min ago',
```

After the Spanish `'live.statusLive': 'En vivo',` (~line 698) add:

```js
        'live.updatedAgo': 'actualizado hace {n} min',
```

- [ ] **Step 5: Add the CSS**

In `styles.css`, after the `.live-minute` rule block, add:

```css
.live-badge-stale { display: none; }
.live-card.live-stale .live-badge-active { display: none; }
.live-card.live-stale .live-badge-stale { display: inline-flex; align-items: center; gap: 4px; }
.badge-stale { background: #6b7280; color: #fff; }
.live-card.live-stale .live-score { opacity: 0.45; }
```

- [ ] **Step 6: Create the headless harness**

Create `tests/manual/live-stale-harness.html`:

```html
<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="../../styles.css">
<body style="direction:rtl">
<div id="tab-live" class="tab-panel active"><div id="live-container" class="app-content"></div></div>
<script>window.firebase=undefined;window.db=null;window.currentUser={userId:'u1'};
window.t=k=>({'live.statusLive':'משחק חי','live.updatedAgo':'עודכן לפני {n} דק׳','live.notStarted':'טרם החל','live.total':'סה"כ','leaderboard.meTag':'אני','groupSettings.unknownUser':'?','live.empty':'אין'}[k]||k);
window.translateTeam=n=>n;window.currentLang='he';</script>
<script src="../../app.js?cb=1"></script>
<script>
  const ago=ms=>new Date(Date.now()-ms).toISOString().slice(0,16);
  // Live game whose live node hasn't updated for 12 minutes -> stale.
  Object.assign(matches,{g:{team1:'הולנד',team2:'שוודיה',date:ago(60*60000),group:'F',stage:'group',
    live:{team1Goals:1,team2Goals:0,status:'IN_PLAY',updatedAt:Date.now()-12*60000,minute:50}}});
  Object.assign(groupMembers,{u1:{name:'shay',totalPoints:10}});
  Object.assign(groupUsersCache,groupMembers);
  window.activeTournament='worldcup2026';window.stageFilter='all';renderLive();updateLiveMinutes();
  const card=document.querySelector('.live-card');
  const agoTxt=(card.querySelector('.live-stale-ago')||{}).textContent||'';
  const min=(card.querySelector('.live-minute')||{}).textContent||'';
  document.title='STALE:'+card.classList.contains('live-stale')+' AGO:'+(agoTxt.length>0)+' MIN:'+min;
</script></body>
```

- [ ] **Step 7: Render the harness and verify**

Run:
```bash
CHROME=$(ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
"$CHROME" --headless --disable-gpu --dump-dom "file://$PWD/tests/manual/live-stale-harness.html" 2>/dev/null | grep -oE '<title>[^<]*</title>'
```
Expected: `<title>STALE:true AGO:true MIN:50'</title>` (card stale, "X min ago" text present, clock frozen at 50').

- [ ] **Step 8: Bump cache-busting versions**

Run: `sed -i '' 's/20260621a/20260623a/g' index.html && grep -c '20260623a' index.html`
Expected: `6`.

- [ ] **Step 9: Final unit run (no regressions)**

Run: `node --test tests/pure-logic.test.js tests/results-core.test.mjs tests/paul-core.test.mjs`
Expected: PASS (all suites).

- [ ] **Step 10: Commit**

```bash
git add app.js i18n.js styles.css index.html tests/manual/live-stale-harness.html
git commit -m "feat: live 'updates paused' indicator when live data goes stale"
```

---

## Notes for the implementer

- Frontend-only — no backend/updater change. The `updatedAt` field already exists on the live node.
- `isLiveStale` and `computeLiveMinute` must stay `function` declarations (vm sandbox exposes only those).
- The stale state self-heals: when the updater resumes, the fresh `updatedAt` re-renders the card via the matches listener; the ticker's `classList.toggle(..., false)` also reverts it.
- After merge + deploy, verify on `mondial.guru` during the next live game (or simulate by checking a card whose `updatedAt` is >10 min old) that it dims + shows "⏸ עודכן לפני X דק׳" and the clock stops.
