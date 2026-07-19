// ============================================================
// WORLD CUP 2026 BETTING APP
// ============================================================

// ---- Tournament config ----

const TOURNAMENTS = {
    worldcup2026: {
        label: 'מונדיאל 2026',
        icon:  '⚽',
        stages: ['group','R32','R16','QF','SF','3rd','Final','special'],
    },
    ucl2025: {
        label: "ליגת האלופות '25",
        icon:  '🏆',
        stages: ['SF','Final','special'],
    },
};

let activeTournament = 'ucl2025';

// ---- Stage / flag helpers ----

function getStageLabel(stage) {
    return t('stage.' + stage);
}
function getGroupPrefix() { return t('stage.groupPrefix'); }

// kept for reference; actual order comes from TOURNAMENTS[activeTournament].stages
const STAGE_ORDER = ['group','R32','R16','QF','SF','3rd','Final','special'];

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
    // Club teams – English names
    'Arsenal':'🔴','Arsenal FC':'🔴',
    'Chelsea':'🔵','Liverpool':'🔴',
    'Manchester City':'🩵','Man City':'🩵',
    'Manchester United':'🔴','Man United':'🔴','Man Utd':'🔴',
    'Tottenham':'⚪','Spurs':'⚪',
    'Paris Saint-Germain':'🔵','Paris Saint Germain':'🔵','Paris SG':'🔵','PSG':'🔵',
    'Real Madrid':'⚪','Barcelona':'🔵','Atletico Madrid':'🔴','Atlético Madrid':'🔴',
    'Bayern Munich':'🔴','Bayern':'🔴','Borussia Dortmund':'🟡','Dortmund':'🟡','BVB':'🟡',
    'Juventus':'⚫','AC Milan':'🔴','Inter Milan':'🔵','Inter':'🔵',
    'Ajax':'🔴','Porto':'🔵','Benfica':'🔴',
    'Celtic':'🟢','Rangers':'🔵',
    // Club teams – Hebrew names
    'ארסנל':'🔴','ארסנל FC':'🔴',
    "צ'לסי":'🔵','ליברפול':'🔴',
    "מנצ'סטר סיטי":'🩵','מנצ סיטי':'🩵',
    "מנצ'סטר יונייטד":'🔴','מנצ יונייטד':'🔴',
    'טוטנהאם':'⚪',
    "פריז סן ז'רמן":'🔵','פריז סן גרמן':'🔵','פריז':'🔵',
    "פ.ס.ז'":'🔵','פ.ס.ז':'🔵','פ.ס.ג':'🔵',"פ.ס.ג'":'🔵','פסז':'🔵',
    'ריאל מדריד':'⚪','ברצלונה':'🔵','אטלטיקו מדריד':'🔴',
    'באיירן מינכן':'🔴','באיירן':'🔴','בורוסיה דורטמונד':'🟡','דורטמונד':'🟡',
    'יובנטוס':'⚫','מילאן':'🔴','אינטר מילאן':'🔵','אינטר':'🔵',
    'איאקס':'🔴','פורטו':'🔵','בנפיקה':'🔴',
};

const TEAM_LOGOS = {
    'arsenal':              'assets/flags/arsenal.svg',
    'arsenal fc':           'assets/flags/arsenal.svg',
    'ארסנל':                'assets/flags/arsenal.svg',
    'ארסנל fc':             'assets/flags/arsenal.svg',
    'psg':                  'assets/flags/psg.svg',
    'paris saint-germain':  'assets/flags/psg.svg',
    'paris saint germain':  'assets/flags/psg.svg',
    'paris sg':             'assets/flags/psg.svg',
    "פריז סן ז'רמן":        'assets/flags/psg.svg',
    'פריז סן גרמן':         'assets/flags/psg.svg',
    'פריז':                 'assets/flags/psg.svg',
    "פ.ס.ז'":               'assets/flags/psg.svg',
    'פ.ס.ז':                'assets/flags/psg.svg',
    'פ.ס.ג':                'assets/flags/psg.svg',
    "פ.ס.ג'":               'assets/flags/psg.svg',
    'פסז':                  'assets/flags/psg.svg',
    'atletico madrid':      'assets/flags/atletico.svg',
    'atletico de madrid':   'assets/flags/atletico.svg',
    'atlético madrid':      'assets/flags/atletico.svg',
    'atlético de madrid':   'assets/flags/atletico.svg',
    'atletico':             'assets/flags/atletico.svg',
    'אתלטיקו מדריד':        'assets/flags/atletico.svg',
    'אתלטיקו':              'assets/flags/atletico.svg',
    'bayern munich':        'assets/flags/bayern.svg',
    'fc bayern munich':     'assets/flags/bayern.svg',
    'fc bayern':            'assets/flags/bayern.svg',
    'bayern':               'assets/flags/bayern.svg',
    'באיירן מינכן':         'assets/flags/bayern.svg',
    'באיירן':               'assets/flags/bayern.svg',
};

function getFlag(name) {
    if (!name) return '🏳️';
    const lower = name.trim().toLowerCase();
    if (TEAM_LOGOS[lower]) {
        return `<img class="team-logo-img" src="${TEAM_LOGOS[lower]}" alt="${name}">`;
    }
    if (TEAM_FLAGS[name]) return TEAM_FLAGS[name];
    for (const key of Object.keys(TEAM_FLAGS)) {
        if (key.toLowerCase() === lower) return TEAM_FLAGS[key];
    }
    console.log('[flag] no match for:', JSON.stringify(name));
    return '🏳️';
}

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

const TOP_SCORER_CANDIDATES = [
    'Kylian Mbappé','Harry Kane','Erling Haaland','Vinícius Jr.',
    'Lautaro Martínez','Lionel Messi','Bukayo Saka','Lamine Yamal',
    'Ousmane Dembélé','Raphinha','Mikel Oyarzabal','Richarlison',
    'João Pedro','Cole Palmer','Jamal Musiala','Florian Wirtz',
    'Antoine Griezmann','Julián Álvarez','Rodrygo','Phil Foden',
    'Cristiano Ronaldo','Bruno Fernandes','Rafael Leão','Gonçalo Ramos',
    'Victor Osimhen','Mohamed Salah','Dušan Vlahović','Aleksandar Mitrović',
    'Romelu Lukaku','Loïs Openda','Christian Pulisic','Santiago Giménez',
    'Darwin Núñez','Federico Valverde','Cody Gakpo','Memphis Depay',
    'Randal Kolo Muani','Kai Havertz','Leroy Sané','Khvicha Kvaratskhelia',
];

function getSortedScorerCandidates() {
    return [...TOP_SCORER_CANDIDATES].sort((a, b) =>
        a.localeCompare(b, currentLang)
    );
}

// פול התמנון (Paul the Octopus) — the automated dummy member. Same id as the
// updater's paul-core PAUL_USER_ID; he is created/scored server-side.
const PAUL_USER_ID = 'paul-octopus';
function isPaul(uid) { return uid === PAUL_USER_ID; }

// HTML label for a member in lists: Paul gets a 🐙 + his localized name; everyone
// else their (escaped) stored name. Returns markup, so callers insert it directly.
function memberLabel(uid, fallbackName) {
    if (isPaul(uid)) return `<span class="octo-icon">🐙</span>${escapeHtml(t('paul.name'))}`;
    return escapeHtml(fallbackName);
}

// One scorer line for the live card: "⚽ <minute> <name>" with a penalty/own-goal mark.
// Returns markup, so callers insert it directly.
function scorerLine(s) {
    const min = typeof s.minute === 'number'
        ? (typeof s.extra === 'number' && s.extra > 0 ? `${s.minute}+${s.extra}'` : `${s.minute}'`)
        : '';
    const mark = s.kind === 'pen' ? ` ${t('live.penaltyMark')}` : s.kind === 'og' ? ` ${t('live.ownGoalMark')}` : '';
    return `<div class="live-scorer">⚽ <span class="live-scorer-min">${min}</span> ${escapeHtml(s.player)}${mark}</div>`;
}

// ---- Scoring ----

function getOutcome(g1, g2) {
    if (g1 > g2) return 'win1';
    if (g1 < g2) return 'win2';
    return 'draw';
}

// Knockout = any stage that isn't the group stage or the special (champion/top-scorer) bets.
function isKnockoutStage(stage) {
    return stage != null && stage !== 'group' && stage !== 'special';
}

// Group: exact=4, direction=1, miss=0. Knockout (R32+): exact=5 (+2 if 5+ total goals), direction=2.
// Knockout results are entered as the 90-minute score (see the updater's regularTime sourcing).
function calcPoints(betGoals1, betGoals2, resGoals1, resGoals2, stage) {
    const ko = isKnockoutStage(stage);
    if (betGoals1 === resGoals1 && betGoals2 === resGoals2) {
        if (ko) return (resGoals1 + resGoals2) >= 5 ? 7 : 5;
        return 4;
    }
    if (getOutcome(betGoals1, betGoals2) === getOutcome(resGoals1, resGoals2)) return ko ? 2 : 1;
    return 0;
}

// ---- App State ----

let currentUser = null;
let matches      = {};
let userBets     = {};
let allGroupBets = {};
let onAllGroupBets = null; // named callback so it can be detached precisely
let allGroupSpecialBets = {};       // all members' champion/top-scorer bets (for the leaderboard)
let onAllGroupSpecialBets = null;   // named callback so it can be detached precisely
let activeTab    = 'matches';
let stageFilter  = 'all';
let _matchesNeedsFocus = false; // scroll to the last-played match on next matches render
let _lastPlayedMatchId = null;  // most recent match already kicked off (set in renderMatches)
let _nextUpcomingMatchId = null; // next unplayed match (set in renderMatches)
let _autoLiveTabPending = false; // on first matches load after login, open Live tab if a game is on
let _autoStageFilterPending = false; // on first matches load, auto-select stage of next upcoming match
let isAdminMode  = false;
let isAdminAuthed = false;
let pendingResultMatchId = null;
let pendingEditMatchId   = null;

// ---- Multi-group state ----
let currentGroupId = null;
let userGroups     = {};
let groupMembers   = {};
let groupUsersCache = {};
let groupSwitchMenuOpen = false;
let pendingJoinCode = null;
let pendingMode     = null; // 'public' | 'join' | 'create' | null
const PENDING_JOIN_KEY = 'wc2026_pendingJoin'; // sessionStorage: invite survives reload
const RETURNING_KEY    = 'wc2026_returning';   // localStorage: has entered a group on this device

// ---- Tournament bets state ----
let tournamentSettings = { teams: [], scorers: [], winner: null, topScorer: null };
let specialBets        = {};
let tournamentCountdownTimer = null;
// ---- Auth / routing state ----
// _routing is a short-lived re-entrancy guard (always released in finally), NOT a
// permanent lock. _routedUserId records the identity we last routed into the app so
// duplicate auth callbacks don't re-route or flicker. Explicit user logins pass
// force=true to bypass the idempotency check.
let _routing      = false;
let _routedUserId = null;

// Emails allowed to access the admin panel (checked after Google/email login).
const ADMIN_EMAILS = ['ohad.reshef@ingenio.com', 'ohad.reshef@gmail.com'];

const TOURNAMENT_POINTS = 10;

const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateInviteCode() {
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += INVITE_ALPHABET.charAt(Math.floor(Math.random() * INVITE_ALPHABET.length));
    }
    return code;
}

// ---- Firebase refs ----

function ref(path) {
    return db.ref(`${activeTournament}/${path}`);
}

// ---- Utilities ----

