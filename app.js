// ============================================================
// WORLD CUP 2026 BETTING APP
// ============================================================

const FB_ROOT = 'worldcup2026';

// ---- Stage / flag helpers ----

const STAGE_LABELS = {
    group: 'שלב הבתים',
    R32:   'שלב 32',
    R16:   'שמינייה',
    QF:    'רבע גמר',
    SF:    'חצי גמר',
    '3rd': 'מקום שלישי',
    Final: 'גמר',
};

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
let userBets     = {};  // matchId → bet object (current user)
let allUsers     = [];  // sorted by totalPoints desc
let activeTab    = 'matches';
let stageFilter  = 'all';
let isAdminMode  = false;
let isAdminAuthed = false;
let pendingResultMatchId = null;
let pendingEditMatchId   = null;

// ---- Firebase refs ----

function ref(path) {
    return db.ref(`${FB_ROOT}/${path}`);
}

// ---- Utilities ----

function emailToId(email) {
    return email.toLowerCase().replace(/[.#$[\]/]/g, '_');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('he-IL', {
        weekday: 'short', day: 'numeric', month: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function matchIsLocked(match) {
    return new Date(match.date) - new Date() <= 60 * 60 * 1000; // lock 1 hour before kickoff
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
                enterApp();
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
});

function showLoginScreen() {
    show('login-screen');
    hide('main-app');
    hide('admin-panel');
}

function enterApp() {
    hide('login-screen');
    show('main-app');
    $('header-username').textContent = currentUser.name;
    startFirebaseListeners();
    renderCurrentTab();
}

// ============================================================
// AUTH
// ============================================================

function handleLogin(e) {
    e.preventDefault();
    const name  = $('input-name').value.trim();
    const email = $('input-email').value.trim().toLowerCase();
    const errEl = $('login-error');
    hideEl(errEl);

    if (!name || !email) {
        errEl.textContent = 'נא למלא שם ואימייל';
        showEl(errEl);
        return;
    }

    const userId = emailToId(email);
    currentUser = { userId, name, email };
    localStorage.setItem('wc2026_user', JSON.stringify(currentUser));

    // Sync to Firebase in background — don't block login
    if (db) {
        ref(`users/${userId}`).once('value')
            .then(snap => {
                if (!snap.exists()) {
                    return ref(`users/${userId}`).set({ name, email, totalPoints: 0 });
                }
                return ref(`users/${userId}/name`).set(name);
            })
            .catch(err => console.warn('Firebase user sync failed:', err.message));
    }

    enterApp();
}

function handleLogout() {
    if (db) {
        ref('matches').off();
        ref('users').off();
        if (currentUser) ref(`bets/${currentUser.userId}`).off();
    }
    currentUser = null;
    localStorage.removeItem('wc2026_user');
    matches  = {};
    userBets = {};
    allUsers = [];
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

    // Matches
    ref('matches').on('value', snap => {
        matches = snap.val() || {};
        if (activeTab === 'matches') renderMatches();
        if (activeTab === 'my-bets') renderMyBets();
    }, permissionError);

    // All users (leaderboard)
    ref('users').on('value', snap => {
        const raw = snap.val() || {};
        allUsers = Object.entries(raw)
            .map(([id, u]) => ({ userId: id, ...u }))
            .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
        if (activeTab === 'leaderboard') renderLeaderboard();
    }, () => {});

    // Current user's bets
    if (currentUser) {
        ref(`bets/${currentUser.userId}`).on('value', snap => {
            userBets = snap.val() || {};
            if (activeTab === 'matches')  renderMatches();
            if (activeTab === 'my-bets') renderMyBets();
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
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (matchList.length === 0) {
        container.innerHTML = '<p class="state-msg">אין משחקים להצגה. האדמין יכול לטעון את המשחקים.</p>';
        return;
    }

    // Group by stage → then by group label (for group stage)
    const grouped = {};
    matchList.forEach(m => {
        const key = m.stage === 'group' ? `group_${m.group || ''}` : m.stage;
        if (!grouped[key]) grouped[key] = { stage: m.stage, group: m.group, items: [] };
        grouped[key].items.push(m);
    });

    // Sort groups by stage order, then by group letter
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
        const sa = STAGE_ORDER.indexOf(grouped[a].stage);
        const sb = STAGE_ORDER.indexOf(grouped[b].stage);
        if (sa !== sb) return sa - sb;
        return (grouped[a].group || '').localeCompare(grouped[b].group || '');
    });

    let html = '';
    sortedKeys.forEach(key => {
        const g = grouped[key];
        const label = g.stage === 'group'
            ? `${STAGE_LABELS.group} – בית ${g.group || ''}`
            : STAGE_LABELS[g.stage] || g.stage;
        html += `<div class="stage-group-header">${label}</div>`;
        g.items.forEach(m => { html += buildMatchCard(m); });
    });

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
        badgeClass = 'badge-completed'; badgeText = 'הסתיים';
    } else if (locked) {
        badgeClass = 'badge-locked'; badgeText = 'נעול';
    } else {
        badgeClass = 'badge-upcoming'; badgeText = 'עתידי';
    }

    // Middle content
    let middleHtml = '';
    if (hasResult) {
        middleHtml = `<div class="result-score">${m.result.team1Goals} – ${m.result.team2Goals}</div>`;
    } else if (locked) {
        if (bet) {
            middleHtml = `
                <div class="my-bet-label">ניחוש שלך</div>
                <div class="my-bet-score">${bet.team1Goals} – ${bet.team2Goals}</div>
                <div class="bet-locked-msg">🔒 נעול</div>`;
        } else {
            middleHtml = `<div class="bet-locked-msg">🔒 לא הימרת</div>`;
        }
    } else {
        // Show bet form (or saved bet with edit option)
        if (bet && !bet._editing) {
            middleHtml = `
                <div class="my-bet-label">ניחוש שלך</div>
                <div class="my-bet-score">${bet.team1Goals} – ${bet.team2Goals}</div>
                <button class="bet-edit-link" data-match-id="${m.id}">ערוך</button>`;
        } else {
            const v1 = bet ? bet.team1Goals : 0;
            const v2 = bet ? bet.team2Goals : 0;
            middleHtml = `
                <div class="bet-inputs">
                    <input type="number" class="bet-score-input" id="bet1-${m.id}" min="0" max="30" value="${v1}">
                    <span class="bet-sep">–</span>
                    <input type="number" class="bet-score-input" id="bet2-${m.id}" min="0" max="30" value="${v2}">
                </div>
                <button class="btn-save-bet" data-match-id="${m.id}">💾 שמור</button>`;
        }
    }

    // Points row (only if match completed and user had a bet)
    let pointsHtml = '';
    if (hasResult && bet && bet.points !== null && bet.points !== undefined) {
        const pts = bet.points;
        const cls = pts === 3 ? 'points-3' : pts === 1 ? 'points-1' : 'points-0';
        const emoji = pts === 3 ? '🎯' : pts === 1 ? '✅' : '❌';
        pointsHtml = `<div class="match-points-row ${cls}">${emoji} ניחוש: ${bet.team1Goals}–${bet.team2Goals} | ${pts} נקודות</div>`;
    } else if (hasResult && !bet) {
        pointsHtml = `<div class="match-points-row points-na">לא הימרת על משחק זה</div>`;
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
                    <span class="team-name">${m.team1}</span>
                </div>
                <div class="match-middle">${middleHtml}</div>
                <div class="match-team">
                    <span class="team-flag">${getFlag(m.team2)}</span>
                    <span class="team-name">${m.team2}</span>
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
    if (!currentUser || !db) return;
    const m = matches[matchId];
    if (!m || matchIsLocked(m)) return;

    const g1 = parseInt($(`bet1-${matchId}`).value, 10);
    const g2 = parseInt($(`bet2-${matchId}`).value, 10);

    if (isNaN(g1) || isNaN(g2) || g1 < 0 || g2 < 0) return;

    await ref(`bets/${currentUser.userId}/${matchId}`).set({
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

    if (allUsers.length === 0) {
        container.innerHTML = '<p class="state-msg">אין משתתפים עדיין.</p>';
        return;
    }

    let html = '<div class="leaderboard-table">';
    allUsers.forEach((u, i) => {
        const rank    = i + 1;
        const isMe    = currentUser && u.userId === currentUser.userId;
        const medal   = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        const meTag   = isMe ? '<span class="lb-me-tag">אני</span>' : '';
        html += `
        <div class="leaderboard-row ${isMe ? 'is-me' : ''}">
            <span class="lb-rank">${medal}</span>
            <span class="lb-name">${escapeHtml(u.name)} ${meTag}</span>
            <span class="lb-points">${u.totalPoints || 0} <span class="lb-pts-label">נק'</span></span>
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
        container.innerHTML = '<p class="state-msg">עוד לא הימרת על אף משחק.</p>';
        return;
    }

    // Sort by match date
    const sorted = betEntries
        .map(([matchId, bet]) => ({ matchId, bet, match: matches[matchId] }))
        .filter(x => x.match)
        .sort((a, b) => new Date(a.match.date) - new Date(b.match.date));

    let html = '';
    sorted.forEach(({ matchId, bet, match: m }) => {
        const hasResult = m.result !== null && m.result !== undefined;
        const pts = bet.points;

        let ptsBadge = '';
        if (hasResult && pts !== null && pts !== undefined) {
            const cls = pts === 3 ? 'points-3' : pts === 1 ? 'points-1' : 'points-0';
            ptsBadge = `<span class="match-points-row ${cls}" style="display:inline-block;padding:2px 10px;">${pts} נק'</span>`;
        }

        const resultStr = hasResult
            ? `<div class="my-bet-col">
                 <span class="my-bet-col-label">תוצאה</span>
                 <span class="my-bet-col-value result-val">${m.result.team1Goals}–${m.result.team2Goals}</span>
               </div>`
            : '';

        const stageLabel = m.stage === 'group'
            ? `בית ${m.group || ''}`
            : (STAGE_LABELS[m.stage] || m.stage);

        html += `
        <div class="my-bet-card">
            <div class="my-bet-match-info">
                <span class="my-bet-teams">${getFlag(m.team1)} ${escapeHtml(m.team1)} vs ${escapeHtml(m.team2)} ${getFlag(m.team2)}</span>
                <span class="my-bet-date">${stageLabel} · ${formatDate(m.date)}</span>
            </div>
            <div class="my-bet-scores-row">
                <div class="my-bet-col">
                    <span class="my-bet-col-label">הניחוש שלי</span>
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
    if (!newPwd || newPwd.length < 4) { alert('סיסמה חייבת להכיל לפחות 4 תווים'); return; }
    if (db) ref('settings/adminPassword').set(newPwd).catch(err => console.warn('Failed to save password:', err));
    $('new-password-input').value = '';
    alert('הסיסמה שונתה בהצלחה!');
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

    if (!t1 || !t2 || !date) { alert('נא למלא קבוצה 1, קבוצה 2 ותאריך'); return; }

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
    const list = Object.entries(data).sort((a, b) => new Date(a[1].date) - new Date(b[1].date));

    if (list.length === 0) {
        container.innerHTML = '<p class="state-msg">אין משחקים עדיין.</p>';
        return;
    }

    let html = '';
    list.forEach(([id, m]) => {
        const stageLabel = m.stage === 'group'
            ? `בית ${m.group || ''}`
            : (STAGE_LABELS[m.stage] || m.stage);
        const resultStr = m.result
            ? `<span class="admin-result-badge">${m.result.team1Goals}–${m.result.team2Goals}</span>`
            : '';

        html += `
        <div class="admin-match-row" id="admin-row-${id}">
            <div class="admin-match-info">
                <div class="admin-match-teams">${getFlag(m.team1)} ${escapeHtml(m.team1)} vs ${escapeHtml(m.team2)} ${getFlag(m.team2)} ${resultStr}</div>
                <div class="admin-match-meta">${stageLabel} · ${formatDate(m.date)}</div>
            </div>
            <div class="admin-match-actions">
                <button class="btn btn-secondary btn-sm" onclick="openEditModal('${id}')">ערוך</button>
                <button class="btn btn-primary btn-sm" onclick="openResultModal('${id}')">הזן תוצאה</button>
                <button class="btn btn-danger btn-sm" onclick="adminDeleteMatch('${id}')">מחק</button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

async function adminDeleteMatch(matchId) {
    if (!confirm('למחוק משחק זה?')) return;
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

    if (!t1 || !t2 || !date) { alert('נא למלא שדות חובה'); return; }

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
        $('modal-match-title').textContent = `${m.team1} vs ${m.team2}`;
        $('modal-team1-name').textContent  = m.team1;
        $('modal-team2-name').textContent  = m.team2;
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
    alert('תוצאה נשמרה! הנקודות חושבו מחדש.');
}

async function recalcPoints(matchId, resG1, resG2) {
    if (!db) return;

    // Get all bets for this match
    const usersSnap = await ref('users').once('value');
    const usersData = usersSnap.val() || {};

    const updates = {};

    for (const userId of Object.keys(usersData)) {
        const betSnap = await ref(`bets/${userId}/${matchId}`).once('value');
        if (!betSnap.exists()) continue;

        const bet = betSnap.val();
        const pts = calcPoints(bet.team1Goals, bet.team2Goals, resG1, resG2);

        // Update this bet's points
        updates[`bets/${userId}/${matchId}/points`] = pts;
    }

    // Apply all bet point updates
    if (Object.keys(updates).length > 0) {
        await db.ref(FB_ROOT).update(updates);
    }

    // Now recompute each user's total points
    for (const userId of Object.keys(usersData)) {
        const allBetsSnap = await ref(`bets/${userId}`).once('value');
        const allBets = allBetsSnap.val() || {};
        const total = Object.values(allBets)
            .reduce((sum, b) => sum + (b.points || 0), 0);
        await ref(`users/${userId}/totalPoints`).set(total);
    }
}


// ============================================================
// ADMIN: USERS MANAGEMENT
// ============================================================

function loadAdminUsers() {
    if (!db) return;
    ref('users').on('value', snap => {
        renderAdminUsers(snap.val() || {});
    });
}

function renderAdminUsers(data) {
    const container = $('admin-users-container');
    const list = Object.entries(data)
        .sort((a, b) => (b[1].totalPoints || 0) - (a[1].totalPoints || 0));

    if (list.length === 0) {
        container.innerHTML = '<p class="state-msg">אין משתמשים רשומים.</p>';
        return;
    }

    let html = '';
    list.forEach(([userId, u]) => {
        html += `
        <div class="admin-match-row" id="admin-user-row-${userId}">
            <div class="admin-match-info">
                <div class="admin-match-teams">${escapeHtml(u.name)}</div>
                <div class="admin-match-meta">${escapeHtml(u.email)} · ${u.totalPoints || 0} נק'</div>
            </div>
            <div class="admin-match-actions">
                <button class="btn btn-secondary btn-sm" onclick="openEditUserModal('${userId}')">ערוך שם</button>
                <button class="btn btn-danger btn-sm" onclick="adminDeleteUser('${userId}', '${escapeHtml(u.name).replace(/'/g, "\\'")}')">מחק</button>
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
    if (!name) { alert('נא להזין שם'); return; }
    if (db) await ref(`users/${userId}/name`).set(name);
    hide('edit-user-modal');
}

async function adminDeleteUser(userId, userName) {
    if (!confirm(`למחוק את המשתמש "${userName}" וכל ההימורים שלו?`)) return;
    if (!db) return;
    await Promise.all([
        ref(`users/${userId}`).remove(),
        ref(`bets/${userId}`).remove(),
    ]);
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

