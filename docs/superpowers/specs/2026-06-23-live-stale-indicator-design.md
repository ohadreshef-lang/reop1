# Live "Updates Paused" Indicator (stale live data)

**Date:** 2026-06-23
**Status:** Approved

## Goal

When the live-score API is not working during a live game, the Live view currently keeps
**ticking the clock** (the minute advances off wall-clock) and shows the **last score** with
no hint it's stale — misleading the user into thinking it's current. This feature: once a
live game's data hasn't refreshed for **10 minutes**, **freeze the clock**, **dim the
score**, and **swap the live badge for a neutral "⏸ updated X min ago"** so the user
understands the live view isn't updating right now. Frontend-only.

## Background (current behavior)

- The updater writes `matches/{id}/live = { team1Goals, team2Goals, status, updatedAt,
  minute, extra, scorers }` each poll; `updatedAt` is the last-write time. When API-Football
  fails (quota/429/error), the updater writes nothing for that match, so `updatedAt` goes
  stale (no new write).
- `buildLiveCard` (`app.js`) renders the live card. The minute is a `.live-minute` span with
  `data-kickoff/min/extra/upd/status` (`data-upd` = `updatedAt`). A 1-second interval calls
  `updateLiveMinutes()`, which re-evaluates every `.live-minute` via `computeLiveMinute(now,
  kickoff, elapsed, extra, upd, status)`.
- `computeLiveMinute` ticks the minute forward using wall-clock since `upd` — so with no
  updates it keeps advancing (the bug). It returns `''` for `PAUSED`/`FT`.
- The badge for an in-play card is the red pulsing "משחק חי" (`live.statusLive`) with a
  `.live-dot`.

## Design

### Detection — `isLiveStale(now, upd, status)` (new, pure)

```js
const LIVE_STALE_MS = 10 * 60 * 1000;
function isLiveStale(now, upd, status) {
  return status === 'IN_PLAY' && typeof upd === 'number' && (now - upd) > LIVE_STALE_MS;
}
```

Only in-play cards can be stale (PAUSED/FT have no running clock and convey their own state).
Used by both `buildLiveCard` (initial render) and `updateLiveMinutes` (ongoing), so the two
never disagree.

### Freeze the clock — `computeLiveMinute` gains a `staleMs` param

Add `staleMs = LIVE_STALE_MS` as the final parameter. When the data is stale, clock from
`upd` instead of `now` so the minute stops advancing (frozen at its last real value):

