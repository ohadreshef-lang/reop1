# Live "Paused" Indicator Covers No-Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the live "updates paused" state to cover the no-data case (API down from kickoff): freeze the score (show "–" when we never had data), stop the clock, and show a timer of how long it's been frozen.

**Architecture:** Replace `isLiveStale` with a richer pure `livePausedSince(now, upd, kickoffMs, status)` that falls back to kickoff when there's no live node. `buildLiveCard` and the 1-second ticker `updateLiveMinutes` use it to render/maintain the paused state (score "–", hidden clock, "⏸ no live update · X min" badge) for no-data games, in addition to the existing stale-feed case.

**Tech Stack:** Classic-script browser JS (`app.js`, `i18n.js`), Node `node --test`, headless Chrome harness.

## Global Constraints

- `LIVE_STALE_MS = 10 * 60 * 1000` (unchanged threshold).
- `livePausedSince(now, upd, kickoffMs, status)`: returns `null` unless `status === 'IN_PLAY'`; `ref = (typeof upd === 'number') ? upd : kickoffMs`; returns `ref` if `now - ref > LIVE_STALE_MS`, else `null`. Replaces `isLiveStale` (remove it; move its call sites + tests).
- Paused score: frozen last-live value if a live node ever existed; **"–"** if no live node ever (`paused && !hadData`).
- Paused clock: frozen (had data, via `computeLiveMinute`'s existing `staleMs` guard) or **hidden** (no data → `''`).
- Paused badge text: `(hadData ? t('live.updatedAgo') : t('live.noLiveData')).replace('{n}', X)`, `X = Math.round((now - pausedSince)/60000)`.
- New i18n `live.noLiveData`: he `'אין עדכון חי · {n} דק׳'`, en `'no live update · {n} min'`, es `'sin datos en vivo · {n} min'`.
- `livePausedSince` must be a `function` declaration (test vm sandbox exposes only those).
- Tests run with bare `node --test tests/<file>` (NOT `node --test tests/`).
- Cache-busting: bump every `?v=20260625a` in `index.html` to `20260626a`.

---

### Task 1: `livePausedSince` pure detector (replaces `isLiveStale`)

**Files:**
- Modify: `app.js` (replace `isLiveStale`, ~lines 300-305)
- Test: `tests/pure-logic.test.js` (replace the `isLiveStale` test block, ~lines 312-327)

**Interfaces:**
- Produces: `livePausedSince(now, upd, kickoffMs, status) -> number|null`. Removes `isLiveStale`.

- [ ] **Step 1: Replace the failing tests**

In `tests/pure-logic.test.js`, replace the entire `isLiveStale` block:

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
```

with:

```js
// --- livePausedSince -------------------------------------------------------

test('livePausedSince: in-play, stale live node (>10 min) -> returns upd', () => {
    const now = 1_000_000_000_000;
    const upd = now - 11 * 60000;
    assert.equal(app.livePausedSince(now, upd, now - 30 * 60000, 'IN_PLAY'), upd);
});
test('livePausedSince: in-play, fresh live node (<10 min) -> null', () => {
    const now = 1_000_000_000_000;
    assert.equal(app.livePausedSince(now, now - 3 * 60000, now - 30 * 60000, 'IN_PLAY'), null);
});
test('livePausedSince: in-play, NO live node, kickoff 12 min ago -> returns kickoff', () => {
    const now = 1_000_000_000_000;
    const ko = now - 12 * 60000;
    assert.equal(app.livePausedSince(now, null, ko, 'IN_PLAY'), ko);
});
test('livePausedSince: in-play, NO live node, kickoff 4 min ago (grace) -> null', () => {
    const now = 1_000_000_000_000;
    assert.equal(app.livePausedSince(now, null, now - 4 * 60000, 'IN_PLAY'), null);
});
test('livePausedSince: PAUSED/FT -> null', () => {
    const now = 1_000_000_000_000;
    assert.equal(app.livePausedSince(now, now - 30 * 60000, now - 60 * 60000, 'PAUSED'), null);
    assert.equal(app.livePausedSince(now, now - 30 * 60000, now - 60 * 60000, 'FT'), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/pure-logic.test.js`
Expected: FAIL — `app.livePausedSince is not a function`.

- [ ] **Step 3: Replace `isLiveStale` with `livePausedSince`**

In `app.js`, replace:

```js
// A live game whose data hasn't refreshed in LIVE_STALE_MS is "stale" — the live API
// stopped updating. Only in-play games run a clock, so only they can go stale.
const LIVE_STALE_MS = 10 * 60 * 1000;
function isLiveStale(now, upd, status) {
    return status === 'IN_PLAY' && typeof upd === 'number' && (now - upd) > LIVE_STALE_MS;
}
```

with:

```js
// A live game whose data hasn't refreshed in LIVE_STALE_MS is "paused" — the live feed
// stopped (stale node) or never arrived (no node since kickoff). Returns the time of our
// last live data when paused (updatedAt, or kickoff if we never got a node), else null.
// Only in-play games run a clock, so only they can be paused.
const LIVE_STALE_MS = 10 * 60 * 1000;
function livePausedSince(now, upd, kickoffMs, status) {
    if (status !== 'IN_PLAY') return null;
    const ref = (typeof upd === 'number') ? upd : kickoffMs;
    return (now - ref > LIVE_STALE_MS) ? ref : null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/pure-logic.test.js`
Expected: PASS (5 new tests + all existing). (`computeLiveMinute`'s own internal staleness check is unaffected — it does not use `isLiveStale`.)

- [ ] **Step 5: Commit**

```bash
git add app.js tests/pure-logic.test.js
git commit -m "feat: livePausedSince — pause detection with kickoff fallback (replaces isLiveStale)"
```

---

### Task 2: Render the no-data paused state (card + ticker + i18n)

**Files:**
- Modify: `app.js` (`buildLiveCard` top ~1351-1362, `scoreHtml` ~1370-1372, minute block ~1413-1422, badge block ~1424-1433, card root ~1436; `updateLiveMinutes` ~lines 322-340)
- Modify: `i18n.js` (add `live.noLiveData` after each `'live.updatedAgo'`: he ~122, en ~419, es ~705)
- Modify: `index.html` (bump `20260625a` → `20260626a`)
- Test: `tests/manual/live-nodata-harness.html`

**Interfaces:**
- Consumes: `livePausedSince` (Task 1), existing `computeLiveMinute`, `t`, `escapeHtml`.

- [ ] **Step 1: Compute paused state at the top of `buildLiveCard`**

In `app.js` `buildLiveCard`, replace:

```js
    const live = m.live || null;
    const liveStatus = live ? live.status : null;            // 'IN_PLAY' | 'PAUSED' | 'FT'
    const hasResult = m.result !== null && m.result !== undefined;
    const started = parseMatchDate(m.date).getTime() <= Date.now();
    const isFt = liveStatus === 'FT';                        // API says full-time (await official result)
    const isPaused = liveStatus === 'PAUSED';
    const inPlay = started && !hasResult && !isFt && !isPaused;  // actively playing (IN_PLAY or pre-node estimate)
    // Score: official result → live node (incl. FT) → 0-0 once kicked off → none (locked pre-kickoff).
    const score = hasResult ? m.result
                : live ? live
                : started ? { team1Goals: 0, team2Goals: 0 }
                : null;
```

with:

```js
    const live = m.live || null;
    const liveStatus = live ? live.status : null;            // 'IN_PLAY' | 'PAUSED' | 'FT'
    const hasResult = m.result !== null && m.result !== undefined;
    const kickoffMs = parseMatchDate(m.date).getTime();
    const started = kickoffMs <= Date.now();
    const isFt = liveStatus === 'FT';                        // API says full-time (await official result)
    const isPaused = liveStatus === 'PAUSED';
    const inPlay = started && !hasResult && !isFt && !isPaused;  // actively playing (IN_PLAY or pre-node estimate)
    // "Paused": in-play but no fresh live data — the feed died (stale node) or none has
    // arrived since kickoff (e.g. API down). pausedSince = last data time (updatedAt, or
    // kickoff if we never got a node).
    const liveUpd = (live && typeof live.updatedAt === 'number') ? live.updatedAt : null;
    const hadData = !!live;
    const pausedSince = inPlay ? livePausedSince(Date.now(), liveUpd, kickoffMs, 'IN_PLAY') : null;
    const paused = pausedSince !== null;
    const noDataPaused = paused && !hadData;
    // Score: official result → live node (incl. FT) → 0-0 once kicked off → none (locked
    // pre-kickoff). When paused with NO data ever, show "–" (no real score to show).
    const score = hasResult ? m.result
                : live ? live
                : started ? { team1Goals: 0, team2Goals: 0 }
                : null;
```

- [ ] **Step 2: Show "–" in the score when no-data paused**

Replace:

```js
    const scoreHtml = score
        ? `${score.team1Goals}<span class="live-score-sep">–</span>${score.team2Goals}`
        : `<span class="live-not-started">${t('live.notStarted')}</span>`;
```

with:

```js
    const scoreHtml = noDataPaused
        ? '–'
        : (score
            ? `${score.team1Goals}<span class="live-score-sep">–</span>${score.team2Goals}`
            : `<span class="live-not-started">${t('live.notStarted')}</span>`);
```

- [ ] **Step 3: Add `data-hasnode` to the minute element + blank it when no-data paused**

Replace the minute block:

```js
    // Live minute label (only while actually playing — not at FT). Data attrs let the
    // 1s interval tick it between API polls; extra = stoppage minutes ("90+3'").
    const kickoffMs = parseMatchDate(m.date).getTime();
    const apiMin = live && typeof live.minute === 'number' ? live.minute : '';
    const apiExtra = live && typeof live.extra === 'number' ? live.extra : '';
    const upd = live && live.updatedAt ? live.updatedAt : '';
    const minStatus = isPaused ? 'PAUSED' : 'IN_PLAY';
    const minuteHtml = (inPlay || isPaused)
        ? `<span class="live-minute" data-kickoff="${kickoffMs}" data-min="${apiMin}" data-extra="${apiExtra}" data-upd="${upd}" data-status="${minStatus}">${computeLiveMinute(Date.now(), kickoffMs, apiMin === '' ? null : apiMin, apiExtra === '' ? null : apiExtra, upd === '' ? null : upd, minStatus)}</span>`
        : '';
```

with (note: `kickoffMs` is now defined at the top — do NOT redeclare it):

```js
    // Live minute label (only while actually playing — not at FT). Data attrs let the
    // 1s interval tick it between API polls; extra = stoppage minutes ("90+3'").
    const apiMin = live && typeof live.minute === 'number' ? live.minute : '';
    const apiExtra = live && typeof live.extra === 'number' ? live.extra : '';
    const upd = live && live.updatedAt ? live.updatedAt : '';
    const minStatus = isPaused ? 'PAUSED' : 'IN_PLAY';
    const minuteHtml = (inPlay || isPaused)
        ? `<span class="live-minute" data-kickoff="${kickoffMs}" data-min="${apiMin}" data-extra="${apiExtra}" data-upd="${upd}" data-status="${minStatus}" data-hasnode="${hadData ? 1 : 0}">${noDataPaused ? '' : computeLiveMinute(Date.now(), kickoffMs, apiMin === '' ? null : apiMin, apiExtra === '' ? null : apiExtra, upd === '' ? null : upd, minStatus)}</span>`
        : '';
```

- [ ] **Step 4: Badge label uses paused + hadData**

Replace the badge block:

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

with (`liveUpd`/`paused`/`pausedSince`/`hadData` already defined at the top):

```js
    // "Updates paused" badge — covers a stale feed AND no data since kickoff. The card
    // carries a live badge and a paused badge; CSS shows one based on the .live-stale class
    // (set here initially, kept current by updateLiveMinutes).
    const agoInit = paused
        ? escapeHtml((hadData ? t('live.updatedAgo') : t('live.noLiveData')).replace('{n}', String(Math.round((Date.now() - pausedSince) / 60000))))
        : '';
    const badgeHtml = inPlay
        ? `<span class="match-status-badge badge-live live-badge-active">${dot}${t('live.statusLive')}</span>`
          + `<span class="match-status-badge badge-stale live-badge-stale">⏸ <span class="live-stale-ago">${agoInit}</span></span>`
        : `<span class="match-status-badge ${badgeClass}">${dot}${t(statusKey)}</span>`;
```

- [ ] **Step 5: Card root uses `paused`**

In the returned template, change:

```js
    <div class="match-card live-card${stale ? ' live-stale' : ''}" id="live-${m.id}">
```

to:

```js
    <div class="match-card live-card${paused ? ' live-stale' : ''}" id="live-${m.id}">
```

- [ ] **Step 6: Update the ticker `updateLiveMinutes`**

Replace the whole function:

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

with:

```js
function updateLiveMinutes() {
    const now = Date.now();
    document.querySelectorAll('.live-minute').forEach(el => {
        const elapsed = el.dataset.min === '' ? null : +el.dataset.min;
        const extra = el.dataset.extra === '' ? null : +el.dataset.extra;
        const upd = el.dataset.upd === '' ? null : +el.dataset.upd;
        const status = el.dataset.status;
        const kickoff = +el.dataset.kickoff;
        const hasNode = +el.dataset.hasnode;   // 1 = a live node exists; 0 = no data yet
        const pausedSince = livePausedSince(now, upd, kickoff, status);
        const paused = pausedSince !== null;
        // Minute: hide for no-data paused; otherwise compute (freezes had-data via staleMs).
        el.textContent = (paused && hasNode === 0) ? '' : computeLiveMinute(now, kickoff, elapsed, extra, upd, status);
        const card = el.closest('.live-card');
        if (!card) return;
        card.classList.toggle('live-stale', paused);
        if (paused) {
            const ago = card.querySelector('.live-stale-ago');
            if (ago) ago.textContent = (hasNode ? t('live.updatedAgo') : t('live.noLiveData'))
                .replace('{n}', String(Math.round((now - pausedSince) / 60000)));
            if (hasNode === 0) { const sc = card.querySelector('.live-score'); if (sc) sc.textContent = '–'; }
        }
    });
}
```

- [ ] **Step 7: Add the `live.noLiveData` i18n string**

In `i18n.js`, after the Hebrew `'live.updatedAgo': 'עודכן לפני {n} דק׳',` add:

```js
        'live.noLiveData': 'אין עדכון חי · {n} דק׳',
```

After the English `'live.updatedAgo': 'updated {n} min ago',` add:

```js
        'live.noLiveData': 'no live update · {n} min',
```

After the Spanish `'live.updatedAgo': 'actualizado hace {n} min',` add:

```js
        'live.noLiveData': 'sin datos en vivo · {n} min',
```

- [ ] **Step 8: Create the headless harness**

Create `tests/manual/live-nodata-harness.html`:

```html
<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="../../styles.css">
<body style="direction:rtl">
<div id="tab-live" class="tab-panel active"><div id="live-container" class="app-content"></div></div>
<script>window.firebase=undefined;window.db=null;window.currentUser={userId:'u1'};
window.t=k=>({'live.statusLive':'משחק חי','live.notStarted':'טרם החל','live.total':'סה"כ','live.updatedAgo':'עודכן לפני {n} דק׳','live.noLiveData':'אין עדכון חי · {n} דק׳','leaderboard.meTag':'אני','match.yourBet':'ניחוש','groupSettings.unknownUser':'?','live.empty':'אין'}[k]||k);
window.translateTeam=n=>n;window.currentLang='he';</script>
<script src="../../app.js?cb=1"></script>
<script>
  const ago=ms=>new Date(Date.now()-ms).toISOString().slice(0,16);
  // Started 30 min ago, NO live node (API down from kickoff) -> should be paused/no-data.
  Object.assign(matches,{g:{team1:'סנגל',team2:'עיראק',date:ago(30*60000),group:'A',stage:'group'}});
  Object.assign(groupMembers,{u1:{name:'A',totalPoints:10}});
  Object.assign(groupUsersCache,groupMembers);
  Object.assign(allGroupBets,{u1:{g:{team1Goals:1,team2Goals:0}}});
  window.activeTournament='worldcup2026';window.stageFilter='all';renderLive();updateLiveMinutes();
  const card=document.querySelector('.live-card');
  const score=(card.querySelector('.live-score')||{}).textContent||'';
  const min=(card.querySelector('.live-minute')||{}).textContent||'';
  const ago2=(card.querySelector('.live-stale-ago')||{}).textContent||'';
  document.title='STALE:'+card.classList.contains('live-stale')+' DASH:'+(score.trim()==='–')+' MINEMPTY:'+(min==='')+' AGON:'+/\d/.test(ago2);
</script></body>
```

- [ ] **Step 9: Render the harness and verify**

Run:
```bash
CHROME=$(ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
"$CHROME" --headless --disable-gpu --dump-dom "file://$PWD/tests/manual/live-nodata-harness.html" 2>/dev/null | grep -oE '<title>[^<]*</title>'
```
Expected: `<title>STALE:true DASH:true MINEMPTY:true AGON:true</title>` (card paused, score "–", no minute, badge shows a minute count).

- [ ] **Step 10: Bump cache-busting versions**

Run: `sed -i '' 's/20260625a/20260626a/g' index.html && grep -c '20260626a' index.html`
Expected: `6`.

- [ ] **Step 11: Full unit run (no regressions)**

Run: `node --test tests/pure-logic.test.js tests/results-core.test.mjs tests/paul-core.test.mjs tests/poll-interval.test.mjs`
Expected: PASS (all suites).

- [ ] **Step 12: Commit**

```bash
git add app.js i18n.js index.html tests/manual/live-nodata-harness.html
git commit -m "feat: paused indicator covers no-data (frozen '–' score + timer)"
```

---

## Notes for the implementer

- `kickoffMs` is now declared once at the top of `buildLiveCard`; make sure the later minute block does NOT redeclare it (Step 3 removes the duplicate).
- The had-data paused path is unchanged in behavior (score frozen at last live value, clock frozen via `computeLiveMinute`, "updated X min ago"). Only the no-data path is new.
- Frontend-only; no backend change.
- After merge + deploy, the "no live data" indicator appears whenever a started game gets no live node for 10 min (e.g., an API outage) — the live score won't sit at a misleading 0–0.