function emailToId(email) {
    return email.toLowerCase().replace(/[.#$[\]/]/g, '_');
}

function parseMatchDate(dateStr) {
    if (!dateStr) return new Date(0);
    return new Date(dateStr + 'Z');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    return parseMatchDate(dateStr).toLocaleString('he-IL', {
        weekday: 'short', day: 'numeric', month: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Asia/Jerusalem',
    });
}

function matchIsLocked(match) {
    return parseMatchDate(match.date) - new Date() <= 5 * 60 * 1000;
}

// A match belongs in the Live tab once its bets are locked and until at least an
// hour after it ends. End time = finishedAt when present, else kickoff + 2h.
function isInLiveTab(m, now) {
    if (!m || !m.date) return false;
    if (!matchIsLocked(m)) return false;                 // bets still open
    const hasResult = m.result !== null && m.result !== undefined;
    if (!hasResult) return true;                         // locked + not finished
    const endTime = m.finishedAt || (parseMatchDate(m.date).getTime() + 2 * 3600 * 1000);
    return (now - endTime) < 60 * 60 * 1000;             // kept <1h after end
}

// Live match minute. Uses the API's real elapsed minute (apiMin, captured at `upd`)
// as the base and ticks forward by wall-clock since then; falls back to estimating
// from kickoff when no API minute is available yet. Returns '' at halftime (the
// status badge already says so).
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

// Re-tick all live-minute labels (called from the 1s interval).
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

function formatCountdown(ms) {
    if (ms <= 0) return t('match.started');
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
}

setInterval(() => {
    document.querySelectorAll('.match-countdown[data-match-date]').forEach(el => {
        const diff = parseMatchDate(el.dataset.matchDate) - new Date();
        el.textContent = formatCountdown(diff);
    });
    updateLiveMinutes();
}, 1000);

function $ (id) { return document.getElementById(id); }

function show(id)  { const e=$(id); e.classList.remove('hidden'); e.style.display=''; }
function hide(id)  { const e=$(id); e.classList.add('hidden'); }
function showEl(el){ el.classList.remove('hidden'); el.style.display=''; }
function hideEl(el){ el.classList.add('hidden'); }


// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    isAdminMode = params.has('admin');
    const joinCode = (params.get('join') || '').trim().toUpperCase();
    if (joinCode && /^[A-Z0-9]{6}$/.test(joinCode)) {
        pendingJoinCode = joinCode;
        try { sessionStorage.setItem(PENDING_JOIN_KEY, joinCode); } catch (e) {}
    } else {
        // Restore an in-progress invite across a reload. routeAfterLogin strips
        // ?join from the URL, so a refresh / address-bar Enter would otherwise
        // arrive with no code and strand the user on the mode-choice screen.
        // Cleared only once the join actually succeeds (or on logout).
        try {
            const saved = sessionStorage.getItem(PENDING_JOIN_KEY);
            if (saved && /^[A-Z0-9]{6}$/.test(saved)) pendingJoinCode = saved;
        } catch (e) {}
    }

    if (isAdminMode) {
        setupAdminListeners();
    }

    $('btn-google-login').addEventListener('click', handleGoogleLogin);
    $('btn-google-login-mode').addEventListener('click', handleGoogleLogin);
    $('email-login-form').addEventListener('submit', handleEmailLogin);

    $('btn-mode-public').addEventListener('click',  () => { pendingMode = 'public';  showLoginScreen(); });
    $('btn-mode-join').addEventListener('click',    () => { pendingMode = 'join';    showLoginScreen(); });
    $('btn-mode-create').addEventListener('click',  () => { pendingMode = 'create';  showLoginScreen(); });

    // Invite link or admin: skip mode-choice and go straight to login
    if (pendingJoinCode || isAdminMode) showLoginScreen();

    initAuth();
    $('btn-logout').addEventListener('click', handleLogout);

    document.querySelectorAll('.tab-bar:not(.admin-tab-bar) .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => setStageFilter(btn.dataset.stage));
    });

    document.querySelectorAll('.tournament-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTournament(btn.dataset.tournament));
    });

    $('btn-cancel-result').addEventListener('click', () => hide('result-modal'));
    $('btn-cancel-edit').addEventListener('click',   () => hide('edit-modal'));
    $('btn-cancel-edit-user').addEventListener('click', () => hide('edit-user-modal'));
    $('btn-save-result').addEventListener('click', saveResult);
    $('btn-save-edit').addEventListener('click', saveEditMatch);
    $('btn-save-edit-user').addEventListener('click', saveEditUser);

    $('btn-admin-back').addEventListener('click', () => {
        window.location.href = window.location.pathname;
    });

    if (!isAdminMode) setupGroupUIListeners();
});

function showLoginScreen() {
    show('login-screen');
    hide('mode-choice-screen');
    hide('main-app');
    hide('admin-panel');
    hide('group-picker-screen');
}

function showGroupPicker() {
    hide('login-screen');
    hide('main-app');
    hide('admin-panel');
    hide('mode-choice-screen');
    show('group-picker-screen');
    if (currentUser) $('picker-username').textContent = currentUser.name;
}

function showModeChoice() {
    show('mode-choice-screen');
    hide('login-screen');
    hide('group-picker-screen');
    hide('main-app');
    hide('admin-panel');
}

// Entry screen for users with no identity yet. Returning users (anyone who has
// entered a group on this device) go straight to the login screen so they can
// just sign in again and land back in their group — no invite code needed, and
// no confusing mode-choice detour. Only genuinely new users see mode-choice.
function showInitialScreen() {
    if (pendingJoinCode || isAdminMode) { showLoginScreen(); return; }
    let returning = false;
    try { returning = localStorage.getItem(RETURNING_KEY) === '1'; } catch (e) {}
    if (returning) showLoginScreen();
    else showModeChoice();
}

// Drop the pending invite everywhere: state, the reload-survival store, and the URL.
function clearPendingJoin() {
    pendingJoinCode = null;
    try { sessionStorage.removeItem(PENDING_JOIN_KEY); } catch (e) {}
    if (location.search.includes('join=')) history.replaceState({}, '', location.pathname);
}

// Decide which screen to show once we have an identity (currentUser). Pure and
// idempotent — safe to call from several auth callbacks. The re-entrancy guard
// (_routing) prevents two concurrent runs and is always released. Explicit user
// logins pass force=true so they always route even if the identity matches.
async function routeAfterLogin(force) {
    if (!currentUser) { showInitialScreen(); return; }
    if (!force && _routedUserId === currentUser.userId) return;
    if (_routing) return;
    _routing = true;
    _routedUserId = currentUser.userId; // commit; cleared below on failure to allow retry
    try {
        if (!db) { showGroupPicker(); return; }

        if (pendingJoinCode) {
            const result = await autoJoinByCode(pendingJoinCode);
            if (result === true) {            // joined for real — done
                clearPendingJoin();
                return;
            }
            if (result === 'invalid') {       // bad code — give up, route normally
                clearPendingJoin();
            }
            // else: transient failure (auth token not ready on the fast path, or a
            // network/permission blip). KEEP pendingJoinCode so the next routing
            // pass — after onAuthStateChanged establishes the token — retries it.
        }

        const snap = await ref(`userGroups/${currentUser.userId}`).once('value');
        const groupIds = Object.keys(snap.val() || {});

        if (groupIds.length > 0) {
            const lastActive = localStorage.getItem('wc2026_activeGroup');
            const chosen = (lastActive && groupIds.includes(lastActive)) ? lastActive : groupIds[0];
            pendingMode = null;
            enterAppForGroup(chosen);
            return;
        }

        if (pendingMode === 'public') { pendingMode = null; await joinPublicGroup(); return; }
        if (pendingMode === 'join')   { pendingMode = null; showGroupPicker(); openJoinGroupModal();   return; }
        if (pendingMode === 'create') { pendingMode = null; showGroupPicker(); openCreateGroupModal(); return; }

        showGroupPicker();
    } catch (err) {
        _routedUserId = null; // transient failure — let a later callback retry
        console.warn('routeAfterLogin error:', err && err.message);
        showGroupPicker();
    } finally {
        _routing = false;
    }
}

async function autoJoinByCode(code) {
    try {
        let snap = await ref(`inviteCodes/${code}`).once('value');
        // Fallback: check the other tournament's invite codes (e.g. groups created during UCL mode)
        if (!snap.exists()) {
            const other = activeTournament === 'worldcup2026' ? 'ucl2025' : 'worldcup2026';
            snap = await db.ref(`${other}/inviteCodes/${code}`).once('value');
        }
        if (!snap.exists()) {
            alert(t('joinGroup.errorInvalid'));
            return 'invalid'; // definitively bad code — caller stops retrying
        }
        const groupId = snap.val();
        const memberSnap = await ref(`groups/${groupId}/members/${currentUser.userId}`).once('value');
        if (!memberSnap.exists()) {
            const updates = {};
            updates[`groups/${groupId}/members/${currentUser.userId}`] = { joinedAt: Date.now(), totalPoints: 0, name: currentUser.name };
            updates[`userGroups/${currentUser.userId}/${groupId}`] = true;
            await db.ref(activeTournament).update(updates);
        }
        enterAppForGroup(groupId);
        return true;
    } catch (err) {
        console.warn('autoJoinByCode error:', err.message);
        return false;
    }
}

async function joinPublicGroup() {
    const PUBLIC_GROUP_ID = 'public';
    const userId = currentUser.userId;
    try {
        const groupSnap = await ref(`groups/${PUBLIC_GROUP_ID}`).once('value');
        const updates = {};
        if (!groupSnap.exists()) {
            updates[`groups/${PUBLIC_GROUP_ID}/name`]       = 'ניחושי מונדיאל - ציבורי';
            updates[`groups/${PUBLIC_GROUP_ID}/ownerId`]    = 'system';
            updates[`groups/${PUBLIC_GROUP_ID}/inviteCode`] = 'PUBLIC';
            updates[`groups/${PUBLIC_GROUP_ID}/createdAt`]  = 0;
            updates[`groups/${PUBLIC_GROUP_ID}/isPublic`]   = true;
            updates[`inviteCodes/PUBLIC`] = PUBLIC_GROUP_ID;
        }
        const memberSnap = groupSnap.exists()
            ? await ref(`groups/${PUBLIC_GROUP_ID}/members/${userId}`).once('value')
            : { exists: () => false };
        if (!memberSnap.exists()) {
            updates[`groups/${PUBLIC_GROUP_ID}/members/${userId}`] = { joinedAt: Date.now(), totalPoints: 0, name: currentUser.name };
            updates[`userGroups/${userId}/${PUBLIC_GROUP_ID}`] = true;
        }
        if (Object.keys(updates).length > 0) {
            await db.ref(activeTournament).update(updates);
        }
        enterAppForGroup(PUBLIC_GROUP_ID);
    } catch (err) {
        console.warn('joinPublicGroup error:', err.message);
        showGroupPicker();
    }
}

async function ensureUserProfile() {
    if (!db || !currentUser || !currentUser.userId || !currentUser.name) return;
    try {
        const snap = await ref(`users/${currentUser.userId}`).once('value');
        if (!snap.exists()) {
            await ref(`users/${currentUser.userId}`).set({ name: currentUser.name, email: currentUser.email || '' });
        }
    } catch(e) {}
}

function enterAppForGroup(groupId) {
    currentGroupId = groupId;
    localStorage.setItem('wc2026_activeGroup', groupId);
    try { localStorage.setItem(RETURNING_KEY, '1'); } catch (e) {} // returning user from now on
    hide('login-screen');
    hide('group-picker-screen');
    hide('mode-choice-screen'); // default-visible screen — must be hidden or it stacks above the app
    hide('admin-panel');
    show('main-app');
    $('header-username').textContent = currentUser.name;
    ensureUserProfile();
    _autoLiveTabPending = true;                             // open Live tab on first load if a game is on
    _autoStageFilterPending = true;                         // auto-select stage of next upcoming match
    startFirebaseListeners();
    if (activeTab === 'matches') _matchesNeedsFocus = true; // focus next-upcoming on first load too
    renderCurrentTab();
}

// ============================================================
// AUTH
// ============================================================
//
// Identity model
// --------------
// The app's identity is the user object { userId, name, email } persisted in a
// cookie + localStorage (see session helpers below). The DB rules are wide-open,
// so NO Firebase auth token is required to read or write data.
//
// Firebase Auth is used for ONE thing only: Google sign-in, which yields a
// verified email we turn into the canonical email-based userId. We deliberately
// do NOT use anonymous sign-in — it added nothing (open rules) and caused races
// that replaced the Google session and triggered auth loops.
//
// Routing happens through routeAfterLogin(), which is idempotent per identity.

// ---- Session persistence (survives iOS Safari storage pressure) ----
function saveUserSession(userData) {
    try { localStorage.setItem('wc2026_emailUser', JSON.stringify(userData)); } catch(e) {}
    try {
        const val = btoa(encodeURIComponent(JSON.stringify(userData)));
        const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = 'wc2026_u=' + val + '; expires=' + exp + '; path=/; SameSite=Lax';
    } catch(e) {}
}

function loadUserSession() {
    try { const ls = localStorage.getItem('wc2026_emailUser'); if (ls) return JSON.parse(ls); } catch(e) {}
    try {
        const m = document.cookie.match(/(?:^|;\s*)wc2026_u=([^;]+)/);
        if (m) {
            const data = JSON.parse(decodeURIComponent(atob(m[1])));
            try { localStorage.setItem('wc2026_emailUser', JSON.stringify(data)); } catch(e) {}
            return data;
        }
    } catch(e) {}
    return null;
}

function clearUserSession() {
    try { localStorage.removeItem('wc2026_emailUser'); } catch(e) {}
    try { document.cookie = 'wc2026_u=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'; } catch(e) {}
}

