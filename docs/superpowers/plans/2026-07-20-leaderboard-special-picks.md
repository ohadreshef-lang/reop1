# Leaderboard Champion + Golden-Boot Picks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each member's champion (🏆) and golden-boot (⚽) pick under their name on the leaderboard, with a green +10 next to a pick that matches the actual result.

**Architecture:** Load all members' special bets into a new `allGroupSpecialBets` state (mirroring `allGroupBets`), then render a muted sub-line per leaderboard row. Frontend-only.

**Tech Stack:** Classic-script browser JS (`app.js`, `styles.css`), headless-Chrome harness.

## Global Constraints

- New state `allGroupSpecialBets` loaded from `specialBets/{currentGroupId}` (all members), attached beside `onAllGroupBets` and detached in `stopGroupListeners` — no listener leak on group switch.
- Picks always render; **+10** shows only when a pick equals `tournamentSettings.winner` (champion) / `tournamentSettings.topScorer` (boot), and only once those are set (guard against null).
- Champion is a Hebrew team name → display via `translateTeam`; boot is a player name → as-is; both through `escapeHtml`.
- Emojis 🏆 / ⚽ label the two picks (no new i18n keys).
- Cache-bust: bump every `?v=20260702a` in `index.html` to `20260720a`.
- Do not change scoring, the special-bet award logic, or the tournament tab.
- Headless Chrome: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

---

### Task 1: Load all-members special bets + render picks on the leaderboard

**Files:**
- Modify: `app.js` (state ~217, attach ~975-980, detach ~836-840, `renderLeaderboard`)
- Modify: `styles.css`
- Modify: `index.html` (cache bump)
- Test: `tests/manual/lb-specials-harness.html`

- [ ] **Step 1: Add state**

In `app.js`, after `let allGroupBets = {};` / `let onAllGroupBets = null;` (~line 217-218), add:

```js
let allGroupSpecialBets = {};       // all members' champion/top-scorer bets (for the leaderboard)
let onAllGroupSpecialBets = null;   // named callback so it can be detached precisely
```

- [ ] **Step 2: Attach the listener**

In `app.js`, find the `onAllGroupBets` attach block:

```js
    onAllGroupBets = snap => {
        allGroupBets = snap.val() || {};
        if (activeTab === 'live' && typeof renderLive === 'function') renderLive();
        if (activeTab === 'matches') renderMatches();
    };
    ref(`bets/${currentGroupId}`).on('value', onAllGroupBets, () => {});
}
```

and insert the new listener right before the closing `}`:

```js
    onAllGroupBets = snap => {
        allGroupBets = snap.val() || {};
        if (activeTab === 'live' && typeof renderLive === 'function') renderLive();
        if (activeTab === 'matches') renderMatches();
    };
    ref(`bets/${currentGroupId}`).on('value', onAllGroupBets, () => {});

    onAllGroupSpecialBets = snap => {
        allGroupSpecialBets = snap.val() || {};
        if (activeTab === 'leaderboard') renderLeaderboard();
    };
    ref(`specialBets/${currentGroupId}`).on('value', onAllGroupSpecialBets, () => {});
}
```

- [ ] **Step 3: Detach the listener**

In `stopGroupListeners`, replace:

```js
    if (onAllGroupBets) {
        ref(`bets/${currentGroupId}`).off('value', onAllGroupBets);
        onAllGroupBets = null;
    }
    allGroupBets = {};
}
```

with:

```js
    if (onAllGroupBets) {
        ref(`bets/${currentGroupId}`).off('value', onAllGroupBets);
        onAllGroupBets = null;
    }
    allGroupBets = {};
    if (onAllGroupSpecialBets) {
        ref(`specialBets/${currentGroupId}`).off('value', onAllGroupSpecialBets);
        onAllGroupSpecialBets = null;
    }
    allGroupSpecialBets = {};
}
```

- [ ] **Step 4: Render the picks**

In `renderLeaderboard`, add the helper just before `let html = '<div class="leaderboard-table">';`:

```js
    // Each member's tournament special bets (champion + golden boot), with +10 when correct.
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

Then change the name cell in the row template from:

```js
            <span class="lb-name">${memberLabel(u.userId, u.name)} ${meTag}</span>
