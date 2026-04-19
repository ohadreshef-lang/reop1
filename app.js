// ============================================================
// WORLD CUP 2026 BETTING APP
// ============================================================

const FB_ROOT = 'worldcup2026';

// ---- Stage / flag helpers ----

function getStageLabel(stage) {
    return t('stage.' + stage);
}
function getGroupPrefix() { return t('stage.groupPrefix'); }

const STAGE_ORDER = ['group','R32','R16','QF','SF','3rd','Final'];

const TEAM_FLAGS = {
    'ארצות הברית':'🇺🇸','קנדה':'🇨🇦','מקסיקו':'🇲🇽',
    'ברזיל':'🇧🇷','ארגנטינה':'🇦🇷','אורוגוואי':'🇺🇾',
    'קולומביה':'🇨🇴','אקוודור':'🇪🇨','ונצואלה':'🇻🇪',
    'פרגוואי':'🇵🇾','בוליביה':'🇧🇴','צ\'ילה':'🇨🇱',
    'צרפת':'🇫🇷','ספרד':'🇪🇸','גרמניה':'🇩🇪',
    'אנגליה':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','פורטוגל':'🇵🇹','הולנד':'🇳🇱',
    'איטליה':'🇮🇹','בלגיה':'🇧🇪','שווייץ':'🇨🇭',
    'קרואטיה':'🇭🇷','סרביה':'🇷🇸','דנמרק':'🇩🇰',
    'אוסטריה':'🇦🇹','סקוטלנד':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','טורקיה':'🇹🇷',
    'רומניה':'🇷🇴','הונגריה':'🇭🇺','פולין':'🇵🇱',
    'מרוקו':'🇲🇦','סנגל':'🇸🇳','ניגריה':'🇳🇬',
    'מצרים':'🇪🇬','קמרון':'🇨🇲',"חוף השנהב":'🇨🇮',
    "אלג'יריה":'🇩🇿','תוניסיה':'🇹🇳','דרום אפריקה':'🇿🇦',
    'יפן':'🇯🇵','קוריאה הדרומית':'🇰🇷','איראן':'🇮🇷',
    'ערב הסעודית':'🇸🇦','אוסטרליה':'🇦🇺','עיראק':'🇮🇶',
    'ירדן':'🇯🇴','אוזבקיסטן':'🇺🇿','ניו זילנד':'🇳🇿',
    'הונדורס':'🇭🇳','פנמה':'🇵🇦','קוסטה ריקה':'🇨🇷',
    "צ'כיה":'🇨🇿','קטאר':'🇶🇦','בוסניה והרצגובינה':'🇧🇦',
    'האיטי':'🇭🇹','קוראסאו':'🇨🇼','שוודיה':'🇸🇪',
    'קאבו ורדה':'🇨🇻','נורווגיה':'🇳🇴',"קונגו DR":'🇨🇩','גאנה':'🇬🇭',
};

function getFlag(name) {
    return TEAM_FLAGS[name] || '🏳️';
}

// All 48 teams participating in World Cup 2026 (Hebrew keys, canonical DB form)
const PARTICIPATING_TEAMS = [
    'מקסיקו','דרום אפריקה','קוריאה הדרומית',"צ'כיה",
    'קנדה','בוסניה והרצגובינה','שווייץ','קטאר',
    'ברזיל','מרוקו','האיטי','סקוטלנד',
    'ארצות הברית','פרגוואי','אוסטרליה','טורקיה',
    'גרמניה','קוראסאו','חוף השנהב','אקוודור',
    'הולנד','יפן','שוודיה','תוניסיה',
    'בלגיה','מצרים','איראן','ניו זילנד',
    'ספרד','קאבו ורדה','ערב הסעודית','אורוגוואי',
    'צרפת','סנגל','עיראק','נורווגיה',
    'ארגנטינה',"אלג'יריה",'אוסטריה','ירדן',
    'פורטוגל','קונגו DR','אוזבקיסטן','קולומביה',
    'אנגליה','קרואטיה','גאנה','פנמה',
];

function getSortedParticipatingTeams() {
    return [...PARTICIPATING_TEAMS].sort((a, b) =>
        translateTeam(a).localeCompare(translateTeam(b), currentLang)
    );
}

// ---- Scoring ----

function getOutcome(g1, g2) {
    if (g1 > g2) return 'win1';
    if (g1 < g2) return 'win2';
    return 'draw';
}

function calcPoints(betGoals1, betGoals2, resGoals1, resGoals2) {
    if (betGoals1 === resGoals1 && betGoals2 === resGoals2) return 3;
    if (getOutcome(betGoals1, betGoals2) === getOutcome(resGoals1, resGoals2)) return 1;
    return 0;
}

// ---- App State ----

let currentUser = null; // { userId, name, email }
let matches      = {};  // matchId → match object
let userBets     = {};  // matchId → bet object (current user, current group)
let activeTab    = 'matches';
let stageFilter  = 'all';
let isAdminMode  = false;
let isAdminAuthed = false;
let pendingResultMatchId = null;
let pendingEditMatchId   = null;

// ---- Multi-group state ----
let currentGroupId = null;          // active group the user is viewing
let userGroups     = {};            // groupId → { name, ownerId, inviteCode }
let groupMembers   = {};            // userId → { joinedAt, totalPoints } (current group)
let groupUsersCache = {};           // userId → { name, email }  (for leaderboard display)
let groupSwitchMenuOpen = false;

// ---- Tournament bets state ----
let tournamentSettings = { teams: [], scorers: [], winner: null, topScorer: null };
let specialBets        = {};   // { winner: {team, points, placedAt}, topScorer: {...} }
let tournamentCountdownTimer = null;

const TOURNAMENT_POINTS = 10;

const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
function generateInviteCode() {
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += INVITE_ALPHABET.charAt(Math.floor(Math.random() * INVITE_ALPHABET.length));
    }
    return code;
}

// ---- Firebase refs ----

function ref(path) {
    return db.ref(`${FB_ROOT}/${path}`);
}

// ---- Utilities ----

function emailToId(email) {
    return email.toLowerCase().replace(/[.#$[\]/]/g, '_');
}

// Stored dates have no timezone suffix and are intended as Israeli time (IDT = UTC+3).
// Appending +03:00 ensures they're parsed correctly regardless of the host environment.
function parseMatchDate(dateStr) {
    if (!dateStr) return new Date(0);
    return new Date(dateStr + '+03:00');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    // Stored dates are in Israeli time (IDT = UTC+3). Render in viewer's local timezone.
    return parseMatchDate(dateStr).toLocaleString('he-IL', {
        weekday: 'short', day: 'numeric', month: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function matchIsLocked(match) {
    return parseMatchDate(match.date) - new Date() <= 60 * 60 * 1000;
}

function $ (id) { return document.getElementById(id); }

function show(id)  { const e=$(id); e.classList.remove('hidden'); e.style.display=''; }
function hide(id)  { const e=$(id); e.classList.add('hidden'); }
function showEl(el){ el.classList.remove('hidden'); el.style.display=''; }
function hideEl(el){ el.classList.add('hidden'); }


// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    isAdminMode = new URLSearchParams(window.location.search).has('admin');

    if (isAdminMode) {
        show('admin-panel');
        hide('login-screen');
        hide('main-app');
        setupAdminListeners();
    } else {
        // Try auto-login from localStorage
        const saved = localStorage.getItem('wc2026_user');
        if (saved) {
            try {
                currentUser = JSON.parse(saved);
                routeAfterLogin();
            } catch(e) {
                showLoginScreen();
            }
        } else {
            showLoginScreen();
        }
    }

    // Global UI listeners
    $('login-form').addEventListener('submit', handleLogin);
    $('btn-logout').addEventListener('click', handleLogout);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => setStageFilter(btn.dataset.stage));
    });

    // Modal cancel buttons
    $('btn-cancel-result').addEventListener('click', () => hide('result-modal'));
    $('btn-cancel-edit').addEventListener('click',   () => hide('edit-modal'));
    $('btn-cancel-edit-user').addEventListener('click', () => hide('edit-user-modal'));
    $('btn-save-result').addEventListener('click', saveResult);
    $('btn-save-edit').addEventListener('click', saveEditMatch);
    $('btn-save-edit-user').addEventListener('click', saveEditUser);

    // Admin back
    $('btn-admin-back').addEventListener('click', () => {
        window.location.href = window.location.pathname;
    });

    // Group UI (switcher, picker, modals)
    if (!isAdminMode) setupGroupUIListeners();
});

function showLoginScreen() {
    show('login-screen');
    hide('main-app');
    hide('admin-panel');
    hide('group-picker-screen');
}

function showGroupPicker() {
    hide('login-screen');
    hide('main-app');
    hide('admin-panel');
    show('group-picker-screen');
    if (currentUser) $('picker-username').textContent = currentUser.name;
}