function initAuth() {
    // Fast path: restore a saved session synchronously so returning users land in
    // the app immediately, without waiting for Firebase Auth to initialise.
    // (Admin must Google-authenticate, so skip the cookie restore in admin mode.)
    if (!isAdminMode) {
        const saved = loadUserSession();
        if (saved) { currentUser = saved; routeAfterLogin(); }
    }

    if (!auth) {
        if (!currentUser) showInitialScreen();
        return;
    }

    // Firebase Auth listener: authoritative for Google sign-in and admin gating.
    auth.onAuthStateChanged(async user => {
        if (user && !user.isAnonymous) {
            // Real (Google) user — verified identity always wins.
            await setupUserFromAuth(user);
            if (isAdminMode) {
                const email = (currentUser && currentUser.email || '').toLowerCase();
                if (!ADMIN_EMAILS.includes(email)) {
                    // Authenticated but not an admin — fall back to the normal app.
                    isAdminMode = false;
                    hide('admin-panel');
                    await routeAfterLogin(true);
                    return;
                }
                show('admin-panel');
                hide('login-screen');
                hide('main-app');
                hide('mode-choice-screen');
                return;
            }
            await routeAfterLogin();
            return;
        }
        // No real user (signed out, or a leftover anonymous session we ignore).
        if (currentUser) return;            // already restored via the fast path
        if (isAdminMode) { showLoginScreen(); return; }
        const saved = loadUserSession();
        if (saved) { currentUser = saved; await routeAfterLogin(); }
        else showInitialScreen();
    });
}

// Resolve a Google sign-in into our canonical email-based identity and persist it.
// If an email-based profile already exists, use it (handles users who first joined
// via the email form, then later signed in with Google using the same address).
async function setupUserFromAuth(firebaseUser) {
    const email       = firebaseUser.email || '';
    const firebaseUid = firebaseUser.uid;
    let   name        = firebaseUser.displayName || email.split('@')[0] || 'User';

    let userId = firebaseUid;
    if (db && email) {
        try {
            const emailUserId = emailToId(email);
            if (emailUserId !== firebaseUid) {
                const [emailSnap, uidSnap] = await Promise.all([
                    ref(`users/${emailUserId}`).once('value'),
                    ref(`users/${firebaseUid}`).once('value'),
                ]);
                if (emailSnap.exists()) { userId = emailUserId; name = emailSnap.val().name || name; }
                else if (!uidSnap.exists()) { userId = emailUserId; } // brand-new — start canonical
                // else: only a firebaseUid record exists; keep it until admin merge migrates.
            }
        } catch(e) {}
    }

    if (db) {
        try {
            const snap = await ref(`users/${userId}`).once('value');
            if (!snap.exists()) await ref(`users/${userId}`).set({ name, email });
            else name = snap.val().name || name;
        } catch(err) { console.warn('User sync failed:', err); }
    }
    currentUser = { userId, name, email };
    saveUserSession(currentUser);
}

// Google sign-in is offered on both the login screen and the mode-choice screen,
// so surface errors on whichever error element is present/visible.
function loginErrorEls() {
    return ['login-error', 'mode-login-error'].map(id => $(id)).filter(Boolean);
}

async function handleGoogleLogin() {
    loginErrorEls().forEach(hideEl);
    if (!auth) return;
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
        // onAuthStateChanged handles identity + routing after a successful sign-in.
    } catch (err) {
        if (!err || err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
        let msg = err.message;
        if (
            err.code === 'auth/popup-blocked' ||
            err.code === 'auth/missing-initial-state' ||
            err.code === 'auth/web-storage-unsupported'
        ) {
            msg = 'כניסה עם Google לא נתמכת בדפדפן המובנה (WhatsApp/Telegram). אנא פתח את ' + window.location.hostname + ' ב-Safari או Chrome.';
        }
        loginErrorEls().forEach(el => { el.textContent = msg; showEl(el); });
    }
}

async function handleEmailLogin(e) {
    e.preventDefault();
    const errEl = $('login-error');
    hideEl(errEl);
    const name  = $('input-name').value.trim();
    const email = $('input-email').value.trim().toLowerCase();
    if (!name || !email || !email.includes('@')) {
        errEl.textContent = 'נא למלא שם ואימייל תקין';
        showEl(errEl);
        return;
    }
    // If this email is registered with Google, steer the user to the Google button.
    if (auth) {
        try {
            const methods = await auth.fetchSignInMethodsForEmail(email);
            if (methods && methods.includes('google.com')) {
                errEl.textContent = 'האימייל הזה מחובר לחשבון Google — אנא השתמש בכפתור "כניסה עם Google"';
                showEl(errEl);
                return;
            }
        } catch(e) { /* network / config error — allow through */ }
    }
    const userId = emailToId(email);
    let finalName = name;
    if (db) {
        try {
            const snap = await ref(`users/${userId}`).once('value');
            if (!snap.exists()) await ref(`users/${userId}`).set({ name, email });
            else finalName = snap.val().name || name;
        } catch(err) { console.warn('User sync failed:', err); }
    }
    currentUser = { userId, name: finalName, email, emailLogin: true };
    saveUserSession(currentUser);
    await routeAfterLogin(true); // explicit user action — always route
}

function stopGroupListeners() {
    if (!db || !currentGroupId || !currentUser) return;
    ref(`groups/${currentGroupId}/members`).off();
    ref(`bets/${currentGroupId}/${currentUser.userId}`).off();
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

function handleLogout() {
    if (db) {
        ref('matches').off();
        stopGroupListeners();
        if (currentUser) ref(`userGroups/${currentUser.userId}`).off();
    }
    if (auth) auth.signOut().catch(() => {});
    clearUserSession();
    currentUser    = null;
    currentGroupId = null;
    _routedUserId  = null;
    userGroups     = {};
    groupMembers   = {};
    groupUsersCache = {};
    matches      = {};
    userBets     = {};
    allGroupBets = {};
    localStorage.removeItem('wc2026_activeGroup');
    clearPendingJoin();
    showInitialScreen();
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

    ref('matches').on('value', snap => {
        matches = snap.val() || {};
        // On first load after login, jump straight to the Live tab if a game is on.
        if (_autoLiveTabPending) {
            _autoLiveTabPending = false;
            if (hasLiveGameNow()) { switchTab('live'); return; }  // switchTab renders
        }
        // On first load, set the stage filter to the stage of the next upcoming match.
        if (_autoStageFilterPending) {
            _autoStageFilterPending = false;
            applyAutoStageFilter();
        }
        if (activeTab === 'matches') renderMatches();
        if (activeTab === 'my-bets') renderMyBets();
        if (activeTab === 'tournament') renderTournament();
        if (activeTab === 'live') renderLive();
    }, permissionError);

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

    if (currentUser) {
        ref(`userGroups/${currentUser.userId}`).on('value', async snap => {
            const gids = Object.keys(snap.val() || {});
            const meta = {};
            await Promise.all(gids.map(async gid => {
                const gsnap = await ref(`groups/${gid}`).once('value');
                const g = gsnap.val();
                if (g) meta[gid] = { name: g.name, ownerId: g.ownerId, inviteCode: g.inviteCode, logoUrl: g.logoUrl || null };
            }));
            userGroups = meta;
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

    ref(`groups/${currentGroupId}/members`).on('value', async snap => {
        groupMembers = snap.val() || {};
        const missing = Object.keys(groupMembers).filter(uid => !groupUsersCache[uid]);
        await Promise.all(missing.map(async uid => {
            const usnap = await ref(`users/${uid}`).once('value');
            const u = usnap.val();
            if (u) {
                groupUsersCache[uid] = { name: u.name, email: u.email };
            } else if (currentUser && uid === currentUser.userId && currentUser.name) {
                groupUsersCache[uid] = { name: currentUser.name, email: currentUser.email || '' };
                try { await ref(`users/${uid}`).set({ name: currentUser.name, email: currentUser.email || '' }); } catch(e) {}
            } else if (groupMembers[uid] && groupMembers[uid].name) {
                groupUsersCache[uid] = { name: groupMembers[uid].name };
                try { await ref(`users/${uid}`).set({ name: groupMembers[uid].name }); } catch(e) {}
            }
        }));
        // Names for members whose name lives only in users/{uid} are resolved above
        // (into groupUsersCache). Re-render the active name-showing tab so they replace
        // the "unknown user" fallback instead of waiting for the next data update.
        if (activeTab === 'leaderboard') renderLeaderboard();
        else if (activeTab === 'live') renderLive();
        else if (activeTab === 'matches') renderMatches();
    }, () => {});

    if (currentUser) {
        ref(`bets/${currentGroupId}/${currentUser.userId}`).on('value', snap => {
            userBets = snap.val() || {};
            if (activeTab === 'matches')  renderMatches();
            if (activeTab === 'my-bets') renderMyBets();
        }, () => {});

        ref(`specialBets/${currentGroupId}/${currentUser.userId}`).on('value', snap => {
            specialBets = snap.val() || {};
            if (activeTab === 'tournament') renderTournament();
        }, () => {});
    }

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

// ============================================================
// TAB NAVIGATION
// ============================================================

function switchTab(tab) {
    activeTab = tab;
    if (tab === 'matches') _matchesNeedsFocus = true; // focus last-played when opening the tab
    document.querySelectorAll('.tab-bar:not(.admin-tab-bar) .tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('#main-app .tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === `tab-${tab}`);
        p.style.display = p.id === `tab-${tab}` ? 'block' : 'none';
    });
    renderCurrentTab();
    // Tabs share the page scroll, and opening משחקים scrolls down to the last-played
    // match. Without resetting, every other tab inherits that bottom scroll. Matches
    // manages its own scroll via the focus logic, so only reset for the rest.
    if (tab !== 'matches') window.scrollTo(0, 0);
}

function renderCurrentTab() {
    if (activeTab === 'matches')     renderMatches();
    else if (activeTab === 'leaderboard') renderLeaderboard();
    else if (activeTab === 'my-bets')     renderMyBets();
    else if (activeTab === 'tournament')  renderTournament();
    else if (activeTab === 'live')        renderLive();

    if (activeTab === 'tournament') startTournamentCountdown();
    else stopTournamentCountdown();
}

function setStageFilter(stage) {
    stageFilter = stage;
    _autoStageFilterPending = false; // user is choosing; don't override later
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.stage === stage);
    });
    renderMatches();
}

function findNextUpcomingMatchStage() {
    const now = Date.now();
    let best = null;
    Object.entries(matches).forEach(([id, m]) => {
        if (!m || !m.date || !m.stage) return;
        if (m.stage === 'special') return;
        if (m.result) return;
        const t = parseMatchDate(m.date).getTime();
        if (isNaN(t) || t < now) return;
        if (!best || t < best.t) best = { id, stage: m.stage, t };
    });
    return best;
}

function applyAutoStageFilter() {
    if (!matches || Object.keys(matches).length === 0) return;
    const next = findNextUpcomingMatchStage();
    if (!next || !next.stage) return;
    stageFilter = next.stage;
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.stage === stageFilter);
    });
}

function switchTournament(key) {
    if (key === activeTournament) return;

    if (db) ref('matches').off();

    activeTournament = key;
    matches = {};
    stageFilter = 'all';

    const cfg = TOURNAMENTS[key];
    const titleEl = $('app-bar-title'); // removed from the slim main-app header; admin still has one
    if (titleEl) titleEl.textContent = `${cfg.icon} ${cfg.label}`;

    document.querySelectorAll('.tournament-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tournament === key);
    });

    document.querySelectorAll('.filter-btn[data-stage]').forEach(b => {
        const s = b.dataset.stage;
        b.style.display = (s === 'all' || cfg.stages.includes(s)) ? '' : 'none';
    });

    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.stage === 'all');
    });

    // Only restart the matches listener; groups/bets/leaderboard stay on the existing root
    if (db) {
        ref('matches').on('value', snap => {
            matches = snap.val() || {};
            if (activeTab === 'matches') renderMatches();
            if (activeTab === 'my-bets') renderMyBets();
            if (activeTab === 'tournament') renderTournament();
            if (activeTab === 'live') renderLive();
        }, () => {});
    }

    renderCurrentTab();
}


// ============================================================
// RENDER: MATCHES TAB
// ============================================================