```js
function computeLiveMinute(now, kickoffMs, elapsed, extra, upd, status, staleMs = LIVE_STALE_MS) {
  if (status === 'PAUSED' || status === 'FT') return '';
  const stale = typeof upd === 'number' && (now - upd) > staleMs;
  const clock = stale ? upd : now;                 // frozen reference when stale
  const tick = (upd != null && status === 'IN_PLAY') ? Math.max(0, Math.floor((clock - upd) / 60000)) : 0;
  if (elapsed == null) {
    const est = Math.floor((clock - kickoffMs) / 60000);
    return est > 90 ? "90+'" : (est < 0 ? 0 : est) + "'";
  }
  if (extra != null && extra > 0) return `${elapsed}+${extra + tick}'`;
  return `${elapsed + tick}'`;
}
```

When stale, `clock = upd` → `tick = 0` → returns the frozen `elapsed` (`+extra`); the
estimate branch likewise freezes at `upd`.

### Card visual — `.live-stale` class + dual badge

`buildLiveCard` (in-play cards only):
- Compute `const stale = isLiveStale(Date.now(), live.updatedAt, liveStatus)` and add a
  `live-stale` class to the card root (`.match-card.live-card`) when true.
- Render **two badges** in the header: the existing active badge
  (`<span class="match-status-badge badge-live live-badge-active">${dot}${t('live.statusLive')}</span>`)
  and a stale badge
  (`<span class="match-status-badge badge-stale live-badge-stale">⏸ <span class="live-stale-ago" data-upd="${upd}"></span></span>`).
  CSS shows exactly one based on the `live-stale` class.
- The `.live-stale-ago` span's text is set by the ticker (so it counts up).

### Ongoing toggle — `updateLiveMinutes` (1-second ticker)

For each `.live-minute` element:
- Recompute `stale = isLiveStale(now, upd, status)`.
- `card = el.closest('.live-card'); card.classList.toggle('live-stale', stale);`
- Minute text via `computeLiveMinute(...)` (frozen when stale).
- If stale, set the card's `.live-stale-ago` text to the localized "updated X min ago" with
  `X = Math.round((now - upd) / 60000)`.

When the updater resumes, the fresh `updatedAt` makes the `matches` listener re-render the
card (`renderLive`) → not stale → normal badge/score. (The ticker also reverts it via the
`toggle` if a render hasn't happened yet.)

### i18n (`i18n.js`)

Add `live.updatedAgo` in all three languages, with a `{n}` placeholder the ticker replaces:
- he: `'עודכן לפני {n} דק׳'`
- en: `'updated {n} min ago'`
- es: `'actualizado hace {n} min'`

The ticker builds the text as `t('live.updatedAgo').replace('{n}', X)`.

### CSS (`styles.css`)

- `.live-badge-stale { display: none; }`
- `.live-card.live-stale .live-badge-active { display: none; }`
- `.live-card.live-stale .live-badge-stale { display: inline-flex; }` (neutral grey, no dot)
- `.live-card.live-stale .live-score { opacity: 0.5; }` (dim the frozen score)
- `.badge-stale` styled neutral/grey (distinct from the red `badge-live`).

### Cache-busting (`index.html`)

Bump every `?v=` string (currently `20260620g`/`20260621a` → next, e.g. `20260623a`).

## Data flow

```
updater poll OK      -> live.updatedAt = now      -> card normal (live badge, ticking clock)
updater poll FAILS   -> live not written          -> updatedAt ages
1s ticker each second-> isLiveStale(now, upd)?     -> at >10min: add .live-stale, freeze clock,
                                                      badge -> "⏸ עודכן לפני X דק׳" (X counts up), dim score
updater resumes      -> fresh updatedAt -> re-render -> normal
```

## Edge cases

- **PAUSED (halftime) / FT / finished:** never stale (the clock is already not running; their
  badges convey state). `isLiveStale` returns false for non-`IN_PLAY`.
- **No `updatedAt`:** `isLiveStale` false (can't judge staleness) — no false "paused".
- **No API minute yet (`elapsed == null`):** the estimate freezes at `upd` when stale (no
  real minute to show, but it stops climbing).
- **Brief single late poll (<10 min):** not flagged — threshold absorbs normal jitter.
- **Score legitimately frozen at 0–0 while live + stale:** still correctly shows paused (the
  point is to signal "not updating", independent of the score value).

## Testing

`tests/pure-logic.test.js`:
- `isLiveStale`: IN_PLAY + `upd` 11 min old → true; IN_PLAY + `upd` 3 min old → false;
  PAUSED/FT + old `upd` → false; missing `upd` → false.
- `computeLiveMinute`: with `staleMs` crossed, the minute is frozen (equals the value at
  `upd`, not ticking with `now`); below the threshold it still ticks (existing tests
  unchanged — the new param defaults so they pass).

Headless harness (`tests/manual/live-stale-harness.html`): render a live card whose
`live.updatedAt` is ~12 min old, run `updateLiveMinutes()`, and assert the card has
`live-stale`, the stale badge is shown with "updated … min ago", and the score is dimmed
(class present).

## Out of scope

- Any backend/updater change (this is purely a frontend staleness indicator).
- Distinguishing *why* the API failed (quota vs network) — we only know "no recent update".
- Applying staleness to the Matches tab (only the Live view shows a running clock).