// Called after login. Checks what groups the user belongs to and routes accordingly.
async function routeAfterLogin() {
    if (!db) {
        // Offline fallback — no groups possible, just show a minimal state
        showGroupPicker();
        return;
    }
    try {
        const snap = await ref(`userGroups/${currentUser.userId}`).once('value');
        const groups = snap.val() || {};
        const groupIds = Object.keys(groups);

        if (groupIds.length === 0) {
            showGroupPicker();
            return;
        }

        // Restore last active group if still valid
        const lastActive = localStorage.getItem('wc2026_activeGroup');
        const chosen = (lastActive && groupIds.includes(lastActive)) ? lastActive : groupIds[0];
        enterAppForGroup(chosen);
    } catch (err) {
        console.warn('routeAfterLogin error:', err.message);
        showGroupPicker();
    }
}

function enterAppForGroup(groupId) {
    currentGroupId = groupId;
    localStorage.setItem('wc2026_activeGroup', groupId);
    hide('login-screen');
    hide('group-picker-screen');
    show('main-app');
    $('header-username').textContent = currentUser.name;
    startFirebaseListeners();
    renderCurrentTab();
}

// ============================================================
// AUTH
// ============================================================

async function handleLogin(e) {
    e.preventDefault();
    const name  = $('input-name').value.trim();
    const email = $('input-email').value.trim().toLowerCase();
    const errEl = $('login-error');
    hideEl(errEl);

    if (!name || !email) {
        errEl.textContent = t('login.errorRequired');
        showEl(errEl);
        return;
    }

    const userId = emailToId(email);
    currentUser = { userId, name, email };
    localStorage.setItem('wc2026_user', JSON.stringify(currentUser));

    // Sync to Firebase (awaited so we know the user node exists before routing)
    if (db) {
        try {
            const snap = await ref(`users/${userId}`).once('value');
            if (!snap.exists()) {
                await ref(`users/${userId}`).set({ name, email });
            } else {
                await ref(`users/${userId}/name`).set(name);
            }
        } catch (err) {
            console.warn('Firebase user sync failed:', err.message);
        }
    }

    await routeAfterLogin();
}

function stopGroupListeners() {
    if (!db || !currentGroupId || !currentUser) return;
    ref(`groups/${currentGroupId}/members`).off();
    ref(`bets/${currentGroupId}/${currentUser.userId}`).off();
}

function handleLogout() {
    if (db) {
        ref('matches').off();
        stopGroupListeners();
        if (currentUser) ref(`userGroups/${currentUser.userId}`).off();
    }
    currentUser = null;
    currentGroupId = null;
    userGroups = {};
    groupMembers = {};
    groupUsersCache = {};
    localStorage.removeItem('wc2026_user');
    localStorage.removeItem('wc2026_activeGroup');
    matches  = {};
    userBets = {};
    showLoginScreen();
}

// ============================================================
// FIREBASE LISTENERS
// ============================================================

function startFirebaseListeners() {
    if (!db) {
        renderMatches();
        renderLeaderboard();
        renderMyBets();
        return;
    }

    const permissionError = () => {
        $('matches-container').innerHTML =
            '<p class="state-msg" style="color:#e53e3e">⚠️ שגיאת הרשאות Firebase.<br>עדכן את חוקי מסד הנתונים ל-read/write פתוח.<br><a href="https://console.firebase.google.com" target="_blank">פתח Firebase Console</a></p>';
    };

    // Matches (global — shared across groups)
    ref('matches').on('value', snap => {
        matches = snap.val() || {};
        if (activeTab === 'matches') renderMatches();
        if (activeTab === 'my-bets') renderMyBets();
        if (activeTab === 'tournament') renderTournament();
    }, permissionError);

    // Tournament settings (global)
    ref('settings/tournament').on('value', snap => {
        const t = snap.val() || {};
        tournamentSettings = {
            teams:     Object.values(t.teams || {}),
            scorers:   Object.values(t.scorers || {}),
            winner:    t.winner || null,
            topScorer: t.topScorer || null,
        };
        if (activeTab === 'tournament') renderTournament();
    }, () => {});

    // User's groups (for switcher UI + routing on group deletion)
    if (currentUser) {
        ref(`userGroups/${currentUser.userId}`).on('value', async snap => {
            const gids = Object.keys(snap.val() || {});
            // Fetch metadata for each group
            const meta = {};
            await Promise.all(gids.map(async gid => {
                const gsnap = await ref(`groups/${gid}`).once('value');
                const g = gsnap.val();
                if (g) meta[gid] = { name: g.name, ownerId: g.ownerId, inviteCode: g.inviteCode };
            }));
            userGroups = meta;
            // If the active group was deleted out from under us, bounce to picker or another group
            if (currentGroupId && !meta[currentGroupId]) {
                stopGroupListeners();
                const fallback = Object.keys(meta)[0];
                if (fallback) {
                    enterAppForGroup(fallback);
                } else {
                    currentGroupId = null;
                    showGroupPicker();
                }
                return;
            }
            renderGroupSwitcher();
        }, () => {});
    }

    if (!currentGroupId) return;

    // Group members (drives leaderboard + totals)
    ref(`groups/${currentGroupId}/members`).on('value', async snap => {
        groupMembers = snap.val() || {};
        // Fetch user names for display
        const missing = Object.keys(groupMembers).filter(uid => !groupUsersCache[uid]);
        await Promise.all(missing.map(async uid => {
            const usnap = await ref(`users/${uid}`).once('value');
            const u = usnap.val();
            if (u) groupUsersCache[uid] = { name: u.name, email: u.email };
        }));
        if (activeTab === 'leaderboard') renderLeaderboard();
    }, () => {});

    // Current user's bets, scoped to active group
    if (currentUser) {
        ref(`bets/${currentGroupId}/${currentUser.userId}`).on('value', snap => {
            userBets = snap.val() || {};
            if (activeTab === 'matches')  renderMatches();
            if (activeTab === 'my-bets') renderMyBets();
        }, () => {});

        // Special tournament bets for this user in this group
        ref(`specialBets/${currentGroupId}/${currentUser.userId}`).on('value', snap => {
            specialBets = snap.val() || {};
            if (activeTab === 'tournament') renderTournament();
        }, () => {});
    }
}

// ============================================================
// TAB NAVIGATION
// ============================================================

function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === `tab-${tab}`);
        p.style.display = p.id === `tab-${tab}` ? 'block' : 'none';
    });
    renderCurrentTab();
}

function renderCurrentTab() {
    if (activeTab === 'matches')     renderMatches();
    else if (activeTab === 'leaderboard') renderLeaderboard();
    else if (activeTab === 'my-bets')     renderMyBets();
    else if (activeTab === 'tournament')  renderTournament();

    if (activeTab === 'tournament') startTournamentCountdown();
    else stopTournamentCountdown();
}

function setStageFilter(stage) {
    stageFilter = stage;
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.stage === stage);
    });
    renderMatches();
}


// ============================================================
// RENDER: MATCHES TAB
// ============================================================

function renderMatches() {
    const container = $('matches-container');

    const matchList = Object.entries(matches)
        .map(([id, m]) => ({ id, ...m }))
        .filter(m => stageFilter === 'all' || m.stage === stageFilter)
        .sort((a, b) => {
            const diff = parseMatchDate(a.date) - parseMatchDate(b.date);
            if (diff !== 0) return diff;
            return (a.group || '').localeCompare(b.group || '');
        });

    if (matchList.length === 0) {
        container.innerHTML = `<p class="state-msg">${t('match.emptyState')}</p>`;
        return;
    }

    let html = '';
    matchList.forEach(m => { html += buildMatchCard(m); });

    container.innerHTML = html;

    // Attach bet-save listeners
    container.querySelectorAll('.btn-save-bet').forEach(btn => {
        btn.addEventListener('click', () => saveBet(btn.dataset.matchId));
    });
    container.querySelectorAll('.bet-edit-link').forEach(btn => {
        btn.addEventListener('click', () => unlockBetEdit(btn.dataset.matchId));
    });
}