function renderMatches() {
    const container         = $('matches-container');
    const featuredContainer = $('featured-matches-container');

    const allMatchList = Object.entries(matches)
        .map(([id, m]) => ({ id, ...m }))
        .filter(m => !m.tournament || m.tournament === activeTournament)
        .sort((a, b) => {
            const diff = parseMatchDate(a.date) - parseMatchDate(b.date);
            if (diff !== 0) return diff;
            return (a.group || '').localeCompare(b.group || '');
        });

    const specialMatches = allMatchList.filter(m => m.stage === 'special');
    const regularMatches = allMatchList.filter(m => m.stage !== 'special');

    if (specialMatches.length > 0) {
        let featuredHtml = '<div class="featured-section">';
        featuredHtml += '<div class="featured-section-label">⭐ משחק מיוחד</div>';
        specialMatches.forEach(m => { featuredHtml += buildMatchCard(m); });
        featuredHtml += '</div><hr class="featured-section-divider">';
        featuredContainer.innerHTML = featuredHtml;
    } else {
        featuredContainer.innerHTML = '';
    }

    const matchList = regularMatches
        .filter(m => stageFilter === 'all' || m.stage === stageFilter);

    // Track the most recent match already kicked off (list is sorted ascending),
    // so opening the tab can focus it instead of the top of the schedule.
    const _now = new Date();
    let lastPlayed = null;
    let nextUpcoming = null;
    for (const m of matchList) {
        if (parseMatchDate(m.date) <= _now) lastPlayed = m;
        else if (!nextUpcoming) nextUpcoming = m;
    }
    _lastPlayedMatchId = lastPlayed ? lastPlayed.id : null;
    _nextUpcomingMatchId = nextUpcoming ? nextUpcoming.id : null;

    if (matchList.length === 0) {
        container.innerHTML = `<p class="state-msg">${t('match.emptyState')}</p>`;
    } else {
        let html = '';
        matchList.forEach(m => { html += buildMatchCard(m); });
        container.innerHTML = html;
    }

    [container, featuredContainer].forEach(c => {
        c.querySelectorAll('.btn-save-bet').forEach(btn => {
            btn.addEventListener('click', () => saveBet(btn.dataset.matchId));
        });
        c.querySelectorAll('.bet-edit-link').forEach(btn => {
            btn.addEventListener('click', () => unlockBetEdit(btn.dataset.matchId));
        });
        c.querySelectorAll('.breakdown-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const el = document.getElementById(`breakdown-${btn.dataset.matchId}`);
                if (el) el.classList.toggle('hidden');
            });
        });
    });

    // On first open of the matches tab, focus the next upcoming match (or the most
    // recent already-kicked-off match as a fallback). Only fires when the tab was
    // just opened, not on every background data refresh — that would yank scroll.
    const focusId = _nextUpcomingMatchId || _lastPlayedMatchId;
    if (_matchesNeedsFocus && focusId) {
        _matchesNeedsFocus = false;
        scrollToFocusMatch(focusId, !!_nextUpcomingMatchId);
    }
}

function scrollToFocusMatch(id, highlight) {
    if (!id) return;
    requestAnimationFrame(() => {
        const el = document.getElementById(`card-${id}`);
        if (!el) return;
        el.scrollIntoView({ block: 'center' });
        if (highlight) {
            el.classList.add('match-card-next');
            setTimeout(() => el.classList.remove('match-card-next'), 2200);
        }
    });
}

function buildMatchCard(m) {
    const locked = matchIsLocked(m);
    const bet    = userBets[m.id];
    const hasResult = m.result !== null && m.result !== undefined;
    const safeId = m.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    const msUntilLock = parseMatchDate(m.date) - new Date();
    const closingSoon = !locked && !hasResult && msUntilLock > 0 && msUntilLock <= 24 * 60 * 60 * 1000;

    let badgeClass, badgeText;
    if (hasResult) {
        badgeClass = 'badge-completed'; badgeText = t('match.status.completed');
    } else if (locked) {
        badgeClass = 'badge-locked'; badgeText = t('match.status.locked');
    } else {
        badgeClass = 'badge-upcoming match-countdown';
        badgeText = formatCountdown(parseMatchDate(m.date) - new Date());
    }

    let middleHtml = '';
    let betAreaHtml = '';
    if (hasResult) {
        middleHtml = `<div class="result-score">${m.result.team1Goals} – ${m.result.team2Goals}</div>`
            + (m.resultAet && (m.resultAet.team1Goals !== m.result.team1Goals || m.resultAet.team2Goals !== m.result.team2Goals)
                ? `<div class="result-aet">${t('match.aet')} ${m.resultAet.team1Goals}–${m.resultAet.team2Goals}</div>` : '');
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
        if (bet && !bet._editing) {
            middleHtml = `
                <div class="my-bet-label">${t('match.yourBet')}</div>
                <div class="my-bet-score">${bet.team1Goals} – ${bet.team2Goals}</div>
                <button class="bet-edit-link" data-match-id="${m.id}">${t('match.editBet')}</button>`;
        } else {
            const v1 = bet ? bet.team1Goals : 0;
            const v2 = bet ? bet.team2Goals : 0;
            middleHtml = `<span class="match-vs">vs</span>`;
            betAreaHtml = `
                <div class="match-bet-area">
                    <div class="bet-inputs">
                        <div class="bet-stepper">
                            <button type="button" class="stepper-btn" onclick="stepBet('bet1-${safeId}',-1)">−</button>
                            <input type="number" class="bet-score-input" id="bet1-${m.id}" min="0" max="30" value="${v1}" inputmode="numeric">
                            <button type="button" class="stepper-btn" onclick="stepBet('bet1-${safeId}',1)">+</button>
                        </div>
                        <span class="bet-sep">–</span>
                        <div class="bet-stepper">
                            <button type="button" class="stepper-btn" onclick="stepBet('bet2-${safeId}',-1)">−</button>
                            <input type="number" class="bet-score-input" id="bet2-${m.id}" min="0" max="30" value="${v2}" inputmode="numeric">
                            <button type="button" class="stepper-btn" onclick="stepBet('bet2-${safeId}',1)">+</button>
                        </div>
                    </div>
                    <button class="btn-save-bet" data-match-id="${m.id}">${t('match.saveBet')}</button>
                </div>`;
        }
    }

    let pointsHtml = '';
    if (!m.noPoints) {
        if (hasResult && bet && bet.points !== null && bet.points !== undefined) {
            const pts = bet.points;
            const cls = pts >= 4 ? 'points-3' : pts > 0 ? 'points-1' : 'points-0';
            const emoji = pts >= 4 ? '🎯' : pts > 0 ? '✅' : '❌';
            pointsHtml = `<div class="match-points-row ${cls}">${emoji} ${t('match.pointsRow')}: ${bet.team1Goals}–${bet.team2Goals} | ${pts} ${t('match.pointsLabel')}</div>`;
        } else if (hasResult && !bet) {
            pointsHtml = `<div class="match-points-row points-na">${t('match.noBetRow')}</div>`;
        }
    }

    let breakdownHtml = '';
    if (hasResult) {
        const nameForUid = uid => (groupUsersCache[uid] && groupUsersCache[uid].name)
            || (groupMembers[uid] && groupMembers[uid].name) || t('groupSettings.unknownUser');
        const orderedUids = Object.keys(groupMembers).sort((a, b) =>
            (((groupMembers[b] && groupMembers[b].totalPoints) || 0) - ((groupMembers[a] && groupMembers[a].totalPoints) || 0))
            || nameForUid(a).localeCompare(nameForUid(b)));
        const rows = orderedUids.map(uid => {
            const name = nameForUid(uid);
            const b = (allGroupBets[uid] || {})[m.id];
            const betStr = b ? `${b.team1Goals}–${b.team2Goals}` : '—';
            const pts = b ? calcPoints(b.team1Goals, b.team2Goals, m.result.team1Goals, m.result.team2Goals, m.stage) : 0;
            const cls = pts >= 4 ? 'points-3' : pts > 0 ? 'points-1' : 'points-0';
            return `<div class="live-person-row ${cls}"><span class="lp-name">${escapeHtml(name)}</span><span class="lp-bet">${betStr}</span><span class="lp-pts">${pts}</span></div>`;
        }).join('');
        breakdownHtml = `
        <button class="breakdown-toggle" data-match-id="${m.id}">${t('match.showBreakdown')}</button>
        <div class="match-breakdown hidden" id="breakdown-${m.id}">
            <div class="live-person-row live-person-head"><span>${t('match.yourBet')}</span><span></span><span>${t('match.pointsLabel')}</span></div>
            ${rows}
        </div>`;
    }

    const matchScorers = Array.isArray(m.scorers) ? m.scorers : [];
    const matchScorersCol = team => matchScorers.filter(s => s.team === team).map(scorerLine).join('');
    const scorersHtml = matchScorers.length
        ? `<div class="live-scorers"><div class="live-scorers-col">${matchScorersCol(1)}</div><div class="live-scorers-col">${matchScorersCol(2)}</div></div>`
        : '';

    return `
    <div class="match-card${closingSoon ? ' match-card--closing-soon' : ''}" id="card-${m.id}">
        <div class="match-card-header">
            <span class="match-date-str">${formatDate(m.date)}</span>
            <span class="match-status-badge ${badgeClass}" data-match-date="${m.date}">${badgeText}</span>
            ${closingSoon ? `<span class="closing-soon-hint">⏰ ${t('match.closingSoon')}</span>` : ''}
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
            ${scorersHtml}
            ${betAreaHtml}
            ${pointsHtml}
            ${breakdownHtml}
        </div>
    </div>`;
}

// ============================================================
// BET ACTIONS
// ============================================================

function stepBet(inputId, delta) {
    const el = $(inputId);
    if (!el) return;
    el.value = Math.max(0, Math.min(30, (parseInt(el.value) || 0) + delta));
}

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

    if (userBets[matchId]) delete userBets[matchId]._editing;
}

function unlockBetEdit(matchId) {
    if (!userBets[matchId]) return;
    userBets[matchId]._editing = true;
    renderMatches();
}


// ============================================================
// RENDER: LIVE TAB
// ============================================================

function renderLive() {
    const container = $('live-container');
    if (!container) return;
    const now = Date.now();
    const games = Object.entries(matches)
        .map(([id, m]) => ({ id, ...m }))
        .filter(m => (!m.tournament || m.tournament === activeTournament) && m.stage !== 'special')
        .filter(m => isInLiveTab(m, now))
        // Active games (in-play / locked-not-started) on top, sorted by kickoff so the
        // current/soonest game leads. Finished games sink below (most recently ended
        // first) and still auto-clear 1h after they end via isInLiveTab.
        .sort((a, b) => {
            const aDone = a.result !== null && a.result !== undefined;
            const bDone = b.result !== null && b.result !== undefined;
            if (aDone !== bDone) return aDone ? 1 : -1;
            if (!aDone) return parseMatchDate(a.date) - parseMatchDate(b.date);
            const endA = a.finishedAt || (parseMatchDate(a.date).getTime() + 2 * 3600 * 1000);
            const endB = b.finishedAt || (parseMatchDate(b.date).getTime() + 2 * 3600 * 1000);
            return endB - endA;
        });

    if (games.length === 0) { container.innerHTML = `<p class="state-msg">${t('live.empty')}</p>`; return; }
    // Combined standings across ALL live games, computed once and shared by every card.
    const standings = projectLiveStandings(games, groupMembers, allGroupBets, now);
    container.innerHTML = games.map(m => buildLiveCard(m, standings)).join('');
}

// Projected live standings across ALL currently-live games, so concurrent games
// accumulate. Pure. For each member: currentTotal − Σ already-counted + Σ provisional
// over every scored game (a finalized game nets 0; an in-play game adds its live points).
function projectLiveStandings(games, members, bets, now) {
    const uids = Object.keys(members || {});
    const nameOf = uid => (groupUsersCache[uid] && groupUsersCache[uid].name) || (members[uid] && members[uid].name) || t('groupSettings.unknownUser');
    const scoreOf = g => {
        const hasResult = g.result !== null && g.result !== undefined;
        const started = parseMatchDate(g.date).getTime() <= now;
        return hasResult ? g.result : (g.live ? g.live : (started ? { team1Goals: 0, team2Goals: 0 } : null));
    };
    const scored = (games || []).map(g => ({ g, s: scoreOf(g) })).filter(x => x.s);
    const currentTotal = uid => (members[uid] && members[uid].totalPoints) || 0;
    const projectedTotal = {};
    for (const uid of uids) {
        let delta = 0;
        for (const { g, s } of scored) {
            const b = (bets[uid] || {})[g.id];
            const provisional = calcPoints(b ? b.team1Goals : 0, b ? b.team2Goals : 0, s.team1Goals, s.team2Goals, g.stage);
            const counted = (b && typeof b.points === 'number') ? b.points : 0;
            delta += provisional - counted;
        }
        projectedTotal[uid] = currentTotal(uid) + delta;
    }
    const oldPos = {};
    [...uids].sort((a, b) => currentTotal(b) - currentTotal(a) || nameOf(a).localeCompare(nameOf(b)))
        .forEach((uid, i) => { oldPos[uid] = i + 1; });
    const orderedUids = Array.from(uids).sort((a, b) =>
        projectedTotal[b] - projectedTotal[a] || currentTotal(b) - currentTotal(a) || nameOf(a).localeCompare(nameOf(b)));
    return { orderedUids, projectedTotal, oldPos };
}

