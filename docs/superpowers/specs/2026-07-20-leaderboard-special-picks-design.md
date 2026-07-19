# Show Each User's Champion + Golden-Boot Pick on the Leaderboard

**Date:** 2026-07-20
**Status:** Approved

## Goal

On the group leaderboard, show under each member's name the two tournament special bets they
made — **champion** (🏆) and **top scorer / golden boot** (⚽) — with a green **+10** next to a
pick that matches the actual result.

## Background

- `renderLeaderboard()` (app.js) builds rows: rank · name · form dots · points. It has
  `groupMembers`, `groupUsersCache`, `allGroupBets` (all members' match bets), `matches`,
  `tournamentSettings`.
- `tournamentSettings.winner` (Hebrew team) and `tournamentSettings.topScorer` (player) hold the
  actual results (now set: ספרד / Kylian Mbappé).
- **Special bets for all members are NOT currently loaded.** The `specialBets` state
  (`app.js:244`, listener `app.js:969`) is only the *current user's*
  (`specialBets/{gid}/{currentUser.userId}`). We need all members', analogous to how
  `allGroupBets` loads `bets/{gid}` (attach `app.js:975-980`, detach `stopGroupListeners`
  `app.js:836-840`).
- `translateTeam(hebName)` localizes team names; `escapeHtml` exists; both usable in the render.
- Per-user special bet shape: `specialBets/{gid}/{uid}/winner = {team, points}` and
  `/topScorer = {player, points}`.

## Design

### Load all members' special bets (new state + listener)

- Add state: `let allGroupSpecialBets = {};` and `let onAllGroupSpecialBets = null;`
- Attach alongside `onAllGroupBets`:
  ```js
  onAllGroupSpecialBets = snap => {
      allGroupSpecialBets = snap.val() || {};
      if (activeTab === 'leaderboard') renderLeaderboard();
  };
  ref(`specialBets/${currentGroupId}`).on('value', onAllGroupSpecialBets, () => {});
  ```
- Detach in `stopGroupListeners`, mirroring `onAllGroupBets`:
  ```js
  if (onAllGroupSpecialBets) {
      ref(`specialBets/${currentGroupId}`).off('value', onAllGroupSpecialBets);
      onAllGroupSpecialBets = null;
  }
  allGroupSpecialBets = {};
  ```

### Render the picks (renderLeaderboard)

Add a helper and a sub-line inside the name cell:

```js
const specialHtml = uid => {
    const sb = allGroupSpecialBets[uid] || {};
    const champPick = sb.winner && sb.winner.team;
    const bootPick  = sb.topScorer && sb.topScorer.player;
    if (!champPick && !bootPick) return '';
    const actualW = tournamentSettings.winner, actualT = tournamentSettings.topScorer;
    const hit = ' <span class="lb-special-hit">+10</span>';
    const parts = [];
    if (champPick) parts.push(`🏆 ${escapeHtml(translateTeam(champPick))}${(actualW && champPick === actualW) ? hit : ''}`);
    if (bootPick)  parts.push(`⚽ ${escapeHtml(bootPick)}${(actualT && bootPick === actualT) ? hit : ''}`);
    return `<div class="lb-special">${parts.join(' · ')}</div>`;
};
```
Append `${specialHtml(u.userId)}` inside the `<span class="lb-name">…</span>` cell (after the
name + me-tag), so it renders as a muted sub-line beneath the name.

- Picks always show (useful even pre-results); the **+10** only shows when the pick equals the
  actual winner/top-scorer, and only once those results are set.
- A member with no special bet gets no sub-line.

### CSS (styles.css)

```css
.lb-special { display: block; font-size: .7rem; color: #6b7280; margin-top: 2px; line-height: 1.3; }
.lb-special-hit { color: #16a34a; font-weight: 700; }
```

### Cache-busting

Bump every `?v=20260702a` in `index.html` to `20260720a`.

## Testing

Headless harness `tests/manual/lb-specials-harness.html`: set `groupMembers`,
`groupUsersCache`, empty `allGroupBets`/`matches`, `tournamentSettings = {winner:'ספרד',
topScorer:'Kylian Mbappé'}`, and `allGroupSpecialBets` with (a) a member who picked ספרד +
Mbappé (both correct → two +10), (b) a member who picked צרפת + Harry Kane (no +10), (c) a
member with no special bet (no sub-line). Call `renderLeaderboard()` and assert: two `.lb-special`
blocks rendered, exactly two `.lb-special-hit` (+10) for member (a), zero for member (b), and
member (c) has no `.lb-special`. Title-encode the assertions (e.g. `HITS:2 MEMBERB:0 CNONE:true`).

## Out of scope

- Changing scoring or the special-bet award logic (already applied).
- The tournament tab's own champion/top-scorer display (unchanged).
- Showing match-bet details on the leaderboard.