function buildMatchCard(m) {
    const locked = matchIsLocked(m);
    const bet    = userBets[m.id];
    const hasResult = m.result !== null && m.result !== undefined;

    // Status badge
    let badgeClass, badgeText;
    if (hasResult) {
        badgeClass = 'badge-completed'; badgeText = t('match.status.completed');
    } else if (locked) {
        badgeClass = 'badge-locked'; badgeText = t('match.status.locked');
    } else {
        badgeClass = 'badge-upcoming'; badgeText = t('match.status.upcoming');
    }

    // Middle content
    let middleHtml = '';
    if (hasResult) {
        middleHtml = `<div class="result-score">${m.result.team1Goals} – ${m.result.team2Goals}</div>`;
    } else if (locked) {
        if (bet) {
            middleHtml = `
                <div class="my-bet-label">${t('match.yourBet')}</div>
                <div class="my-bet-score">${bet.team1Goals} – ${bet.team2Goals}</div>
                <div class="bet-locked-msg">${t('match.lockedMsg')}</div>`;
        } else {
            middleHtml = `<div class="bet-locked-msg">${t('match.lockedNoBet')}</div>`;
        }
    } else {
        // Show bet form (or saved bet with edit option)
        if (bet && !bet._editing) {
            middleHtml = `
                <div class="my-bet-label">${t('match.yourBet')}</div>
                <div class="my-bet-score">${bet.team1Goals} – ${bet.team2Goals}</div>
                <button class="bet-edit-link" data-match-id="${m.id}">${t('match.editBet')}</button>`;
        } else {
            const v1 = bet ? bet.team1Goals : 0;
            const v2 = bet ? bet.team2Goals : 0;
            middleHtml = `
                <div class="bet-inputs">
                    <input type="number" class="bet-score-input" id="bet1-${m.id}" min="0" max="30" value="${v1}" onfocus="this.select()">
                    <span class="bet-sep">–</span>
                    <input type="number" class="bet-score-input" id="bet2-${m.id}" min="0" max="30" value="${v2}" onfocus="this.select()">
                </div>
                <button class="btn-save-bet" data-match-id="${m.id}">${t('match.saveBet')}</button>`;
        }
    }

    // Points row (only if match completed and user had a bet)
    let pointsHtml = '';
    if (hasResult && bet && bet.points !== null && bet.points !== undefined) {
        const pts = bet.points;
        const cls = pts === 3 ? 'points-3' : pts === 1 ? 'points-1' : 'points-0';
        const emoji = pts === 3 ? '🎯' : pts === 1 ? '✅' : '❌';
        pointsHtml = `<div class="match-points-row ${cls}">${emoji} ${t('match.pointsRow')}: ${bet.team1Goals}–${bet.team2Goals} | ${pts} ${t('match.pointsLabel')}</div>`;
    } else if (hasResult && !bet) {
        pointsHtml = `<div class="match-points-row points-na">${t('match.noBetRow')}</div>`;
    }

    return `
    <div class="match-card" id="card-${m.id}">
        <div class="match-card-header">
            <span class="match-date-str">${formatDate(m.date)}</span>
            <span class="match-status-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="match-card-body">
            <div class="match-teams-row">
                <div class="match-team">
                    <span class="team-flag">${getFlag(m.team1)}</span>
                    <span class="team-name">${translateTeam(m.team1)}</span>
                </div>
                <div class="match-middle">${middleHtml}</div>
                <div class="match-team">
                    <span class="team-flag">${getFlag(m.team2)}</span>
                    <span class="team-name">${translateTeam(m.team2)}</span>
                </div>
            </div>
            ${pointsHtml}
        </div>
    </div>`;
}

// ============================================================
// BET ACTIONS
// ============================================================

async function saveBet(matchId) {
    if (!currentUser || !currentGroupId || !db) return;
    const m = matches[matchId];
    if (!m || matchIsLocked(m)) return;

    const g1 = parseInt($(`bet1-${matchId}`).value, 10);
    const g2 = parseInt($(`bet2-${matchId}`).value, 10);

    if (isNaN(g1) || isNaN(g2) || g1 < 0 || g2 < 0) return;

    await ref(`bets/${currentGroupId}/${currentUser.userId}/${matchId}`).set({
        team1Goals: g1,
        team2Goals: g2,
        placedAt:   Date.now(),
        points:     null,
    });

    // Remove _editing flag so saved state shows
    if (userBets[matchId]) delete userBets[matchId]._editing;
}

function unlockBetEdit(matchId) {
    if (!userBets[matchId]) return;
    userBets[matchId]._editing = true;
    renderMatches();
}


// ============================================================
// RENDER: LEADERBOARD
// ============================================================