function buildLiveCard(m, ctx) {
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

    let statusKey, badgeClass, dot = '';
    if (hasResult || isFt) { statusKey = 'match.status.completed'; badgeClass = 'badge-completed'; }  // game over
    else if (isPaused) { statusKey = 'live.statusHalftime'; badgeClass = 'badge-live'; dot = '<span class="live-dot"></span>'; }
    else if (inPlay) { statusKey = 'live.statusLive'; badgeClass = 'badge-live'; dot = '<span class="live-dot"></span>'; }
    else { statusKey = 'live.statusLocked'; badgeClass = 'badge-locked'; }   // locked, not started yet

    const scoreHtml = noDataPaused
        ? '–'
        : (score
            ? `${score.team1Goals}<span class="live-score-sep">–</span>${score.team2Goals}`
            : `<span class="live-not-started">${t('live.notStarted')}</span>`);

    const scorers = Array.isArray(m.scorers) ? m.scorers : ((live && Array.isArray(live.scorers)) ? live.scorers : []);
    const scorersCol = team => scorers.filter(s => s.team === team).map(scorerLine).join('');
    const scorersHtml = scorers.length
        ? `<div class="live-scorers"><div class="live-scorers-col">${scorersCol(1)}</div><div class="live-scorers-col">${scorersCol(2)}</div></div>`
        : '';

    // Projected live leaderboard: each member's current total + this match's
    // provisional points, ranked, with medals (🥇🥈🥉) and ↑/↓ vs their current spot.
    const nameOf = uid => (groupUsersCache[uid] && groupUsersCache[uid].name) || (groupMembers[uid] && groupMembers[uid].name) || t('groupSettings.unknownUser');
    // This card's OWN provisional points (for the +N pill / pick). Missing bet = 0–0,
    // matching the updater's auto-fill.
    const matchOf = uid => { if (!score) return 0; const b = (allGroupBets[uid] || {})[m.id]; return calcPoints(b ? b.team1Goals : 0, b ? b.team2Goals : 0, score.team1Goals, score.team2Goals, m.stage); };
    const betOf  = uid => { const b = (allGroupBets[uid] || {})[m.id]; return b ? `${b.team1Goals}–${b.team2Goals}` : '0–0'; };
    // Standings are computed once across ALL live games (so concurrent games accumulate)
    // and shared via ctx — every live card shows the same combined projected total.
    const { orderedUids, projectedTotal, oldPos } = ctx;

    const rowsHtml = orderedUids.map((uid, i) => {
        const rank  = i + 1;
        const isMe  = currentUser && uid === currentUser.userId;
        const mp    = matchOf(uid);
        const total = projectedTotal[uid];
        const delta = oldPos[uid] - rank;   // > 0 = climbed
        const chg   = delta > 0 ? `<span class="live-lb-chg up">▲${delta}</span>`
                    : delta < 0 ? `<span class="live-lb-chg down">▼${-delta}</span>` : '';
        const rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
        const meTag = isMe ? ` <span class="lb-me-tag">${t('leaderboard.meTag')}</span>` : '';
        const pillCls = !score ? 'p0' : mp >= 4 ? 'p4' : mp > 0 ? 'p1' : 'p0';
        const pillTxt = (!score || mp === 0) ? '–' : `+${mp}`;
        return `<div class="live-lb-row ${isMe ? 'is-me' : ''}">`
             + `<span class="live-lb-chgcol">${chg}</span>`
             + `<span class="live-lb-rank">${rankLabel}</span>`
             + `<span class="live-lb-name">${memberLabel(uid, nameOf(uid))}${meTag}</span>`
             + `<span class="live-lb-total">${total}</span>`
             + `<span class="live-lb-pill ${pillCls}">${pillTxt}</span>`
             + `<span class="live-lb-pick">${betOf(uid)}</span>`
             + `</div>`;
    }).join('');

    // Live minute label (only while actually playing — not at FT). Data attrs let the
    // 1s interval tick it between API polls; extra = stoppage minutes ("90+3'").
    const apiMin = live && typeof live.minute === 'number' ? live.minute : '';
    const apiExtra = live && typeof live.extra === 'number' ? live.extra : '';
    const upd = live && live.updatedAt ? live.updatedAt : '';
    const minStatus = isPaused ? 'PAUSED' : 'IN_PLAY';
    const minuteHtml = (inPlay || isPaused)
        ? `<span class="live-minute" data-kickoff="${kickoffMs}" data-min="${apiMin}" data-extra="${apiExtra}" data-upd="${upd}" data-status="${minStatus}" data-hasnode="${hadData ? 1 : 0}">${noDataPaused ? '' : computeLiveMinute(Date.now(), kickoffMs, apiMin === '' ? null : apiMin, apiExtra === '' ? null : apiExtra, upd === '' ? null : upd, minStatus)}</span>`
        : '';

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

    return `
    <div class="match-card live-card${paused ? ' live-stale' : ''}" id="live-${m.id}">
        <div class="match-card-header">
            <span class="match-date-str">${formatDate(m.date)}</span>
            ${badgeHtml}
        </div>
        <div class="live-scoreline">
            <span class="live-team">${getFlag(m.team1)} <span class="live-team-name">${escapeHtml(translateTeam(m.team1))}</span></span>
            <span class="live-score-wrap"><span class="live-score">${scoreHtml}</span>${minuteHtml}</span>
            <span class="live-team">${getFlag(m.team2)} <span class="live-team-name">${escapeHtml(translateTeam(m.team2))}</span></span>
        </div>
        ${scorersHtml}
        <div class="live-people">
            <div class="live-lb-row live-lb-head"><span class="live-lb-chgcol"></span><span class="live-lb-rank">#</span><span class="live-lb-name"></span><span class="live-lb-total">${t('live.total')}</span><span class="live-lb-pill">±</span><span class="live-lb-pick">${t('match.yourBet')}</span></div>
            ${rowsHtml}
        </div>
    </div>`;
}

// True when a game of the active tournament is currently in progress (started, not
// finished, within the in-play window) — used to auto-open the Live tab on login.
function hasLiveGameNow() {
    const now = Date.now();
    return Object.values(matches || {}).some(m => {
        if (!m || !m.team1 || !m.date) return false;
        if (m.tournament && m.tournament !== activeTournament) return false;
        if (m.stage === 'special') return false;
        if (m.result && m.result.team1Goals !== undefined) return false;
        const k = parseMatchDate(m.date).getTime();
        return k <= now && (now - k) <= 3 * 60 * 60 * 1000;
    });
}

// ============================================================
// RENDER: LEADERBOARD
// ============================================================