```

to:

```js
            <span class="lb-name">${memberLabel(u.userId, u.name)} ${meTag}${specialHtml(u.userId)}</span>
```

- [ ] **Step 5: Add CSS**

In `styles.css`, add (near the other `.lb-*` rules):

```css
.lb-special { display: block; font-size: .7rem; color: #6b7280; margin-top: 2px; line-height: 1.3; }
.lb-special-hit { color: #16a34a; font-weight: 700; }
```

- [ ] **Step 6: Bump cache-busting**

Run: `sed -i '' 's/20260702a/20260720a/g' index.html && grep -c '20260720a' index.html`
Expected: `6`.

- [ ] **Step 7: Create the headless harness**

Create `tests/manual/lb-specials-harness.html`:

```html
<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="../../styles.css">
<body style="direction:rtl">
<div id="tab-leaderboard" class="tab-panel active"><div id="leaderboard-container" class="app-content"></div></div>
<script>window.firebase=undefined;window.db=null;window.currentUser={userId:'u1'};
window.t=k=>({'leaderboard.meTag':'אני','leaderboard.empty':'ריק','common.pts':'נק׳','groupSettings.unknownUser':'?'}[k]||k);
window.translateTeam=n=>n;window.currentLang='he';</script>
<script src="../../app.js?cb=1"></script>
<script>
  window.activeTournament='worldcup2026';window.stageFilter='all';
  Object.assign(tournamentSettings,{winner:'ספרד',topScorer:'Kylian Mbappé'});
  Object.assign(groupMembers,{
    u1:{name:'A',totalPoints:50}, u2:{name:'B',totalPoints:40}, u3:{name:'C',totalPoints:30},
  });
  Object.assign(groupUsersCache,groupMembers);
  Object.assign(allGroupBets,{});
  Object.assign(allGroupSpecialBets,{
    u1:{winner:{team:'ספרד'},topScorer:{player:'Kylian Mbappé'}},          // both correct -> 2x +10
    u2:{winner:{team:'צרפת'},topScorer:{player:'Harry Kane'}},              // both wrong -> 0 +10
    // u3: no special bet -> no sub-line
  });
  renderLeaderboard();
  const specials=[...document.querySelectorAll('.lb-special')];
  const hits=[...document.querySelectorAll('.lb-special-hit')];
  const rows=[...document.querySelectorAll('.leaderboard-row')];
  const cRow=rows.find(r=>/(^|\D)C(\D|$)/.test(r.querySelector('.lb-name').textContent));
  const cNone=cRow && !cRow.querySelector('.lb-special');
  document.title='SPECIALS:'+specials.length+' HITS:'+hits.length+' CNONE:'+!!cNone;
</script></body>
```

- [ ] **Step 8: Render the harness and verify**

Run:
```bash
CHROME=$(ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
"$CHROME" --headless --disable-gpu --dump-dom "file://$PWD/tests/manual/lb-specials-harness.html" 2>/dev/null | grep -oE '<title>[^<]*</title>'
```
Expected: `<title>SPECIALS:2 HITS:2 CNONE:true</title>` (two members show picks, the champion+boot correct pair yields two +10, the no-bet member has no sub-line).

- [ ] **Step 9: Unit suite (no regressions)**

Run: `node --test tests/pure-logic.test.js tests/results-core.test.mjs tests/paul-core.test.mjs`
Expected: PASS (this change is render-only; confirms nothing else broke).

- [ ] **Step 10: Commit**

```bash
git add app.js styles.css index.html tests/manual/lb-specials-harness.html
git commit -m "feat: show each member's champion + golden-boot pick on the leaderboard (+10 when correct)"
```

---

## Notes for the implementer

- Mirror the `allGroupBets` lifecycle exactly for `allGroupSpecialBets` — attach in the same place, detach in `stopGroupListeners` — so switching groups doesn't leak a listener or show stale picks.
- The `+10` is display-only; it reads `tournamentSettings.winner`/`topScorer` and does not change any stored points.
- Guard the `+10` on `actualW`/`actualT` being truthy so nothing shows before the results are set.