function renderLeaderboard() {
    const container = $('leaderboard-container');

    const entries = Object.entries(groupMembers)
        .map(([uid, m]) => ({
            userId: uid,
            name: (groupUsersCache[uid] && groupUsersCache[uid].name) || t('groupSettings.unknownUser'),
            totalPoints: m.totalPoints || 0,
        }))
        .sort((a, b) => b.totalPoints - a.totalPoints);

    if (entries.length === 0) {
        container.innerHTML = `<p class="state-msg">${t('leaderboard.empty')}</p>`;
        return;
    }

    let html = '<div class="leaderboard-table">';
    entries.forEach((u, i) => {
        const rank    = i + 1;
        const isMe    = currentUser && u.userId === currentUser.userId;
        const medal   = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        const meTag   = isMe ? `<span class="lb-me-tag">${t('leaderboard.meTag')}</span>` : '';
        html += `
        <div class="leaderboard-row ${isMe ? 'is-me' : ''}">
            <span class="lb-rank">${medal}</span>
            <span class="lb-name">${escapeHtml(u.name)} ${meTag}</span>
            <span class="lb-points">${u.totalPoints} <span class="lb-pts-label">${t('common.pts')}</span></span>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

// ============================================================
// RENDER: MY BETS
// ============================================================

function renderMyBets() {
    const container = $('my-bets-container');
    if (!currentUser) return;

    const betEntries = Object.entries(userBets).filter(([, b]) => !b._editing);
    if (betEntries.length === 0) {
        container.innerHTML = `<p class="state-msg">${t('myBets.empty')}</p>`;
        return;
    }

    // Sort by match date
    const sorted = betEntries
        .map(([matchId, bet]) => ({ matchId, bet, match: matches[matchId] }))
        .filter(x => x.match)
        .sort((a, b) => parseMatchDate(a.match.date) - parseMatchDate(b.match.date));

    let html = '';
    sorted.forEach(({ matchId, bet, match: m }) => {
        const hasResult = m.result !== null && m.result !== undefined;
        const pts = bet.points;

        let ptsBadge = '';
        if (hasResult && pts !== null && pts !== undefined) {
            const cls = pts === 3 ? 'points-3' : pts === 1 ? 'points-1' : 'points-0';
            ptsBadge = `<span class="match-points-row ${cls}" style="display:inline-block;padding:2px 10px;">${pts} ${t('common.pts')}</span>`;
        }

        const resultStr = hasResult
            ? `<div class="my-bet-col">
                 <span class="my-bet-col-label">${t('myBets.result')}</span>
                 <span class="my-bet-col-value result-val">${m.result.team1Goals}–${m.result.team2Goals}</span>
               </div>`
            : '';

        const stageLabel = m.stage === 'group'
            ? `${getGroupPrefix()} ${m.group || ''}`
            : getStageLabel(m.stage);

        html += `
        <div class="my-bet-card">
            <div class="my-bet-match-info">
                <span class="my-bet-teams">${getFlag(m.team1)} ${escapeHtml(translateTeam(m.team1))} vs ${escapeHtml(translateTeam(m.team2))} ${getFlag(m.team2)}</span>
                <span class="my-bet-date">${stageLabel} · ${formatDate(m.date)}</span>
            </div>
            <div class="my-bet-scores-row">
                <div class="my-bet-col">
                    <span class="my-bet-col-label">${t('myBets.prediction')}</span>
                    <span class="my-bet-col-value">${bet.team1Goals}–${bet.team2Goals}</span>
                </div>
                ${resultStr}
                ${ptsBadge ? `<div class="my-bet-col">${ptsBadge}</div>` : ''}
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

// ============================================================
// TOURNAMENT BETS (winner + top scorer)
// ============================================================

function tournamentLockTime() {
    // Lock = 1 hour before the first match kicks off
    const dates = Object.values(matches)
        .map(m => parseMatchDate(m.date).getTime())
        .filter(t => t > 0)
        .sort((a, b) => a - b);
    if (dates.length === 0) return null;
    return dates[0] - 60 * 60 * 1000;
}

function tournamentIsLocked() {
    const lock = tournamentLockTime();
    if (!lock) return false;
    return Date.now() >= lock;
}

function formatCountdown(ms) {
    if (ms <= 0) return '0';
    const total = Math.floor(ms / 1000);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (d > 0) return `${d} ${t('tournament.days')}, ${h} ${t('tournament.hours')}, ${m} ${t('tournament.minutes')}`;
    if (h > 0) return `${h} ${t('tournament.hours')}, ${m} ${t('tournament.minutes')}, ${s} ${t('tournament.seconds')}`;
    return `${m} ${t('tournament.minutes')}, ${s} ${t('tournament.seconds')}`;
}

function startTournamentCountdown() {
    stopTournamentCountdown();
    const tick = () => {
        const el = $('tournament-countdown');
        if (!el) return;
        const lock = tournamentLockTime();
        if (!lock) { el.textContent = ''; return; }
        const now = Date.now();
        if (now >= lock) {
            el.innerHTML = `<span class="locked-badge">${t('tournament.lockedBadge')}</span>`;
            return;
        }
        el.innerHTML = `⏱ ${t('tournament.lockSoon')} <strong>${formatCountdown(lock - now)}</strong>`;
    };
    tick();
    tournamentCountdownTimer = setInterval(tick, 1000);
}

function stopTournamentCountdown() {
    if (tournamentCountdownTimer) {
        clearInterval(tournamentCountdownTimer);
        tournamentCountdownTimer = null;
    }
}

function renderTournament() {
    const container = $('tournament-container');
    if (!currentUser || !currentGroupId) {
        container.innerHTML = `<p class="state-msg">${t('tournament.needGroup')}</p>`;
        return;
    }

    const locked = tournamentIsLocked();
    const { scorers, winner, topScorer } = tournamentSettings;
    const teams = getSortedParticipatingTeams();
    const finalSet = !!(winner || topScorer);

    if (scorers.length === 0) {
        // champion list is always available; only scorers depend on admin
    }

    const myWinner    = (specialBets.winner && specialBets.winner.team) || '';
    const myScorer    = (specialBets.topScorer && specialBets.topScorer.player) || '';
    const winnerPts   = (specialBets.winner && specialBets.winner.points);
    const scorerPts   = (specialBets.topScorer && specialBets.topScorer.points);

    const buildOptions = (list, selected, translator) =>
        `<option value="">${t('tournament.selectPrompt')}</option>` +
        list.map(item => `<option value="${escapeHtml(item)}" ${item === selected ? 'selected' : ''}>${escapeHtml(translator ? translator(item) : item)}</option>`).join('');

    const winnerSection = teams.length === 0 ? '' : `
        <div class="tournament-card">
            <div class="tournament-card-title">${t('tournament.champion')}</div>
            <div class="tournament-card-body">
                ${locked
                    ? `<div class="tournament-locked">${myWinner ? `${t('tournament.yourBetPrefix')} <strong>${escapeHtml(translateTeam(myWinner))}</strong>` : t('tournament.noBet')}</div>`
                    : `<select id="tournament-winner-select" class="tournament-select">${buildOptions(teams, myWinner, translateTeam)}</select>
                       <button id="btn-save-winner" class="btn btn-primary btn-sm">${t('common.save')}</button>`
                }
                ${finalSet && winner ? `<div class="tournament-result">${t('tournament.resultChampion')} <strong>${escapeHtml(translateTeam(winner))}</strong> ${myWinner === winner ? `<span class="points-3">+${TOURNAMENT_POINTS} ${t('common.pts')} ✓</span>` : '<span class="points-0">❌</span>'}</div>` : ''}
            </div>
        </div>`;

    const scorerSection = scorers.length === 0 ? '' : `
        <div class="tournament-card">
            <div class="tournament-card-title">${t('tournament.topScorer')}</div>
            <div class="tournament-card-body">
                ${locked
                    ? `<div class="tournament-locked">${myScorer ? `${t('tournament.yourBetPrefix')} <strong>${escapeHtml(myScorer)}</strong>` : t('tournament.noBet')}</div>`
                    : `<select id="tournament-scorer-select" class="tournament-select">${buildOptions(scorers, myScorer)}</select>
                       <button id="btn-save-scorer" class="btn btn-primary btn-sm">${t('common.save')}</button>`
                }
                ${finalSet && topScorer ? `<div class="tournament-result">${t('tournament.resultTopScorer')} <strong>${escapeHtml(topScorer)}</strong> ${myScorer === topScorer ? `<span class="points-3">+${TOURNAMENT_POINTS} ${t('common.pts')} ✓</span>` : '<span class="points-0">❌</span>'}</div>` : ''}
            </div>
        </div>`;

    container.innerHTML = winnerSection + scorerSection;

    if (!locked) {
        const saveWinnerBtn = $('btn-save-winner');
        if (saveWinnerBtn) saveWinnerBtn.addEventListener('click', () => {
            const v = $('tournament-winner-select').value;
            if (!v) { alert(t('tournament.pickNeeded')); return; }
            saveSpecialBet('winner', { team: v });
        });
        const saveScorerBtn = $('btn-save-scorer');
        if (saveScorerBtn) saveScorerBtn.addEventListener('click', () => {
            const v = $('tournament-scorer-select').value;
            if (!v) { alert(t('tournament.pickNeeded')); return; }
            saveSpecialBet('topScorer', { player: v });
        });
    }
}

async function saveSpecialBet(kind, payload) {
    if (!db || !currentUser || !currentGroupId) return;
    if (tournamentIsLocked()) { alert(t('tournament.locked')); return; }
    await ref(`specialBets/${currentGroupId}/${currentUser.userId}/${kind}`).set({
        ...payload,
        points: null,
        placedAt: Date.now(),
    });
}

async function recalcMemberTotal(groupId, userId) {
    if (!db) return;
    const [betsSnap, specialSnap] = await Promise.all([
        ref(`bets/${groupId}/${userId}`).once('value'),
        ref(`specialBets/${groupId}/${userId}`).once('value'),
    ]);
    const bets = betsSnap.val() || {};
    const special = specialSnap.val() || {};
    const matchPts   = Object.values(bets).reduce((s, b) => s + (b.points || 0), 0);
    const specialPts = ((special.winner    && special.winner.points)    || 0)
                     + ((special.topScorer && special.topScorer.points) || 0);
    await ref(`groups/${groupId}/members/${userId}/totalPoints`).set(matchPts + specialPts);
}

async function recalcTournamentPoints() {
    if (!db) return;
    const tSnap = await ref('settings/tournament').once('value');
    const t = tSnap.val() || {};
    const winner = t.winner || null;
    const topScorer = t.topScorer || null;

    const groupsSnap = await ref('groups').once('value');
    const groupsData = groupsSnap.val() || {};

    const updates = {};
    for (const groupId of Object.keys(groupsData)) {
        const members = (groupsData[groupId] && groupsData[groupId].members) || {};
        for (const userId of Object.keys(members)) {
            const sbSnap = await ref(`specialBets/${groupId}/${userId}`).once('value');
            const sb = sbSnap.val() || {};
            if (sb.winner) {
                const pts = winner && sb.winner.team === winner ? TOURNAMENT_POINTS : 0;
                updates[`specialBets/${groupId}/${userId}/winner/points`] = pts;
            }
            if (sb.topScorer) {
                const pts = topScorer && sb.topScorer.player === topScorer ? TOURNAMENT_POINTS : 0;
                updates[`specialBets/${groupId}/${userId}/topScorer/points`] = pts;
            }
        }
    }
    if (Object.keys(updates).length > 0) {
        await db.ref(FB_ROOT).update(updates);
    }

    // Recompute totals for every affected member
    for (const groupId of Object.keys(groupsData)) {
        const members = (groupsData[groupId] && groupsData[groupId].members) || {};
        for (const userId of Object.keys(members)) {
            await recalcMemberTotal(groupId, userId);
        }
    }
}


// ============================================================
// ADMIN: SETUP LISTENERS
// ============================================================

function setupAdminListeners() {
    $('btn-admin-login').addEventListener('click', attemptAdminLogin);
    $('admin-password-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') attemptAdminLogin();
    });
    $('btn-add-match').addEventListener('click', adminAddMatch);
    $('btn-seed-matches').addEventListener('click', adminSeedMatches);
    $('btn-change-password').addEventListener('click', adminChangePassword);
    $('btn-save-scorers-list').addEventListener('click', adminSaveScorersList);
    $('btn-save-tournament-result').addEventListener('click', adminSaveTournamentResult);
}

function attemptAdminLogin() {
    const pwd = $('admin-password-input').value;
    const errEl = $('admin-auth-error');
    hideEl(errEl);

    function doLogin(storedPwd) {
        if (pwd === storedPwd) {
            isAdminAuthed = true;
            hide('admin-auth');
            show('admin-content');
            loadAdminMatches();
            loadAdminUsers();
            loadAdminTournament();
        } else {
            showEl(errEl);
        }
    }

    if (db) {
        const fromFirebase = ref('settings/adminPassword').once('value')
            .then(snap => snap.exists() ? snap.val() : 'admin2026');
        const fallback = new Promise(resolve => setTimeout(() => resolve('admin2026'), 3000));
        Promise.race([fromFirebase, fallback]).then(doLogin);
    } else {
        doLogin('admin2026');
    }
}

function adminChangePassword() {
    const newPwd = $('new-password-input').value.trim();
    if (!newPwd || newPwd.length < 4) { alert(t('admin.pwdTooShort')); return; }
    if (db) ref('settings/adminPassword').set(newPwd).catch(err => console.warn('Failed to save password:', err));
    $('new-password-input').value = '';
    alert(t('admin.pwdSaved'));
}

// ============================================================
// ADMIN: MATCHES MANAGEMENT
// ============================================================

async function adminAddMatch() {
    const t1    = $('new-team1').value.trim();
    const t2    = $('new-team2').value.trim();
    const date  = $('new-date').value;
    const stage = $('new-stage').value;
    const grp   = $('new-group-label').value.trim().toUpperCase();

    if (!t1 || !t2 || !date) { alert(t('admin.addMatchMissing')); return; }

    const matchData = {
        team1: t1, team2: t2,
        date, stage,
        group:  stage === 'group' ? (grp || null) : null,
        status: 'upcoming',
        result: null,
    };

    if (db) {
        await ref('matches').push(matchData);
    }

    // Reset form
    ['new-team1','new-team2','new-date','new-group-label'].forEach(id => { $(id).value = ''; });
    loadAdminMatches();
}

function loadAdminMatches() {
    if (!db) return;
    ref('matches').on('value', snap => {
        const data = snap.val() || {};
        renderAdminMatches(data);
    });
}

function renderAdminMatches(data) {
    const container = $('admin-matches-container');
    const list = Object.entries(data).sort((a, b) => parseMatchDate(a[1].date) - parseMatchDate(b[1].date));

    if (list.length === 0) {
        container.innerHTML = `<p class="state-msg">${t('admin.noMatches')}</p>`;
        return;
    }

    let html = '';
    list.forEach(([id, m]) => {
        const stageLabel = m.stage === 'group'
            ? `${getGroupPrefix()} ${m.group || ''}`
            : getStageLabel(m.stage);
        const resultStr = m.result
            ? `<span class="admin-result-badge">${m.result.team1Goals}–${m.result.team2Goals}</span>`
            : '';

        html += `
        <div class="admin-match-row" id="admin-row-${id}">
            <div class="admin-match-info">
                <div class="admin-match-teams">${getFlag(m.team1)} ${escapeHtml(translateTeam(m.team1))} vs ${escapeHtml(translateTeam(m.team2))} ${getFlag(m.team2)} ${resultStr}</div>
                <div class="admin-match-meta">${stageLabel} · ${formatDate(m.date)}</div>
            </div>
            <div class="admin-match-actions">
                <button class="btn btn-secondary btn-sm" onclick="openEditModal('${id}')">${t('common.edit')}</button>
                <button class="btn btn-primary btn-sm" onclick="openResultModal('${id}')">${t('admin.enterResult')}</button>
                <button class="btn btn-danger btn-sm" onclick="adminDeleteMatch('${id}')">${t('common.delete')}</button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

async function adminDeleteMatch(matchId) {
    if (!confirm(t('admin.deleteMatchConfirm'))) return;
    if (db) await ref(`matches/${matchId}`).remove();
}

// ---- Edit Match Modal ----

function openEditModal(matchId) {
    pendingEditMatchId = matchId;
    ref(`matches/${matchId}`).once('value').then(snap => {
        const m = snap.val();
        if (!m) return;
        $('edit-match-id').value = matchId;
        $('edit-team1').value     = m.team1;
        $('edit-team2').value     = m.team2;
        $('edit-date').value      = m.date ? m.date.slice(0,16) : '';
        $('edit-stage').value     = m.stage;
        $('edit-group-label').value = m.group || '';
        show('edit-modal');
    });
}

async function saveEditMatch() {
    const matchId = $('edit-match-id').value;
    const t1    = $('edit-team1').value.trim();
    const t2    = $('edit-team2').value.trim();
    const date  = $('edit-date').value;
    const stage = $('edit-stage').value;
    const grp   = $('edit-group-label').value.trim().toUpperCase();

    if (!t1 || !t2 || !date) { alert(t('admin.saveMissing')); return; }

    if (db) {
        await ref(`matches/${matchId}`).update({
            team1: t1, team2: t2, date, stage,
            group: stage === 'group' ? (grp || null) : null,
        });
    }
    hide('edit-modal');
}

// ---- Enter Result Modal ----

function openResultModal(matchId) {
    pendingResultMatchId = matchId;
    ref(`matches/${matchId}`).once('value').then(snap => {
        const m = snap.val();
        if (!m) return;
        $('modal-match-title').textContent = `${translateTeam(m.team1)} vs ${translateTeam(m.team2)}`;
        $('modal-team1-name').textContent  = translateTeam(m.team1);
        $('modal-team2-name').textContent  = translateTeam(m.team2);
        $('modal-score1').value = m.result ? m.result.team1Goals : 0;
        $('modal-score2').value = m.result ? m.result.team2Goals : 0;
        show('result-modal');
    });
}

async function saveResult() {
    const matchId = pendingResultMatchId;
    if (!matchId || !db) return;

    const g1 = parseInt($('modal-score1').value, 10);
    const g2 = parseInt($('modal-score2').value, 10);
    if (isNaN(g1) || isNaN(g2)) return;

    // Save result and mark completed
    await ref(`matches/${matchId}`).update({
        result: { team1Goals: g1, team2Goals: g2 },
        status: 'completed',
    });

    hide('result-modal');

    // Recalculate points for all users
    await recalcPoints(matchId, g1, g2);
    alert(t('admin.resultSaved'));
}

async function recalcPoints(matchId, resG1, resG2) {
    if (!db) return;

    const groupsSnap = await ref('groups').once('value');
    const groupsData = groupsSnap.val() || {};
    const updates = {};

    for (const groupId of Object.keys(groupsData)) {
        const members = (groupsData[groupId] && groupsData[groupId].members) || {};
        for (const userId of Object.keys(members)) {
            const betSnap = await ref(`bets/${groupId}/${userId}/${matchId}`).once('value');
            if (!betSnap.exists()) continue;
            const bet = betSnap.val();
            const pts = calcPoints(bet.team1Goals, bet.team2Goals, resG1, resG2);
            updates[`bets/${groupId}/${userId}/${matchId}/points`] = pts;
        }
    }

    if (Object.keys(updates).length > 0) {
        await db.ref(FB_ROOT).update(updates);
    }

    // Recompute each member's total (match + special), per group
    for (const groupId of Object.keys(groupsData)) {
        const members = (groupsData[groupId] && groupsData[groupId].members) || {};
        for (const userId of Object.keys(members)) {
            await recalcMemberTotal(groupId, userId);
        }
    }
}


// ============================================================
// ADMIN: USERS MANAGEMENT
// ============================================================

function loadAdminUsers() {
    if (!db) {
        $('admin-users-container').innerHTML = '<p class="state-msg">Firebase לא מחובר</p>';
        return;
    }
    ref('users').once('value').then(snap => {
        renderAdminUsers(snap.val() || {});
    }).catch(err => {
        console.error('Failed to load users:', err);
        $('admin-users-container').innerHTML =
            '<p class="state-msg" style="color:#e53e3e">Error loading users.</p>';
    });
}

async function renderAdminUsers(data) {
    const container = $('admin-users-container');
    const list = Object.entries(data).sort((a, b) => (a[1].name || '').localeCompare(b[1].name || ''));

    if (list.length === 0) {
        container.innerHTML = `<p class="state-msg">${t('admin.noUsers')}</p>`;
        return;
    }

    // Count each user's groups (for display)
    const userGroupsSnap = await ref('userGroups').once('value');
    const ugData = userGroupsSnap.val() || {};

    let html = '';
    list.forEach(([userId, u]) => {
        const groupCount = Object.keys(ugData[userId] || {}).length;
        html += `
        <div class="admin-match-row" id="admin-user-row-${userId}">
            <div class="admin-match-info">
                <div class="admin-match-teams">${escapeHtml(u.name)}</div>
                <div class="admin-match-meta">${escapeHtml(u.email)} · ${groupCount} ${t('admin.groupsCount')}</div>
            </div>
            <div class="admin-match-actions">
                <button class="btn btn-secondary btn-sm" onclick="openEditUserModal('${userId}')">${t('admin.userEditName')}</button>
                <button class="btn btn-danger btn-sm" onclick="adminDeleteUser('${userId}', '${escapeHtml(u.name).replace(/'/g, "\\'")}')">${t('common.delete')}</button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

function openEditUserModal(userId) {
    ref(`users/${userId}`).once('value').then(snap => {
        const u = snap.val();
        if (!u) return;
        $('edit-user-id').value   = userId;
        $('edit-user-name').value = u.name;
        show('edit-user-modal');
    });
}

async function saveEditUser() {
    const userId = $('edit-user-id').value;
    const name   = $('edit-user-name').value.trim();
    if (!name) { alert(t('admin.editUserEmpty')); return; }
    if (db) await ref(`users/${userId}/name`).set(name);
    hide('edit-user-modal');
}

async function adminDeleteUser(userId, userName) {
    if (!confirm(t('admin.deleteUserConfirm', userName))) return;
    if (!db) return;

    // Remove from every group + bets in every group
    const userGroupsSnap = await ref(`userGroups/${userId}`).once('value');
    const gids = Object.keys(userGroupsSnap.val() || {});

    const updates = {};
    for (const gid of gids) {
        updates[`groups/${gid}/members/${userId}`] = null;
        updates[`bets/${gid}/${userId}`] = null;
        updates[`specialBets/${gid}/${userId}`] = null;
    }
    updates[`userGroups/${userId}`] = null;
    updates[`users/${userId}`] = null;

    await db.ref(FB_ROOT).update(updates);
    loadAdminUsers();
}

// ============================================================
// ADMIN: TOURNAMENT BETS MANAGEMENT
// ============================================================

async function loadAdminTournament() {
    if (!db) return;
    const snap = await ref('settings/tournament').once('value');
    const ts = snap.val() || {};
    const teams   = getSortedParticipatingTeams();
    const scorers = Object.values(ts.scorers || {});
    $('admin-scorers-list').value = scorers.join('\n');

    const winnerSel = $('admin-final-winner');
    const scorerSel = $('admin-final-scorer');
    winnerSel.innerHTML = `<option value="">${t('admin.finalWinnerPlaceholder')}</option>` +
        teams.map(x => `<option value="${escapeHtml(x)}" ${ts.winner === x ? 'selected' : ''}>${escapeHtml(translateTeam(x))}</option>`).join('');
    scorerSel.innerHTML = `<option value="">${t('admin.finalScorerPlaceholder')}</option>` +
        scorers.map(x => `<option value="${escapeHtml(x)}" ${ts.topScorer === x ? 'selected' : ''}>${escapeHtml(x)}</option>`).join('');
}

async function adminSaveScorersList() {
    if (!db) return;
    const lines = $('admin-scorers-list').value.split('\n').map(s => s.trim()).filter(Boolean);
    await ref('settings/tournament/scorers').set(lines);
    await loadAdminTournament();
    alert(t('admin.tournamentScorersSaved'));
}

async function adminSaveTournamentResult() {
    if (!db) return;
    const winner    = $('admin-final-winner').value || null;
    const topScorer = $('admin-final-scorer').value || null;
    if (!winner && !topScorer) { alert(t('admin.tournamentNeedsPick')); return; }
    if (!confirm(t('admin.tournamentSaveConfirm'))) return;
    const updates = {};
    updates['settings/tournament/winner']    = winner;
    updates['settings/tournament/topScorer'] = topScorer;
    await db.ref(FB_ROOT).update(updates);
    await recalcTournamentPoints();
    alert(t('admin.tournamentSaved'));
}


// ============================================================
// SEED: WORLD CUP 2026 MATCHES
// ============================================================

const SEED_MATCHES = [
    // GROUP A: מקסיקו, דרום אפריקה, קוריאה הדרומית, צ'כיה
    { team1:'מקסיקו', team2:'דרום אפריקה', date:'2026-06-11T19:00', stage:'group', group:'A' },
    { team1:"קוריאה הדרומית", team2:"צ'כיה", date:'2026-06-12T02:00', stage:'group', group:'A' },
    { team1:'מקסיקו', team2:'קוריאה הדרומית', date:'2026-06-19T01:00', stage:'group', group:'A' },
    { team1:'דרום אפריקה', team2:"צ'כיה", date:'2026-06-18T16:00', stage:'group', group:'A' },
    { team1:'מקסיקו', team2:"צ'כיה", date:'2026-06-25T01:00', stage:'group', group:'A' },
    { team1:'דרום אפריקה', team2:'קוריאה הדרומית', date:'2026-06-25T01:00', stage:'group', group:'A' },

    // GROUP B: קנדה, שווייץ, קטאר, בוסניה והרצגובינה
    { team1:'קנדה', team2:'בוסניה והרצגובינה', date:'2026-06-12T19:00', stage:'group', group:'B' },
    { team1:'שווייץ', team2:'קטאר', date:'2026-06-12T22:00', stage:'group', group:'B' },
    { team1:'קנדה', team2:'קטאר', date:'2026-06-18T22:00', stage:'group', group:'B' },
    { team1:'שווייץ', team2:'בוסניה והרצגובינה', date:'2026-06-18T19:00', stage:'group', group:'B' },
    { team1:'שווייץ', team2:'קנדה', date:'2026-06-25T19:00', stage:'group', group:'B' },
    { team1:'בוסניה והרצגובינה', team2:'קטאר', date:'2026-06-25T19:00', stage:'group', group:'B' },

    // GROUP C: ברזיל, מרוקו, האיטי, סקוטלנד
    { team1:'ברזיל', team2:'מרוקו', date:'2026-06-13T22:00', stage:'group', group:'C' },
    { team1:'האיטי', team2:'סקוטלנד', date:'2026-06-14T01:00', stage:'group', group:'C' },
    { team1:'סקוטלנד', team2:'מרוקו', date:'2026-06-19T22:00', stage:'group', group:'C' },
    { team1:'ברזיל', team2:'האיטי', date:'2026-06-20T01:00', stage:'group', group:'C' },
    { team1:'סקוטלנד', team2:'ברזיל', date:'2026-06-24T22:00', stage:'group', group:'C' },
    { team1:'מרוקו', team2:'האיטי', date:'2026-06-24T22:00', stage:'group', group:'C' },

    // GROUP D: ארצות הברית, פרגוואי, אוסטרליה, טורקיה
    { team1:'ארצות הברית', team2:'פרגוואי', date:'2026-06-13T01:00', stage:'group', group:'D' },
    { team1:'אוסטרליה', team2:'טורקיה', date:'2026-06-13T04:00', stage:'group', group:'D' },
    { team1:'ארצות הברית', team2:'אוסטרליה', date:'2026-06-19T19:00', stage:'group', group:'D' },
    { team1:'טורקיה', team2:'פרגוואי', date:'2026-06-20T04:00', stage:'group', group:'D' },
    { team1:'טורקיה', team2:'ארצות הברית', date:'2026-06-26T02:00', stage:'group', group:'D' },
    { team1:'פרגוואי', team2:'אוסטרליה', date:'2026-06-26T02:00', stage:'group', group:'D' },

    // GROUP E: גרמניה, קוראסאו, חוף השנהב, אקוודור
    { team1:'גרמניה', team2:'קוראסאו', date:'2026-06-14T17:00', stage:'group', group:'E' },
    { team1:"חוף השנהב", team2:'אקוודור', date:'2026-06-14T23:00', stage:'group', group:'E' },
    { team1:'גרמניה', team2:"חוף השנהב", date:'2026-06-20T20:00', stage:'group', group:'E' },
    { team1:'אקוודור', team2:'קוראסאו', date:'2026-06-21T00:00', stage:'group', group:'E' },
    { team1:'אקוודור', team2:'גרמניה', date:'2026-06-26T20:00', stage:'group', group:'E' },
    { team1:'קוראסאו', team2:"חוף השנהב", date:'2026-06-26T20:00', stage:'group', group:'E' },

    // GROUP F: הולנד, יפן, תוניסיה, שוודיה
    { team1:'הולנד', team2:'יפן', date:'2026-06-14T20:00', stage:'group', group:'F' },
    { team1:'שוודיה', team2:'תוניסיה', date:'2026-06-15T02:00', stage:'group', group:'F' },
    { team1:'הולנד', team2:'שוודיה', date:'2026-06-20T17:00', stage:'group', group:'F' },
    { team1:'תוניסיה', team2:'יפן', date:'2026-06-21T04:00', stage:'group', group:'F' },
    { team1:'הולנד', team2:'תוניסיה', date:'2026-06-27T00:00', stage:'group', group:'F' },
    { team1:'שוודיה', team2:'יפן', date:'2026-06-27T00:00', stage:'group', group:'F' },

    // GROUP G: בלגיה, מצרים, איראן, ניו זילנד
    { team1:'בלגיה', team2:'מצרים', date:'2026-06-15T22:00', stage:'group', group:'G' },
    { team1:'איראן', team2:'ניו זילנד', date:'2026-06-16T04:00', stage:'group', group:'G' },
    { team1:'בלגיה', team2:'איראן', date:'2026-06-21T19:00', stage:'group', group:'G' },
    { team1:'ניו זילנד', team2:'מצרים', date:'2026-06-22T01:00', stage:'group', group:'G' },
    { team1:'בלגיה', team2:'ניו זילנד', date:'2026-06-27T02:00', stage:'group', group:'G' },
    { team1:'מצרים', team2:'איראן', date:'2026-06-27T02:00', stage:'group', group:'G' },

    // GROUP H: ספרד, קאבו ורדה, ערב הסעודית, אורוגוואי
    { team1:'ספרד', team2:'קאבו ורדה', date:'2026-06-15T17:00', stage:'group', group:'H' },
    { team1:'ערב הסעודית', team2:'אורוגוואי', date:'2026-06-15T22:00', stage:'group', group:'H' },
    { team1:'ספרד', team2:'ערב הסעודית', date:'2026-06-21T16:00', stage:'group', group:'H' },
    { team1:'אורוגוואי', team2:'קאבו ורדה', date:'2026-06-21T22:00', stage:'group', group:'H' },
    { team1:'ספרד', team2:'אורוגוואי', date:'2026-06-26T22:00', stage:'group', group:'H' },
    { team1:'קאבו ורדה', team2:'ערב הסעודית', date:'2026-06-26T22:00', stage:'group', group:'H' },

    // GROUP I: צרפת, סנגל, נורווגיה, עיראק
    { team1:'צרפת', team2:'סנגל', date:'2026-06-16T19:00', stage:'group', group:'I' },
    { team1:'עיראק', team2:'נורווגיה', date:'2026-06-16T22:00', stage:'group', group:'I' },
    { team1:'צרפת', team2:'עיראק', date:'2026-06-22T21:00', stage:'group', group:'I' },
    { team1:'נורווגיה', team2:'סנגל', date:'2026-06-23T00:00', stage:'group', group:'I' },
    { team1:'צרפת', team2:'נורווגיה', date:'2026-06-27T19:00', stage:'group', group:'I' },
    { team1:'סנגל', team2:'עיראק', date:'2026-06-27T19:00', stage:'group', group:'I' },

    // GROUP J: ארגנטינה, אלג'יריה, אוסטריה, ירדן
    { team1:'ארגנטינה', team2:"אלג'יריה", date:'2026-06-17T01:00', stage:'group', group:'J' },
    { team1:'אוסטריה', team2:'ירדן', date:'2026-06-17T04:00', stage:'group', group:'J' },
    { team1:'ארגנטינה', team2:'אוסטריה', date:'2026-06-21T17:00', stage:'group', group:'J' },
    { team1:"אלג'יריה", team2:'ירדן', date:'2026-06-21T23:00', stage:'group', group:'J' },
    { team1:'ארגנטינה', team2:'ירדן', date:'2026-06-27T22:00', stage:'group', group:'J' },
    { team1:"אלג'יריה", team2:'אוסטריה', date:'2026-06-27T22:00', stage:'group', group:'J' },

    // GROUP K: פורטוגל, אוזבקיסטן, קולומביה, קונגו DR
    { team1:'פורטוגל', team2:"קונגו DR", date:'2026-06-17T17:00', stage:'group', group:'K' },
    { team1:'אוזבקיסטן', team2:'קולומביה', date:'2026-06-18T02:00', stage:'group', group:'K' },
    { team1:'פורטוגל', team2:'אוזבקיסטן', date:'2026-06-23T17:00', stage:'group', group:'K' },
    { team1:'קולומביה', team2:"קונגו DR", date:'2026-06-23T20:00', stage:'group', group:'K' },
    { team1:'פורטוגל', team2:'קולומביה', date:'2026-06-28T01:00', stage:'group', group:'K' },
    { team1:'אוזבקיסטן', team2:"קונגו DR", date:'2026-06-28T01:00', stage:'group', group:'K' },

    // GROUP L: אנגליה, קרואטיה, גאנה, פנמה
    { team1:'אנגליה', team2:'קרואטיה', date:'2026-06-17T20:00', stage:'group', group:'L' },
    { team1:'גאנה', team2:'פנמה', date:'2026-06-17T23:00', stage:'group', group:'L' },
    { team1:'אנגליה', team2:'גאנה', date:'2026-06-23T22:00', stage:'group', group:'L' },
    { team1:'קרואטיה', team2:'פנמה', date:'2026-06-24T01:00', stage:'group', group:'L' },
    { team1:'אנגליה', team2:'פנמה', date:'2026-06-28T04:00', stage:'group', group:'L' },
    { team1:'קרואטיה', team2:'גאנה', date:'2026-06-28T04:00', stage:'group', group:'L' },

    // מקום שלישי
    { team1:'TBD', team2:'TBD', date:'2026-07-18T22:00', stage:'3rd', group: null },
];

async function adminSeedMatches() {
    if (!db) { alert('Firebase לא מחובר'); return; }

    const snap = await ref('matches').once('value');
    if (snap.exists() && Object.keys(snap.val()).length > 0) {
        if (!confirm('כבר קיימים משחקים. להוסיף את משחקי שלב הבתים בנוסף?')) return;
    }

    let total = 0;
    for (const m of SEED_MATCHES) {
        await ref('matches').push({ ...m, status: 'upcoming', result: null });
        total++;
    }

    alert(`נטענו ${total} משחקי שלב הבתים בהצלחה! ✅\nמשחקי שלב הנוקאאוט יתווספו לאחר שתוצאות הבתים ייקבעו.`);
}


// ============================================================
// GROUP MANAGEMENT
// ============================================================

function toggleGroupSwitchMenu(forceState) {
    const el = $('group-switch-menu');
    if (!el) return;
    const open = forceState !== undefined ? forceState : el.classList.contains('hidden');
    if (open) {
        el.classList.remove('hidden');
        renderGroupSwitcher();
    } else {
        el.classList.add('hidden');
    }
    groupSwitchMenuOpen = !el.classList.contains('hidden');
}

function renderGroupSwitcher() {
    // Active group label in app bar
    const active = currentGroupId && userGroups[currentGroupId];
    $('active-group-name').textContent = active ? active.name : t('appBar.noGroup');

    // Show/hide settings option based on ownership
    const settingsBtn = $('btn-open-group-settings');
    if (settingsBtn) {
        if (active) settingsBtn.classList.remove('hidden');
        else settingsBtn.classList.add('hidden');
    }

    // Menu list
    const list = $('group-switch-list');
    if (!list) return;
    const entries = Object.entries(userGroups);
    if (entries.length === 0) {
        list.innerHTML = `<p style="padding:10px;color:var(--text-light);font-size:.85rem">${t('groupSwitch.emptyMsg')}</p>`;
        return;
    }
    list.innerHTML = entries.map(([gid, g]) => {
        const isActive = gid === currentGroupId;
        return `<button class="group-switch-item ${isActive ? 'active' : ''}" data-group-id="${gid}">
            <span>${escapeHtml(g.name)}</span>
            ${isActive ? '<span class="check-mark">✓</span>' : ''}
        </button>`;
    }).join('');

    list.querySelectorAll('.group-switch-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const gid = btn.dataset.groupId;
            toggleGroupSwitchMenu(false);
            if (gid !== currentGroupId) switchActiveGroup(gid);
        });
    });
}