function renderLeaderboard() {
    const container = $('leaderboard-container');

    const entries = Object.entries(groupMembers)
        .map(([uid, m]) => ({
            userId: uid,
            name: (groupUsersCache[uid] && groupUsersCache[uid].name) || (groupMembers[uid] && groupMembers[uid].name) || t('groupSettings.unknownUser'),
            totalPoints: m.totalPoints || 0,
        }))
        .sort((a, b) => b.totalPoints - a.totalPoints);

    if (entries.length === 0) {
        container.innerHTML = `<p class="state-msg">${t('leaderboard.empty')}</p>`;
        return;
    }

    // "Form": each member's points in the last 5 finished matches (oldest→newest),
    // shown as colored dots (gold = exact 4, green = correct 1, gray = miss 0).
    // Ordered by KICKOFF date (same comparator as the Matches tab) — not finishedAt,
    // which is the updater's write time and gets reset when a game is re-finalized (VAR),
    // making games jump around out of chronological order.
    const last5 = Object.entries(matches)
        .map(([id, mm]) => ({ id, ...mm }))
        .filter(mm => (!mm.tournament || mm.tournament === activeTournament) && mm.stage !== 'special'
                   && mm.result && mm.result.team1Goals !== undefined)
        .sort((a, b) => {
            const diff = parseMatchDate(a.date) - parseMatchDate(b.date);
            if (diff !== 0) return diff;
            return (a.group || '').localeCompare(b.group || '');
        })
        .slice(-5);
    const formHtml = uid => last5.map(fm => {
        const p = ((allGroupBets[uid] || {})[fm.id] || {}).points;
        const pts = (p === undefined || p === null) ? 0 : p;
        const cls = pts >= 4 ? 'f4' : pts > 0 ? 'f1' : 'f0';
        return `<span class="lb-form-dot ${cls}">${pts}</span>`;
    }).join('');

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

    let html = '<div class="leaderboard-table">';
    entries.forEach((u, i) => {
        const rank    = i + 1;
        const isMe    = currentUser && u.userId === currentUser.userId;
        const medal   = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        const meTag   = isMe ? `<span class="lb-me-tag">${t('leaderboard.meTag')}</span>` : '';
        html += `
        <div class="leaderboard-row ${isMe ? 'is-me' : ''}">
            <span class="lb-rank">${medal}</span>
            <span class="lb-name">${memberLabel(u.userId, u.name)} ${meTag}${specialHtml(u.userId)}</span>
            <span class="lb-form">${formHtml(u.userId)}</span>
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
            const cls = pts >= 4 ? 'points-3' : pts > 0 ? 'points-1' : 'points-0';
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
    // Special bets lock Sunday 14/6/2026 at 23:59 Israel time (UTC+3 = 20:59 UTC)
    return new Date('2026-06-14T20:59:00Z').getTime();
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
    const { winner, topScorer } = tournamentSettings;
    const teams = getSortedParticipatingTeams();
    const scorers = getSortedScorerCandidates();
    const finalSet = !!(winner || topScorer);

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
        if (saveWinnerBtn) saveWinnerBtn.addEventListener('click', async () => {
            const v = $('tournament-winner-select').value;
            if (!v) { alert(t('tournament.pickNeeded')); return; }
            await saveSpecialBet('winner', { team: v });
            const btn = $('btn-save-winner');
            if (btn) {
                btn.textContent = '✓ נשמר';
                btn.classList.add('btn-saved');
                setTimeout(() => { if ($('btn-save-winner')) { btn.textContent = t('common.save'); btn.classList.remove('btn-saved'); } }, 2500);
            }
        });
        const saveScorerBtn = $('btn-save-scorer');
        if (saveScorerBtn) saveScorerBtn.addEventListener('click', async () => {
            const v = $('tournament-scorer-select').value;
            if (!v) { alert(t('tournament.pickNeeded')); return; }
            await saveSpecialBet('topScorer', { player: v });
            const btn = $('btn-save-scorer');
            if (btn) {
                btn.textContent = '✓ נשמר';
                btn.classList.add('btn-saved');
                setTimeout(() => { if ($('btn-save-scorer')) { btn.textContent = t('common.save'); btn.classList.remove('btn-saved'); } }, 2500);
            }
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
        await db.ref(activeTournament).update(updates);
    }

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

function adminSwitchTournament(key) {
    if (key === activeTournament) return;
    if (db) ref('matches').off();
    activeTournament = key;
    ['worldcup2026','ucl2025'].forEach(k => {
        const btn = $(`admin-t-${k}`);
        if (btn) btn.classList.toggle('active', k === key);
    });
    loadAdminMatches();
}

function setupAdminListeners() {
    $('btn-admin-login').addEventListener('click', attemptAdminLogin);
    $('admin-password-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') attemptAdminLogin();
    });
    $('btn-add-match').addEventListener('click', adminAddMatch);
    $('btn-seed-matches').addEventListener('click', adminSeedMatches);
    $('btn-fix-wc-matches').addEventListener('click', adminFixMisplacedWCMatches);
    $('btn-change-password').addEventListener('click', adminChangePassword);
    $('btn-save-tournament-result').addEventListener('click', adminSaveTournamentResult);

    document.querySelectorAll('.admin-tab-bar .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.adminTab;
            document.querySelectorAll('.admin-tab-bar .tab-btn').forEach(b => b.classList.toggle('active', b === btn));
            document.querySelectorAll('#admin-content > .tab-panel').forEach(p => {
                const on = p.id === `admin-tab-${target}`;
                p.classList.toggle('active', on);
                p.style.display = on ? 'block' : 'none';
            });
        });
    });
}

let _adminLoginAttempts = 0;
let _adminLockoutUntil  = 0;

function attemptAdminLogin() {
    const pwd   = $('admin-password-input').value;
    const errEl = $('admin-auth-error');
    hideEl(errEl);

    // Rate-limit: lock out for 60 s after 3 consecutive wrong passwords.
    if (Date.now() < _adminLockoutUntil) {
        const secs = Math.ceil((_adminLockoutUntil - Date.now()) / 1000);
        errEl.textContent = `יותר מדי ניסיונות. נסה שוב בעוד ${secs} שניות.`;
        showEl(errEl);
        return;
    }

    // Email whitelist: must be logged in as an authorised address.
    if (!currentUser || !ADMIN_EMAILS.includes((currentUser.email || '').toLowerCase())) {
        errEl.textContent = 'הגישה לאדמין מותרת רק לכתובות דואר מורשות.';
        showEl(errEl);
        return;
    }

    if (!db) {
        errEl.textContent = 'Firebase לא מחובר';
        showEl(errEl);
        return;
    }

    function doLogin(storedPwd) {
        if (storedPwd && pwd === storedPwd) {
            _adminLoginAttempts = 0;
            isAdminAuthed = true;
            hide('admin-auth');
            show('admin-content');
            loadAdminMatches();
            loadAdminUsers();
            loadAdminGroups();
            loadAdminTournament();
        } else {
            _adminLoginAttempts++;
            if (_adminLoginAttempts >= 3) {
                _adminLockoutUntil  = Date.now() + 60 * 1000;
                _adminLoginAttempts = 0;
            }
            errEl.textContent = 'סיסמה שגויה';
            showEl(errEl);
        }
    }

    ref('settings/adminPassword').once('value')
        .then(snap => doLogin(snap.exists() ? snap.val() : null))
        .catch(() => {
            errEl.textContent = 'שגיאה בטעינת הגדרות — נסה שוב';
            showEl(errEl);
        });
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
    const t1       = $('new-team1').value.trim();
    const t2       = $('new-team2').value.trim();
    const date     = $('new-date').value;
    const stage    = $('new-stage').value;
    const grp      = $('new-group-label').value.trim().toUpperCase();
    const noPoints = $('new-no-points').checked;

    if (!t1 || !t2 || !date) { alert(t('admin.addMatchMissing')); return; }

    const matchData = {
        team1: t1, team2: t2,
        date, stage,
        group:      stage === 'group' ? (grp || null) : null,
        tournament: activeTournament,
        status:     'upcoming',
        result:     null,
    };
    if (noPoints) matchData.noPoints = true;

    if (db) {
        await ref('matches').push(matchData);
    }

    ['new-team1','new-team2','new-date','new-group-label'].forEach(id => { $(id).value = ''; });
    $('new-no-points').checked = false;
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
        const safeId = id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        html += `
        <div class="admin-match-row" id="admin-row-${escapeHtml(id)}">
            <div class="admin-match-info">
                <div class="admin-match-teams">${getFlag(m.team1)} ${escapeHtml(translateTeam(m.team1))} vs ${escapeHtml(translateTeam(m.team2))} ${getFlag(m.team2)} ${resultStr}</div>
                <div class="admin-match-meta">${stageLabel} · ${formatDate(m.date)}</div>
            </div>
            <div class="admin-match-actions">
                <button class="btn btn-secondary btn-sm" onclick="openEditModal('${safeId}')">${t('common.edit')}</button>
                <button class="btn btn-primary btn-sm" onclick="openResultModal('${safeId}')">${t('admin.enterResult')}</button>
                <button class="btn btn-danger btn-sm" onclick="adminDeleteMatch('${safeId}')">${t('common.delete')}</button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

async function adminDeleteMatch(matchId) {
    if (!confirm(t('admin.deleteMatchConfirm'))) return;
    if (db) await ref(`matches/${matchId}`).remove();
}

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

function openResultModal(matchId) {
    pendingResultMatchId = matchId;
    ref(`matches/${matchId}`).once('value').then(snap => {
        const m = snap.val();
        if (!m) { alert('Match not found: ' + matchId); return; }
        $('modal-match-title').textContent = `${translateTeam(m.team1)} vs ${translateTeam(m.team2)}`;
        $('modal-team1-name').textContent  = translateTeam(m.team1);
        $('modal-team2-name').textContent  = translateTeam(m.team2);
        $('modal-score1').value = m.result ? m.result.team1Goals : 0;
        $('modal-score2').value = m.result ? m.result.team2Goals : 0;
        show('result-modal');
    }).catch(err => { console.error('openResultModal failed:', err); alert('שגיאה בטעינת המשחק: ' + err.message); });
}

async function saveResult() {
    const matchId = pendingResultMatchId;
    if (!matchId || !db) return;

    const g1 = parseInt($('modal-score1').value, 10);
    const g2 = parseInt($('modal-score2').value, 10);
    if (isNaN(g1) || isNaN(g2)) return;

    const matchSnap = await ref(`matches/${matchId}`).once('value');
    const matchData = matchSnap.val();

    await ref(`matches/${matchId}`).update({
        result: { team1Goals: g1, team2Goals: g2 },
        status: 'completed',
    });

    hide('result-modal');

    if (matchData && matchData.noPoints) {
        alert(t('admin.resultSaved'));
    } else {
        await recalcPoints(matchId, g1, g2);
        alert(t('admin.resultSaved'));
    }
}

async function recalcPoints(matchId, resG1, resG2) {
    if (!db) return;
    const stage = (matches[matchId] || {}).stage;

    const groupsSnap = await ref('groups').once('value');
    const groupsData = groupsSnap.val() || {};
    const updates = {};

    for (const groupId of Object.keys(groupsData)) {
        const members = (groupsData[groupId] && groupsData[groupId].members) || {};
        for (const userId of Object.keys(members)) {
            const betSnap = await ref(`bets/${groupId}/${userId}/${matchId}`).once('value');
            if (!betSnap.exists()) {
                // Write the full auto-fill object in one path to avoid conflicting parent/child writes
                const pts = calcPoints(0, 0, resG1, resG2, stage);
                updates[`bets/${groupId}/${userId}/${matchId}`] = { team1Goals: 0, team2Goals: 0, placedAt: 0, points: pts };
            } else {
                const bet = betSnap.val();
                const pts = calcPoints(bet.team1Goals, bet.team2Goals, resG1, resG2, stage);
                updates[`bets/${groupId}/${userId}/${matchId}/points`] = pts;
            }
        }
    }

    if (Object.keys(updates).length > 0) {
        await db.ref(activeTournament).update(updates);
    }

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

    const [userGroupsSnap, groupsSnap] = await Promise.all([
        ref('userGroups').once('value'),
        ref('groups').once('value'),
    ]);
    const ugData = userGroupsSnap.val() || {};
    const groupsData = groupsSnap.val() || {};

    let html = '';
    list.forEach(([userId, u]) => {
        const gids = Object.keys(ugData[userId] || {});
        const groupBadges = gids.map(gid => {
            const g = groupsData[gid];
            if (!g) return '';
            const isOwner = g.ownerId === userId;
            const cls = isOwner ? 'group-badge group-badge-owner' : 'group-badge';
            const label = isOwner ? ` 👑` : '';
            return `<span class="${cls}">${escapeHtml(g.name)}${label}</span>`;
        }).join('');
        const groupsLine = gids.length
            ? `<div class="admin-user-groups">${groupBadges}</div>`
            : `<div class="admin-match-meta">${t('admin.noGroups')}</div>`;
        html += `
        <div class="admin-match-row" id="admin-user-row-${userId}">
            <div class="admin-match-info">
                <div class="admin-match-teams">${escapeHtml(u.name)}</div>
                <div class="admin-match-meta">${escapeHtml(u.email)} · ${gids.length} ${t('admin.groupsCount')}</div>
                ${groupsLine}
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

    await db.ref(activeTournament).update(updates);
    loadAdminUsers();
    loadAdminGroups();
}

async function adminRecalcAll(btn) {
    if (!db) return;
    btn.disabled = true;
    btn.textContent = 'מחשב...';
    try {
        const snap = await ref('matches').once('value');
        const allMatches = snap.val() || {};
        const completed = Object.entries(allMatches)
            .filter(([, m]) => m.result && m.result.team1Goals !== undefined);
        for (const [matchId, m] of completed) {
            await recalcPoints(matchId, m.result.team1Goals, m.result.team2Goals);
        }
        btn.textContent = `✓ חושבו ${completed.length} משחקים`;
        btn.style.background = '#38a169';
        btn.style.color = '#fff';
    } catch(err) {
        console.error('Recalc error:', err);
        btn.textContent = '❌ שגיאה';
        btn.disabled = false;
        alert('שגיאה: ' + err.message);
    }
}

async function adminMergeDuplicates(btn) {
    if (!db) return;
    btn.disabled = true;
    btn.textContent = 'מחפש כפולים...';

    try {
        const usersSnap = await ref('users').once('value');
        const users = usersSnap.val() || {};

        // Group user records by normalised email
        const byEmail = {};
        for (const [uid, u] of Object.entries(users)) {
            if (!u.email) continue;
            const email = u.email.toLowerCase().trim();
            if (!byEmail[email]) byEmail[email] = [];
            byEmail[email].push({ uid, name: u.name || '', email });
        }

        let mergeCount = 0;

        for (const [email, list] of Object.entries(byEmail)) {
            const canonicalId = emailToId(email);
            const duplicates  = list.filter(u => u.uid !== canonicalId);
            if (duplicates.length === 0) continue;

            // Ensure the canonical users/ record exists
            if (!users[canonicalId]) {
                const src = list[0];
                await ref(`users/${canonicalId}`).set({ name: src.name, email: src.email });
            }

            for (const dup of duplicates) {
                const dupUid = dup.uid;

                const ugSnap  = await ref(`userGroups/${dupUid}`).once('value');
                const dupGids = Object.keys(ugSnap.val() || {});
                const updates = {};

                for (const gid of dupGids) {
                    // Migrate group membership
                    const dupMSnap  = await ref(`groups/${gid}/members/${dupUid}`).once('value');
                    if (dupMSnap.exists()) {
                        const dupM     = dupMSnap.val();
                        const canMSnap = await ref(`groups/${gid}/members/${canonicalId}`).once('value');
                        if (!canMSnap.exists()) {
                            updates[`groups/${gid}/members/${canonicalId}`] = {
                                ...dupM,
                                name: (users[canonicalId] || dup).name || dupM.name || '',
                            };
                        } else {
                            const canM = canMSnap.val();
                            if ((dupM.totalPoints || 0) > (canM.totalPoints || 0)) {
                                updates[`groups/${gid}/members/${canonicalId}/totalPoints`] = dupM.totalPoints;
                            }
                        }
                        updates[`groups/${gid}/members/${dupUid}`] = null;
                    }

                    // Migrate match bets (duplicate fills gaps in canonical)
                    const dupBSnap  = await ref(`bets/${gid}/${dupUid}`).once('value');
                    if (dupBSnap.exists()) {
                        const canBSnap = await ref(`bets/${gid}/${canonicalId}`).once('value');
                        const merged   = { ...dupBSnap.val(), ...(canBSnap.val() || {}) };
                        updates[`bets/${gid}/${canonicalId}`]  = merged;
                        updates[`bets/${gid}/${dupUid}`]       = null;
                    }

                    // Migrate special bets (canonical wins on conflict)
                    const dupSSnap  = await ref(`specialBets/${gid}/${dupUid}`).once('value');
                    if (dupSSnap.exists()) {
                        const canSSnap = await ref(`specialBets/${gid}/${canonicalId}`).once('value');
                        if (!canSSnap.exists()) {
                            updates[`specialBets/${gid}/${canonicalId}`] = dupSSnap.val();
                        }
                        updates[`specialBets/${gid}/${dupUid}`] = null;
                    }

                    updates[`userGroups/${canonicalId}/${gid}`] = true;
                }

                if (Object.keys(updates).length) {
                    await db.ref(activeTournament).update(updates);
                }

                await ref(`userGroups/${dupUid}`).remove();
                await ref(`users/${dupUid}`).remove();
                mergeCount++;
                console.log(`Merged ${dupUid} → ${canonicalId} (${email})`);
            }
        }

        btn.textContent = mergeCount > 0 ? `✓ מוזגו ${mergeCount} כפולים` : '✓ אין כפולים';
        btn.style.background = '#38a169';
        btn.style.color = '#fff';
        setTimeout(loadAdminUsers, 1500);
    } catch (err) {
        console.error('Merge error:', err);
        btn.textContent = '❌ שגיאה';
        btn.disabled = false;
        alert('שגיאה במיזוג: ' + err.message);
    }
}

// ============================================================
// ADMIN: GROUPS MANAGEMENT
// ============================================================

function loadAdminGroups() {
    if (!db) {
        $('admin-groups-container').innerHTML = '<p class="state-msg">Firebase לא מחובר</p>';
        return;
    }
    Promise.all([
        ref('groups').once('value'),
        ref('users').once('value'),
    ]).then(([gSnap, uSnap]) => {
        renderAdminGroups(gSnap.val() || {}, uSnap.val() || {});
    }).catch(err => {
        console.error('Failed to load groups:', err);
        $('admin-groups-container').innerHTML =
            '<p class="state-msg" style="color:#e53e3e">Error loading groups.</p>';
    });
}

function renderAdminGroups(groupsData, usersData) {
    const container = $('admin-groups-container');
    const list = Object.entries(groupsData).sort((a, b) =>
        (a[1].name || '').localeCompare(b[1].name || '')
    );

    if (list.length === 0) {
        container.innerHTML = `<p class="state-msg">${t('admin.noGroupsYet')}</p>`;
        return;
    }

    let html = '';
    list.forEach(([gid, g]) => {
        const owner = usersData[g.ownerId];
        const ownerName = owner ? owner.name : '—';
        const memberCount = Object.keys(g.members || {}).length;
        const logo = g.logoUrl
            ? `<img class="group-logo group-logo-sm" src="${escapeHtml(g.logoUrl)}" alt="">`
            : `<span class="group-logo group-logo-sm group-logo-placeholder">${escapeHtml((g.name || '?').charAt(0))}</span>`;
        html += `
        <div class="admin-match-row" id="admin-group-row-${gid}">
            <div class="admin-match-info">
                <div class="admin-match-teams">${logo}${escapeHtml(g.name)}</div>
                <div class="admin-match-meta">
                    ${t('admin.groupOwner')}: ${escapeHtml(ownerName)} ·
                    ${t('admin.groupCode')}: <code>${escapeHtml(g.inviteCode || '')}</code> ·
                    ${memberCount} ${t('admin.groupsMembers')}
                </div>
            </div>
            <div class="admin-match-actions">
                <button class="btn btn-danger btn-sm" onclick="adminDeleteGroup('${gid}', '${escapeHtml(g.name).replace(/'/g, "\\'")}')">${t('common.delete')}</button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

async function adminDeleteGroup(gid, groupName) {
    if (!confirm(t('admin.deleteGroupConfirm', groupName))) return;
    if (!db) return;

    const gSnap = await ref(`groups/${gid}`).once('value');
    const g = gSnap.val();
    if (!g) return;
    const memberIds = Object.keys(g.members || {});

    const updates = {};
    updates[`groups/${gid}`] = null;
    updates[`bets/${gid}`] = null;
    updates[`specialBets/${gid}`] = null;
    if (g.inviteCode) updates[`inviteCodes/${g.inviteCode}`] = null;
    for (const uid of memberIds) {
        updates[`userGroups/${uid}/${gid}`] = null;
    }
    await db.ref(activeTournament).update(updates);
    loadAdminGroups();
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
    const scorers = getSortedScorerCandidates();

    const winnerSel = $('admin-final-winner');
    const scorerSel = $('admin-final-scorer');
    winnerSel.innerHTML = `<option value="">${t('admin.finalWinnerPlaceholder')}</option>` +
        teams.map(x => `<option value="${escapeHtml(x)}" ${ts.winner === x ? 'selected' : ''}>${escapeHtml(translateTeam(x))}</option>`).join('');
    scorerSel.innerHTML = `<option value="">${t('admin.finalScorerPlaceholder')}</option>` +
        scorers.map(x => `<option value="${escapeHtml(x)}" ${ts.topScorer === x ? 'selected' : ''}>${escapeHtml(x)}</option>`).join('');
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
    await db.ref(activeTournament).update(updates);
    await recalcTournamentPoints();
    alert(t('admin.tournamentSaved'));
}


// ============================================================
// SEED: WORLD CUP 2026 MATCHES
// ============================================================

const SEED_MATCHES = [
    { team1:'מקסיקו', team2:'דרום אפריקה', date:'2026-06-11T19:00', stage:'group', group:'A' },
    { team1:"קוריאה הדרומית", team2:"צ'כיה", date:'2026-06-12T02:00', stage:'group', group:'A' },
    { team1:'מקסיקו', team2:'קוריאה הדרומית', date:'2026-06-19T01:00', stage:'group', group:'A' },
    { team1:'דרום אפריקה', team2:"צ'כיה", date:'2026-06-18T16:00', stage:'group', group:'A' },
    { team1:'מקסיקו', team2:"צ'כיה", date:'2026-06-25T01:00', stage:'group', group:'A' },
    { team1:'דרום אפריקה', team2:'קוריאה הדרומית', date:'2026-06-25T01:00', stage:'group', group:'A' },
    { team1:'קנדה', team2:'בוסניה והרצגובינה', date:'2026-06-12T19:00', stage:'group', group:'B' },
    { team1:'שווייץ', team2:'קטאר', date:'2026-06-12T22:00', stage:'group', group:'B' },
    { team1:'קנדה', team2:'קטאר', date:'2026-06-18T22:00', stage:'group', group:'B' },
    { team1:'שווייץ', team2:'בוסניה והרצגובינה', date:'2026-06-18T19:00', stage:'group', group:'B' },
    { team1:'שווייץ', team2:'קנדה', date:'2026-06-25T19:00', stage:'group', group:'B' },
    { team1:'בוסניה והרצגובינה', team2:'קטאר', date:'2026-06-25T19:00', stage:'group', group:'B' },
    { team1:'ברזיל', team2:'מרוקו', date:'2026-06-13T22:00', stage:'group', group:'C' },
    { team1:'האיטי', team2:'סקוטלנד', date:'2026-06-14T01:00', stage:'group', group:'C' },
    { team1:'סקוטלנד', team2:'מרוקו', date:'2026-06-19T22:00', stage:'group', group:'C' },
    { team1:'ברזיל', team2:'האיטי', date:'2026-06-20T01:00', stage:'group', group:'C' },
    { team1:'סקוטלנד', team2:'ברזיל', date:'2026-06-24T22:00', stage:'group', group:'C' },
    { team1:'מרוקו', team2:'האיטי', date:'2026-06-24T22:00', stage:'group', group:'C' },
    { team1:'ארצות הברית', team2:'פרגוואי', date:'2026-06-13T01:00', stage:'group', group:'D' },
    { team1:'אוסטרליה', team2:'טורקיה', date:'2026-06-13T04:00', stage:'group', group:'D' },
    { team1:'ארצות הברית', team2:'אוסטרליה', date:'2026-06-19T19:00', stage:'group', group:'D' },
    { team1:'טורקיה', team2:'פרגוואי', date:'2026-06-20T04:00', stage:'group', group:'D' },
    { team1:'טורקיה', team2:'ארצות הברית', date:'2026-06-26T02:00', stage:'group', group:'D' },
    { team1:'פרגוואי', team2:'אוסטרליה', date:'2026-06-26T02:00', stage:'group', group:'D' },
    { team1:'גרמניה', team2:'קוראסאו', date:'2026-06-14T17:00', stage:'group', group:'E' },
    { team1:"חוף השנהב", team2:'אקוודור', date:'2026-06-14T23:00', stage:'group', group:'E' },
    { team1:'גרמניה', team2:"חוף השנהב", date:'2026-06-20T20:00', stage:'group', group:'E' },
    { team1:'אקוודור', team2:'קוראסאו', date:'2026-06-21T00:00', stage:'group', group:'E' },
    { team1:'אקוודור', team2:'גרמניה', date:'2026-06-26T20:00', stage:'group', group:'E' },
    { team1:'קוראסאו', team2:"חוף השנהב", date:'2026-06-26T20:00', stage:'group', group:'E' },
    { team1:'הולנד', team2:'יפן', date:'2026-06-14T20:00', stage:'group', group:'F' },
    { team1:'שוודיה', team2:'תוניסיה', date:'2026-06-15T02:00', stage:'group', group:'F' },
    { team1:'הולנד', team2:'שוודיה', date:'2026-06-20T17:00', stage:'group', group:'F' },
    { team1:'תוניסיה', team2:'יפן', date:'2026-06-21T04:00', stage:'group', group:'F' },
    { team1:'הולנד', team2:'תוניסיה', date:'2026-06-27T00:00', stage:'group', group:'F' },
    { team1:'שוודיה', team2:'יפן', date:'2026-06-27T00:00', stage:'group', group:'F' },
    { team1:'בלגיה', team2:'מצרים', date:'2026-06-15T22:00', stage:'group', group:'G' },
    { team1:'איראן', team2:'ניו זילנד', date:'2026-06-16T04:00', stage:'group', group:'G' },
    { team1:'בלגיה', team2:'איראן', date:'2026-06-21T19:00', stage:'group', group:'G' },
    { team1:'ניו זילנד', team2:'מצרים', date:'2026-06-22T01:00', stage:'group', group:'G' },
    { team1:'בלגיה', team2:'ניו זילנד', date:'2026-06-27T02:00', stage:'group', group:'G' },
    { team1:'מצרים', team2:'איראן', date:'2026-06-27T02:00', stage:'group', group:'G' },
    { team1:'ספרד', team2:'קאבו ורדה', date:'2026-06-15T17:00', stage:'group', group:'H' },
    { team1:'ערב הסעודית', team2:'אורוגוואי', date:'2026-06-15T22:00', stage:'group', group:'H' },
    { team1:'ספרד', team2:'ערב הסעודית', date:'2026-06-21T16:00', stage:'group', group:'H' },
    { team1:'אורוגוואי', team2:'קאבו ורדה', date:'2026-06-21T22:00', stage:'group', group:'H' },
    { team1:'ספרד', team2:'אורוגוואי', date:'2026-06-26T22:00', stage:'group', group:'H' },
    { team1:'קאבו ורדה', team2:'ערב הסעודית', date:'2026-06-26T22:00', stage:'group', group:'H' },
    { team1:'צרפת', team2:'סנגל', date:'2026-06-16T19:00', stage:'group', group:'I' },
    { team1:'עיראק', team2:'נורווגיה', date:'2026-06-16T22:00', stage:'group', group:'I' },
    { team1:'צרפת', team2:'עיראק', date:'2026-06-22T21:00', stage:'group', group:'I' },
    { team1:'נורווגיה', team2:'סנגל', date:'2026-06-23T00:00', stage:'group', group:'I' },
    { team1:'צרפת', team2:'נורווגיה', date:'2026-06-27T19:00', stage:'group', group:'I' },
    { team1:'סנגל', team2:'עיראק', date:'2026-06-27T19:00', stage:'group', group:'I' },
    { team1:'ארגנטינה', team2:"אלג'יריה", date:'2026-06-17T01:00', stage:'group', group:'J' },
    { team1:'אוסטריה', team2:'ירדן', date:'2026-06-17T04:00', stage:'group', group:'J' },
    { team1:'ארגנטינה', team2:'אוסטריה', date:'2026-06-21T17:00', stage:'group', group:'J' },
    { team1:"אלג'יריה", team2:'ירדן', date:'2026-06-21T23:00', stage:'group', group:'J' },
    { team1:'ארגנטינה', team2:'ירדן', date:'2026-06-27T22:00', stage:'group', group:'J' },
    { team1:"אלג'יריה", team2:'אוסטריה', date:'2026-06-27T22:00', stage:'group', group:'J' },
    { team1:'פורטוגל', team2:"קונגו DR", date:'2026-06-17T17:00', stage:'group', group:'K' },
    { team1:'אוזבקיסטן', team2:'קולומביה', date:'2026-06-18T02:00', stage:'group', group:'K' },
    { team1:'פורטוגל', team2:'אוזבקיסטן', date:'2026-06-23T17:00', stage:'group', group:'K' },
    { team1:'קולומביה', team2:"קונגו DR", date:'2026-06-23T20:00', stage:'group', group:'K' },
    { team1:'פורטוגל', team2:'קולומביה', date:'2026-06-28T01:00', stage:'group', group:'K' },
    { team1:'אוזבקיסטן', team2:"קונגו DR", date:'2026-06-28T01:00', stage:'group', group:'K' },
    { team1:'אנגליה', team2:'קרואטיה', date:'2026-06-17T20:00', stage:'group', group:'L' },
    { team1:'גאנה', team2:'פנמה', date:'2026-06-17T23:00', stage:'group', group:'L' },
    { team1:'אנגליה', team2:'גאנה', date:'2026-06-23T22:00', stage:'group', group:'L' },
    { team1:'קרואטיה', team2:'פנמה', date:'2026-06-24T01:00', stage:'group', group:'L' },
    { team1:'אנגליה', team2:'פנמה', date:'2026-06-28T04:00', stage:'group', group:'L' },
    { team1:'קרואטיה', team2:'גאנה', date:'2026-06-28T04:00', stage:'group', group:'L' },
    { team1:'TBD', team2:'TBD', date:'2026-07-18T22:00', stage:'3rd', group: null },
];

function seedMatchKey(m) {
    const raw = `${m.stage}_${m.group || '-'}_${m.date}_${m.team1}_vs_${m.team2}`;
    return raw.replace(/[.#$\[\]\/']/g, '_');
}

async function adminSeedMatches() {
    if (!db) { alert('Firebase לא מחובר'); return; }

    const snap = await ref('matches').once('value');
    const existing = snap.val() || {};
    const existingKeys = new Set(Object.keys(existing));

    let added = 0, skipped = 0;
    for (const m of SEED_MATCHES) {
        const key = seedMatchKey(m);
        if (existingKeys.has(key)) { skipped++; continue; }
        await ref(`matches/${key}`).set({ ...m, status: 'upcoming', result: null, tournament: activeTournament });
        added++;
    }

    alert(`נטענו ${added} משחקים חדשים ✅\n${skipped} משחקים קיימים נשמרו ללא שינוי (כולל תוצאות).\n\nמשחקי שלב הנוקאאוט יתווספו לאחר שתוצאות הבתים ייקבעו.`);
}

async function adminFixMisplacedWCMatches() {
    if (!db) { alert('Firebase לא מחובר'); return; }
    if (!confirm('פעולה זו תעביר משחקי מונדיאל שנטענו בטעות לנתיב ליגת האלופות — חזרה לנתיב הנכון.\nלהמשיך?')) return;

    const wcKeys = new Set(SEED_MATCHES.map(m => seedMatchKey(m)));
    const uclSnap = await db.ref('ucl2025/matches').once('value');
    const uclMatches = uclSnap.val() || {};

    let moved = 0;
    for (const [key, m] of Object.entries(uclMatches)) {
        if (!wcKeys.has(key)) continue;
        await db.ref(`worldcup2026/matches/${key}`).set({ ...m, tournament: 'worldcup2026' });
        await db.ref(`ucl2025/matches/${key}`).remove();
        moved++;
    }

    alert(`הועברו ${moved} משחקי מונדיאל לנתיב הנכון ✅`);
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
    const active = currentGroupId && userGroups[currentGroupId];
    $('active-group-name').textContent = active ? active.name : t('appBar.noGroup');
    const hdrLogo = $('active-group-logo');
    if (hdrLogo) {
        if (active && active.logoUrl) {
            hdrLogo.src = active.logoUrl;
            hdrLogo.classList.remove('hidden');
        } else {
            hdrLogo.removeAttribute('src');
            hdrLogo.classList.add('hidden');
        }
    }

    const settingsBtn = $('btn-open-group-settings');
    if (settingsBtn) {
        if (active) settingsBtn.classList.remove('hidden');
        else settingsBtn.classList.add('hidden');
    }
    const shareActiveBtn = $('btn-share-active-group');
    if (shareActiveBtn) {
        if (active) shareActiveBtn.classList.remove('hidden');
        else shareActiveBtn.classList.add('hidden');
    }

    const list = $('group-switch-list');
    if (!list) return;
    const entries = Object.entries(userGroups);
    if (entries.length === 0) {
        list.innerHTML = `<p style="padding:10px;color:var(--text-light);font-size:.85rem">${t('groupSwitch.emptyMsg')}</p>`;
        return;
    }
    list.innerHTML = entries.map(([gid, g]) => {
        const isActive = gid === currentGroupId;
        const logo = g.logoUrl
            ? `<img class="group-logo group-logo-sm" src="${escapeHtml(g.logoUrl)}" alt="">`
            : `<span class="group-logo group-logo-sm group-logo-placeholder">${escapeHtml((g.name || '?').charAt(0))}</span>`;
        return `<div class="group-switch-row ${isActive ? 'active' : ''}">
            <button class="group-switch-item" data-group-id="${gid}">
                ${logo}
                <span>${escapeHtml(g.name)}</span>
                ${isActive ? '<span class="check-mark">✓</span>' : ''}
            </button>
            <button class="group-share-btn" data-share-group-id="${gid}" title="${t('groupSwitch.share')}" aria-label="${t('groupSwitch.share')}">🔗</button>
        </div>`;
    }).join('');

    list.querySelectorAll('.group-switch-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const gid = btn.dataset.groupId;
            toggleGroupSwitchMenu(false);
            if (gid !== currentGroupId) switchActiveGroup(gid);
        });
    });
    list.querySelectorAll('.group-share-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            shareGroupLink(btn.dataset.shareGroupId);
        });
    });
}

function buildGroupJoinUrl(code) {
    return `${location.origin}${location.pathname}?join=${encodeURIComponent(code)}`;
}

async function shareGroupLink(gid) {
    const g = userGroups[gid];
    if (!g || !g.inviteCode) return;
    const url = buildGroupJoinUrl(g.inviteCode);
    const title = t('groupSwitch.shareTitle', g.name);
    const text = t('groupSwitch.shareText', g.name, g.inviteCode);

    if (navigator.share) {
        try {
            await navigator.share({ title, text, url });
            return;
        } catch (err) {
            if (err && err.name === 'AbortError') return;
        }
    }

    const payload = `${text}\n${url}`;
    try {
        await navigator.clipboard.writeText(payload);
        alert(t('groupSwitch.shareCopied'));
    } catch {
        prompt(t('groupSwitch.shareCopyPrompt'), payload);
    }
}

function switchActiveGroup(groupId) {
    if (!groupId || groupId === currentGroupId) return;
    stopGroupListeners();
    groupMembers = {};
    userBets = {};
    enterAppForGroup(groupId);
}

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
        updates[`groups/${groupId}/members/${currentUser.userId}`] = { joinedAt: now, totalPoints: 0, name: currentUser.name };
        updates[`inviteCodes/${code}`] = groupId;
        updates[`userGroups/${currentUser.userId}/${groupId}`] = true;

        await db.ref(activeTournament).update(updates);

        $('created-invite-code').textContent = code;
        showEl($('create-group-success'));
        hideEl($('btn-confirm-create-group'));

        userGroups[groupId] = { name, ownerId: currentUser.userId, inviteCode: code };
        currentGroupId = groupId;
        localStorage.setItem('wc2026_activeGroup', groupId);

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
    if (currentUser && currentGroupId && $('group-picker-screen') && !$('group-picker-screen').classList.contains('hidden')) {
        enterAppForGroup(currentGroupId);
    } else if (currentGroupId) {
        renderGroupSwitcher();
    }
}

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
        updates[`groups/${groupId}/members/${currentUser.userId}`] = { joinedAt: now, totalPoints: 0, name: currentUser.name };
        updates[`userGroups/${currentUser.userId}/${groupId}`] = true;
        await db.ref(activeTournament).update(updates);

        hide('join-group-modal');
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

