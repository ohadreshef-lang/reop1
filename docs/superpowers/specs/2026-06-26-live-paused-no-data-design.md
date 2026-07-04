# Live "Paused" Indicator Covers No-Data (Frozen Score + Timer)

**Date:** 2026-06-26
**Status:** Approved

## Goal

The existing "updates paused" indicator only triggers when a live node exists and goes
stale (`now − updatedAt > 10 min`). When the live API is unavailable **from kickoff**
(e.g. the account is suspended), a started game never gets a live node, so the card shows
a misleading **0–0 with a ticking estimated clock**. Extend the paused state to cover this
no-data case: **freeze the score** (show "–" when we never had data), **stop the clock**,
and show a **timer of how long it's been frozen**.

## Background (current behavior)

- `LIVE_STALE_MS = 10 * 60 * 1000`. `isLiveStale(now, upd, status)` = `status === 'IN_PLAY'
  && typeof upd === 'number' && now − upd > LIVE_STALE_MS`. Used by `buildLiveCard`
  (initial `stale`) and `updateLiveMinutes` (the 1-second ticker).
- When stale: `.live-stale` class on the card dims the score, swaps the red live badge for
  `⏸ <span class="live-stale-ago">…</span>` (filled with `t('live.updatedAgo')` = "עודכן
  לפני {n} דק׳"), and `computeLiveMinute` freezes the clock.
- A card with no live node: `live` is null → `upd` null → `isLiveStale` false → not paused
  → `score = 0-0 if started` and `computeLiveMinute` estimates from kickoff (ticks). This is
  the bug.
- The minute element (`.live-minute`) is rendered for every in-play card and carries
  `data-kickoff/min/extra/upd/status`; the ticker drives the minute off it.

## Design

### Pure detector — `livePausedSince(now, upd, kickoffMs, status)` (replaces `isLiveStale`)

Returns the **timestamp of our last live data** when the card is paused, else `null`:

```js
function livePausedSince(now, upd, kickoffMs, status) {
    if (status !== 'IN_PLAY') return null;                 // HT/FT convey their own state
    const ref = (typeof upd === 'number') ? upd : kickoffMs;  // had data → updatedAt; none → kickoff
    return (now - ref > LIVE_STALE_MS) ? ref : null;
}
```

- Live node went stale → `ref = updatedAt` (existing behavior).
- No live node, >10 min past kickoff → `ref = kickoff` (new).
- Fresh data, or <10 min since kickoff with no data (grace for the first poll) → `null`.

`isLiveStale` is removed; its call sites and tests move to `livePausedSince`.

### `buildLiveCard` (modify)

- `const liveUpd = live && typeof live.updatedAt === 'number' ? live.updatedAt : null;`
  `const hadData = !!live;`
- `const pausedSince = inPlay ? livePausedSince(Date.now(), liveUpd, kickoffMs, 'IN_PLAY') : null;`
  `const paused = pausedSince !== null;`
- **Score:** if `inPlay && paused && !hadData` → render **`–`** (unknown). Otherwise the
  existing score (`result → live → 0-0 if started → null`). A paused game that *had* data
  keeps showing its last live score (frozen), as today.
- **Card class:** add `live-stale` when `paused` (existing class, now also covers no-data).
- **Minute element:** still rendered for in-play; add `data-hasnode="${hadData ? 1 : 0}"`.
  Initial text: if `paused && !hadData` → empty (no minute we can trust); else the current
  `computeLiveMinute(...)`.
- **Paused badge label:** the `⏸` stale badge's `.live-stale-ago` span initial text =
  when `paused`: `(hadData ? t('live.updatedAgo') : t('live.noLiveData')).replace('{n}', X)`
  with `X = Math.round((Date.now() − pausedSince) / 60000)`; else `''`.

### `updateLiveMinutes` (the 1-second ticker) (modify)

For each `.live-minute` element (one per in-play card):
- Read `kickoff`, `elapsed`, `extra`, `upd` (or null), `status`, `hasnode` (`+dataset.hasnode`).
- `pausedSince = livePausedSince(now, upd, kickoff, status)`; `paused = pausedSince !== null`.
- `card = el.closest('.live-card')`; `card.classList.toggle('live-stale', paused)`.
- **Minute text:** `(paused && hasnode === 0) ? '' : computeLiveMinute(now, kickoff, elapsed, extra, upd, status)`.
  (For a had-data paused card, `computeLiveMinute` already freezes via its `staleMs` guard.)
- **Badge:** if `paused`, set `.live-stale-ago` text to
  `(hasnode ? t('live.updatedAgo') : t('live.noLiveData')).replace('{n}', Math.round((now − pausedSince)/60000))`.
- **Score:** if `paused && hasnode === 0`, set the card's `.live-score` textContent to `–`
  (so a card that crosses the 10-min mark while open flips from 0–0 to "–" without a
  re-render — important because no re-render will come while the API is down).

When the API recovers, a live node is written → the matches listener re-renders → `hadData`
true, paused recomputed fresh → normal live display.

### i18n (`i18n.js`)

Add `live.noLiveData` in all three languages (keep `live.updatedAgo`):
- he: `'אין עדכון חי · {n} דק׳'`
- en: `'no live update · {n} min'`
- es: `'sin datos en vivo · {n} min'`

### CSS

No new rules required — the existing `.live-stale` already dims `.live-score` and shows the
`⏸` badge. The "–" is plain text in `.live-score`.

### Cache-busting (`index.html`)

Bump every `?v=` string (currently `20260625a`) to the next version.

## Data flow

```
buildLiveCard / 1s ticker:
  pausedSince = livePausedSince(now, upd, kickoff, IN_PLAY)   // upd→had data; else kickoff
  paused?  -> .live-stale on card; freeze/hide clock; badge "⏸ <timer>";
              score = frozen last-live (had data) OR "–" (no data)
  not paused -> normal live card
API recovers -> live node written -> re-render -> normal
```

## Edge cases

- **First ~10 min, no data yet:** not paused (grace) — shows 0–0 estimating, as today, until
  the first poll should have arrived.
- **Had data then feed died:** paused after 10 min stale; score frozen at last live value,
  clock frozen, badge "updated X min ago". (Existing behavior, unchanged.)
- **No data from kickoff (suspension):** paused after 10 min past kickoff; score "–", no
  clock, badge "no live update · X min" (X from kickoff).
- **Halftime (PAUSED) / FT / finished / not-started:** never "paused" (`status !== 'IN_PLAY'`
  or not in-play) — unchanged.
- **Recovery mid-game:** new live node → re-render → normal.

## Testing

`tests/pure-logic.test.js` — replace the `isLiveStale` tests with `livePausedSince`:
- in-play, `upd` 11 min old → returns `upd` (paused).
- in-play, `upd` 3 min old → `null`.
- in-play, **no upd**, kickoff 12 min ago → returns `kickoff` (paused — the new case).
- in-play, **no upd**, kickoff 4 min ago → `null` (grace).
- PAUSED / FT + old `upd` → `null`.

Headless harness (`tests/manual/live-nodata-harness.html`): a started game (~30 min ago)
with `live: null` (no data); after `renderLive()` + `updateLiveMinutes()`, assert the card
has `live-stale`, the score shows `–`, the minute is empty, and the badge shows the
"no live update" text with a minute count.

## Out of scope

- Fetching data / fixing the API suspension (account-level; the dashboard).
- Any backend/updater change; final results via football-data are unaffected.
- Changing the 10-minute threshold (reuses `LIVE_STALE_MS`).