function switchActiveGroup(groupId) {
    if (!groupId || groupId === currentGroupId) return;
    stopGroupListeners();
    groupMembers = {};
    userBets = {};
    enterAppForGroup(groupId);
}

// ---- Create group ----

function openCreateGroupModal() {
    $('create-group-name').value = '';
    hideEl($('create-group-error'));
    hideEl($('create-group-success'));
    showEl($('btn-confirm-create-group'));
    show('create-group-modal');
}

async function confirmCreateGroup() {
    const name = $('create-group-name').value.trim();
    const errEl = $('create-group-error');
    hideEl(errEl);
    if (!name) {
        errEl.textContent = t('createGroup.errorName');
        showEl(errEl);
        return;
    }
    if (!db || !currentUser) return;

    try {
        // Generate a unique invite code (retry on collision)
        let code = generateInviteCode();
        for (let i = 0; i < 5; i++) {
            const s = await ref(`inviteCodes/${code}`).once('value');
            if (!s.exists()) break;
            code = generateInviteCode();
        }

        const newRef = ref('groups').push();
        const groupId = newRef.key;
        const now = Date.now();

        const updates = {};
        updates[`groups/${groupId}/name`] = name;
        updates[`groups/${groupId}/ownerId`] = currentUser.userId;
        updates[`groups/${groupId}/inviteCode`] = code;
        updates[`groups/${groupId}/createdAt`] = now;
        updates[`groups/${groupId}/members/${currentUser.userId}`] = { joinedAt: now, totalPoints: 0 };
        updates[`inviteCodes/${code}`] = groupId;
        updates[`userGroups/${currentUser.userId}/${groupId}`] = true;

        await db.ref(FB_ROOT).update(updates);

        // Show success with invite code
        $('created-invite-code').textContent = code;
        showEl($('create-group-success'));
        hideEl($('btn-confirm-create-group'));

        // Cache + switch into the new group
        userGroups[groupId] = { name, ownerId: currentUser.userId, inviteCode: code };
        currentGroupId = groupId;
        localStorage.setItem('wc2026_activeGroup', groupId);

        // Change cancel button to "enter group"
        $('btn-cancel-create-group').textContent = t('createGroup.enter');
    } catch (err) {
        console.error(err);
        errEl.textContent = t('createGroup.errorGeneric');
        showEl(errEl);
    }
}