async function openGroupSettingsModal() {
    if (!currentGroupId || !userGroups[currentGroupId]) return;
    const g = userGroups[currentGroupId];
    const isOwner = g.ownerId === currentUser.userId;

    $('group-settings-name').value = g.name;
    $('settings-invite-code').textContent = g.inviteCode;
    hideEl($('group-settings-error'));

    const logoImg = $('group-settings-logo');
    const logoPlaceholder = $('group-settings-logo-placeholder');
    if (g.logoUrl) {
        logoImg.src = g.logoUrl;
        logoImg.classList.remove('hidden');
        logoPlaceholder.classList.add('hidden');
    } else {
        logoImg.removeAttribute('src');
        logoImg.classList.add('hidden');
        logoPlaceholder.textContent = (g.name || '?').charAt(0);
        logoPlaceholder.classList.remove('hidden');
    }

    $('btn-rename-group').style.display = isOwner ? '' : 'none';
    $('group-settings-name').readOnly = !isOwner;
    $('group-logo-controls').style.display = isOwner ? '' : 'none';
    $('btn-remove-logo').style.display = (isOwner && g.logoUrl) ? '' : 'none';
    $('group-logo-input').value = '';
    if (isOwner) $('btn-delete-group').classList.remove('hidden');
    else $('btn-delete-group').classList.add('hidden');

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
    await db.ref(activeTournament).update(updates);
    openGroupSettingsModal();
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
    await db.ref(activeTournament).update(updates);
    hide('group-settings-modal');
}

