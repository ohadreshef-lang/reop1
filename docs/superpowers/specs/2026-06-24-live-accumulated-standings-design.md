# Live Standings Accumulate Across Concurrent Games

**Date:** 2026-06-24
**Status:** Approved

## Goal

In the Live tab, each game's card shows a projected leaderboard = `totalPoints + that
one game's provisional points`. When **two or more games are live at once**, each card
adds only its own game, so a player gaining in multiple live games never sees their true
combined standing, and the cards disagree with each other. Fix: the projected total must
**accumulate provisional points across all currently-live games**, consistently on every
card, while each card's `+N` pill still shows that game's own contribution.

## Background (current behavior)

- `renderLive` builds `games` = all Live-tab matches (`isInLiveTab`), sorted, then
  `container.innerHTML = games.map(buildLiveCard).join('')`.
- `buildLiveCard(m)` computes its own projected leaderboard:
  - `score` = `result → live → 0-0 if started → null`.
  - `countedOf(uid)` = this match's stored bet `points` (set when finalized) — subtracted
    from the base to avoid double-counting after finalize.
  - `baseOf(uid)` = `totalPoints − countedOf(uid)`.
  - `matchOf(uid)` = `calcPoints(bet, score)` (missing bet = 0–0).
  - projected total = `baseOf + matchOf`; ordering by `baseOf + matchOf`; arrows vs
    `baseOf`.
- The bug: `baseOf`/`matchOf` only ever consider `m` (this card's game). With multiple
  live games each card under-counts.

## Design

### New pure helper `projectLiveStandings(games, members, bets, now)`

Returns combined projected standings for the whole set of Live-tab games. Pure (uses
`calcPoints`, `parseMatchDate`); unit-testable.

- `gameScore(g)` (same rule as the card): `g.result → g.live → {0,0} if started → null`.
- For each member `uid`:
  - `currentTotal = (members[uid] && members[uid].totalPoints) || 0`.
  - For each game `g` in `games` with a non-null `gameScore(g)`:
    - `bet = (bets[uid] || {})[g.id]`
    - `provisional += calcPoints(bet?bet.team1Goals:0, bet?bet.team2Goals:0, score.team1Goals, score.team2Goals)`
    - `counted += (bet && typeof bet.points === 'number') ? bet.points : 0`
  - `projectedTotal[uid] = currentTotal − counted + provisional`.
    - In-progress game: `counted = 0` → adds live points.
    - Finalized-but-shown game: `counted = final points` (already in `totalPoints`),
      `provisional = same` → net 0 (no double-count).
- `nameOf(uid)` resolves like today (`groupUsersCache` then member name then unknown).
- `oldPos`: rank members by `currentTotal` desc, name tiebreak.
- `orderedUids`: rank by `projectedTotal` desc, then `currentTotal` desc, then name.

Returns `{ orderedUids, projectedTotal, oldPos }` (the latter two keyed by uid).

### `renderLive` (modify)

After building `games`, compute the shared context once:
`const ctx = projectLiveStandings(games, groupMembers, allGroupBets, now);`
and render `games.map(m => buildLiveCard(m, ctx)).join('')`.

### `buildLiveCard(m, ctx)` (modify)

- Keep computing this card's own `score` and `matchOf(uid)` (for the pill / pick).
- Replace the per-card `baseOf`/`oldPos`/`newOrder` with the shared context:
  - Row order = `ctx.orderedUids`.
  - **Total column** = `ctx.projectedTotal[uid]` (identical across all live cards).
  - Rank/medals from position in `ctx.orderedUids`; arrow `delta = ctx.oldPos[uid] − rank`.
  - **Pill** unchanged in spirit: `mp = matchOf(uid)` (this game only); class p4/p1/p0;
    text `+mp` or `–` when this game has no score / mp === 0.
  - **Pick column** = this card's `betOf(uid)` (unchanged).
- No other behavior change. With a single live game, `projectedTotal` equals the old
  `baseOf + matchOf`, so output is identical to today.

## Data flow

```
renderLive
  games = Live-tab matches (existing)
  ctx = projectLiveStandings(games, groupMembers, allGroupBets, now)   // sums ALL live games
  games.map(m => buildLiveCard(m, ctx))
        - total column  = ctx.projectedTotal[uid]   (combined, same on every card)
        - order/arrows  = ctx.orderedUids / ctx.oldPos
        - +N pill       = matchOf(uid) for THIS card's game only
```

## Edge cases

- **One live game:** `projectedTotal == baseOf + matchOf` → output identical to current.
- **Finalized game still in the Live view (within 1h):** contributes net 0 (counted ==
  provisional), so it neither double-counts nor drops — totals stay correct.
- **Not-started locked game (score null):** contributes 0 (no `gameScore`).
- **No bet on a live game:** counts as 0–0 (same as today and as the updater's auto-fill).
- **Empty group / missing totalPoints:** `|| 0` guards keep it safe.

## Testing

`tests/pure-logic.test.js` (or a new `tests/` file) — `projectLiveStandings`:
- Two in-progress games; a member with points in **both** → `projectedTotal` = base + both;
  ordering reflects the combined total.
- A member gaining in only one of the two → only that game's points added.
- A finalized game in the set (its points already in `totalPoints`, bet has `points`) →
  contributes net 0 (no double-count).
- `oldPos` ranks by current `totalPoints`; `orderedUids` by projected.

Headless harness (`tests/manual/live-accumulate-harness.html`): render with **two**
in-progress games; assert both rendered cards show the **same** combined total for a
member, while their `+N` pills differ per game.

## Out of scope

- Any change to how points are finally scored (that stays with the updater).
- A single unified leaderboard layout (chosen: keep per-game cards, combined totals).
- Backend/data changes.