function closeCreateGroupModal() {
    hide('create-group-modal');
    $('btn-cancel-create-group').textContent = t('common.cancel');
    // If we created a group mid-flow, enter the app
    if (currentUser && currentGroupId && $('group-picker-screen') && !$('group-picker-screen').classList.contains('hidden')) {
        enterAppForGroup(currentGroupId);
    } else if (currentGroupId) {
        renderGroupSwitcher();
    }
}

// ---- Join group ----

function openJoinGroupModal() {
    $('join-group-code').value = '';
    hideEl($('join-group-error'));
    show('join-group-modal');
}

async function confirmJoinGroup() {
    const rawCode = $('join-group-code').value.trim().toUpperCase();
    const errEl = $('join-group-error');
    hideEl(errEl);
    if (!rawCode || rawCode.length !== 6) {
        errEl.textContent = t('joinGroup.errorLength');
        showEl(errEl);
        return;
    }
    if (!db || !currentUser) return;

    try {
        const snap = await ref(`inviteCodes/${rawCode}`).once('value');
        if (!snap.exists()) {
            errEl.textContent = t('joinGroup.errorInvalid');
            showEl(errEl);
            return;
        }
        const groupId = snap.val();

        const memberSnap = await ref(`groups/${groupId}/members/${currentUser.userId}`).once('value');
        if (memberSnap.exists()) {
            hide('join-group-modal');
            switchActiveGroup(groupId);
            return;
        }

        const now = Date.now();
        const updates = {};
        updates[`groups/${groupId}/members/${currentUser.userId}`] = { joinedAt: now, totalPoints: 0 };
        updates[`userGroups/${currentUser.userId}/${groupId}`] = true;
        await db.ref(FB_ROOT).update(updates);

        hide('join-group-modal');
        // Switch into the joined group
        if (currentGroupId) {
            switchActiveGroup(groupId);
        } else {
            enterAppForGroup(groupId);
        }
    } catch (err) {
        console.error(err);
        errEl.textContent = t('joinGroup.errorGeneric');
        showEl(errEl);
    }
}