async function deleteGroup() {
    if (!currentGroupId || !db || !currentUser) return;
    const g = userGroups[currentGroupId];
    if (!g || g.ownerId !== currentUser.userId) return;
    if (!confirm(t('groupSettings.deleteConfirm', g.name))) return;

    const gid = currentGroupId;
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
    await db.ref(activeTournament).update(updates);
    hide('group-settings-modal');
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
    const shareActiveBtn = $('btn-share-active-group');
    if (shareActiveBtn) {
        shareActiveBtn.addEventListener('click', () => {
            toggleGroupSwitchMenu(false);
            if (currentGroupId) shareGroupLink(currentGroupId);
        });
    }
    const openRulesBtn = $('btn-open-rules');
    if (openRulesBtn) {
        openRulesBtn.addEventListener('click', () => {
            const body = $('rules-body');
            if (body) body.innerHTML = t('rules.html');
            $('rules-modal').classList.remove('hidden');
        });
    }
    const closeRulesBtn = $('btn-close-rules');
    if (closeRulesBtn) {
        closeRulesBtn.addEventListener('click', () => {
            $('rules-modal').classList.add('hidden');
        });
    }

    $('btn-picker-create').addEventListener('click', openCreateGroupModal);
    $('btn-picker-join').addEventListener('click', openJoinGroupModal);
    $('btn-picker-logout').addEventListener('click', handleLogout);

    $('btn-confirm-create-group').addEventListener('click', confirmCreateGroup);
    $('btn-cancel-create-group').addEventListener('click', closeCreateGroupModal);
    $('btn-copy-invite').addEventListener('click', (e) => {
        copyToClipboard($('created-invite-code').textContent, e.currentTarget);
    });

    $('btn-confirm-join-group').addEventListener('click', confirmJoinGroup);
    $('btn-cancel-join-group').addEventListener('click', () => hide('join-group-modal'));
    $('join-group-code').addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    });

    $('btn-rename-group').addEventListener('click', renameGroup);
    $('btn-close-group-settings').addEventListener('click', () => hide('group-settings-modal'));
    $('btn-leave-group').addEventListener('click', leaveGroup);
    $('btn-delete-group').addEventListener('click', deleteGroup);
    $('btn-copy-settings-invite').addEventListener('click', (e) => {
        copyToClipboard($('settings-invite-code').textContent, e.currentTarget);
    });
    $('btn-share-group').addEventListener('click', () => {
        if (currentGroupId) shareGroupLink(currentGroupId);
    });
    $('group-logo-input').addEventListener('change', handleGroupLogoUpload);
    $('btn-remove-logo').addEventListener('click', removeGroupLogo);
}

// ---- Group logo upload ----

const LOGO_MAX_SIDE = 256;
const LOGO_MAX_BYTES = 120 * 1024;

function resizeImageToDataUrl(file, maxSide) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                let q = 0.9;
                let url = canvas.toDataURL('image/jpeg', q);
                while (url.length > LOGO_MAX_BYTES && q > 0.4) {
                    q -= 0.1;
                    url = canvas.toDataURL('image/jpeg', q);
                }
                resolve(url);
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

async function handleGroupLogoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !currentGroupId || !db || !currentUser) return;
    const g = userGroups[currentGroupId];
    if (!g || g.ownerId !== currentUser.userId) return;
    const errEl = $('group-settings-error');
    hideEl(errEl);

    if (!file.type.startsWith('image/')) {
        errEl.textContent = t('groupSettings.logoNotImage');
        showEl(errEl);
        return;
    }
    try {
        const dataUrl = await resizeImageToDataUrl(file, LOGO_MAX_SIDE);
        await ref(`groups/${currentGroupId}/logoUrl`).set(dataUrl);
        g.logoUrl = dataUrl;
        openGroupSettingsModal();
        renderGroupSwitcher();
    } catch (err) {
        console.error(err);
        errEl.textContent = t('groupSettings.logoError');
        showEl(errEl);
    }
}

async function removeGroupLogo() {
    if (!currentGroupId || !db || !currentUser) return;
    const g = userGroups[currentGroupId];
    if (!g || g.ownerId !== currentUser.userId) return;
    await ref(`groups/${currentGroupId}/logoUrl`).remove();
    g.logoUrl = null;
    openGroupSettingsModal();
    renderGroupSwitcher();
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