// ---- Group settings ----

async function openGroupSettingsModal() {
    if (!currentGroupId || !userGroups[currentGroupId]) return;
    const g = userGroups[currentGroupId];
    const isOwner = g.ownerId === currentUser.userId;

    $('group-settings-name').value = g.name;
    $('settings-invite-code').textContent = g.inviteCode;
    hideEl($('group-settings-error'));

    // Owner-only controls
    $('btn-rename-group').style.display = isOwner ? '' : 'none';
    $('group-settings-name').readOnly = !isOwner;
    if (isOwner) $('btn-delete-group').classList.remove('hidden');
    else $('btn-delete-group').classList.add('hidden');

    // Members list
    const mSnap = await ref(`groups/${currentGroupId}/members`).once('value');
    const members = mSnap.val() || {};
    const container = $('group-members-list');
    const rows = [];
    for (const uid of Object.keys(members)) {
        let name = (groupUsersCache[uid] && groupUsersCache[uid].name);
        if (!name) {
            const us = await ref(`users/${uid}`).once('value');
            const u = us.val();
            if (u) {
                groupUsersCache[uid] = { name: u.name, email: u.email };
                name = u.name;
            }
        }
        name = name || t('groupSettings.unknownUser');
        const isThisOwner = uid === g.ownerId;
        const canKick = isOwner && !isThisOwner;
        rows.push(`
            <div class="group-member-row">
                <div>
                    <span class="member-name">${escapeHtml(name)}</span>
                    ${isThisOwner ? `<span class="owner-badge">${t('groupSettings.ownerBadge')}</span>` : ''}
                    <span class="member-meta">${members[uid].totalPoints || 0} ${t('common.pts')}</span>
                </div>
                ${canKick ? `<button class="btn btn-danger btn-sm" onclick="removeMember('${uid}')">${t('groupSettings.kick')}</button>` : ''}
            </div>`);
    }
    container.innerHTML = rows.join('');

    show('group-settings-modal');
}

async function renameGroup() {
    const newName = $('group-settings-name').value.trim();
    const errEl = $('group-settings-error');
    hideEl(errEl);
    if (!newName) {
        errEl.textContent = t('groupSettings.errorEmpty');
        showEl(errEl);
        return;
    }
    if (!db || !currentGroupId) return;
    await ref(`groups/${currentGroupId}/name`).set(newName);
    if (userGroups[currentGroupId]) userGroups[currentGroupId].name = newName;
    renderGroupSwitcher();
    errEl.textContent = t('groupSettings.savedOk');
    errEl.style.color = 'var(--green-mid)';
    showEl(errEl);
    setTimeout(() => { hideEl(errEl); errEl.style.color = ''; }, 2000);
}

async function removeMember(userId) {
    if (!currentGroupId || !db) return;
    if (!confirm(t('groupSettings.kickConfirm'))) return;
    const updates = {};
    updates[`groups/${currentGroupId}/members/${userId}`] = null;
    updates[`bets/${currentGroupId}/${userId}`] = null;
    updates[`specialBets/${currentGroupId}/${userId}`] = null;
    updates[`userGroups/${userId}/${currentGroupId}`] = null;
    await db.ref(FB_ROOT).update(updates);
    openGroupSettingsModal(); // refresh
}

async function leaveGroup() {
    if (!currentGroupId || !db || !currentUser) return;
    const g = userGroups[currentGroupId];
    if (g && g.ownerId === currentUser.userId) {
        alert(t('groupSettings.leaveOwner'));
        return;
    }
    if (!confirm(t('groupSettings.leaveConfirm'))) return;
    const updates = {};
    updates[`groups/${currentGroupId}/members/${currentUser.userId}`] = null;
    updates[`bets/${currentGroupId}/${currentUser.userId}`] = null;
    updates[`specialBets/${currentGroupId}/${currentUser.userId}`] = null;
    updates[`userGroups/${currentUser.userId}/${currentGroupId}`] = null;
    await db.ref(FB_ROOT).update(updates);
    hide('group-settings-modal');
    // userGroups listener will route to another group or to the picker
}

async function deleteGroup() {
    if (!currentGroupId || !db || !currentUser) return;
    const g = userGroups[currentGroupId];
    if (!g || g.ownerId !== currentUser.userId) return;
    if (!confirm(t('groupSettings.deleteConfirm', g.name))) return;

    const gid = currentGroupId;
    // Collect member ids
    const mSnap = await ref(`groups/${gid}/members`).once('value');
    const memberIds = Object.keys(mSnap.val() || {});

    const updates = {};
    updates[`groups/${gid}`] = null;
    updates[`bets/${gid}`] = null;
    updates[`specialBets/${gid}`] = null;
    updates[`inviteCodes/${g.inviteCode}`] = null;
    for (const uid of memberIds) {
        updates[`userGroups/${uid}/${gid}`] = null;
    }
    await db.ref(FB_ROOT).update(updates);
    hide('group-settings-modal');
    // userGroups listener routes to next group or picker
}

function copyToClipboard(text, btn) {
    const oldLabel = btn.textContent;
    const done = () => {
        btn.textContent = t('common.copied');
        setTimeout(() => { btn.textContent = oldLabel; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => done());
    } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch(e) {}
        document.body.removeChild(ta);
        done();
    }
}

function setupGroupUIListeners() {
    // App bar switcher
    $('btn-group-switcher').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleGroupSwitchMenu();
    });
    document.addEventListener('click', (e) => {
        const menu = $('group-switch-menu');
        const btn  = $('btn-group-switcher');
        if (!menu || !btn) return;
        if (menu.classList.contains('hidden')) return;
        if (!menu.contains(e.target) && !btn.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });

    $('btn-open-create-group').addEventListener('click', () => {
        toggleGroupSwitchMenu(false);
        openCreateGroupModal();
    });
    $('btn-open-join-group').addEventListener('click', () => {
        toggleGroupSwitchMenu(false);
        openJoinGroupModal();
    });
    $('btn-open-group-settings').addEventListener('click', () => {
        toggleGroupSwitchMenu(false);
        openGroupSettingsModal();
    });

    // Group picker screen
    $('btn-picker-create').addEventListener('click', openCreateGroupModal);
    $('btn-picker-join').addEventListener('click', openJoinGroupModal);
    $('btn-picker-logout').addEventListener('click', handleLogout);

    // Create modal
    $('btn-confirm-create-group').addEventListener('click', confirmCreateGroup);
    $('btn-cancel-create-group').addEventListener('click', closeCreateGroupModal);
    $('btn-copy-invite').addEventListener('click', (e) => {
        copyToClipboard($('created-invite-code').textContent, e.currentTarget);
    });

    // Join modal
    $('btn-confirm-join-group').addEventListener('click', confirmJoinGroup);
    $('btn-cancel-join-group').addEventListener('click', () => hide('join-group-modal'));
    $('join-group-code').addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    });

    // Settings modal
    $('btn-rename-group').addEventListener('click', renameGroup);
    $('btn-close-group-settings').addEventListener('click', () => hide('group-settings-modal'));
    $('btn-leave-group').addEventListener('click', leaveGroup);
    $('btn-delete-group').addEventListener('click', deleteGroup);
    $('btn-copy-settings-invite').addEventListener('click', (e) => {
        copyToClipboard($('settings-invite-code').textContent, e.currentTarget);
    });
}


// ============================================================
// HELPERS
// ============================================================

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

