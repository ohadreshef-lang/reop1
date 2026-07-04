// Tests for pure-logic helpers in app.js.
//
// app.js is a classic-script browser file (no exports), so we load it into a
// vm sandbox with stubs for the browser/Firebase globals it touches at the
// top level. The functions we exercise don't need the DOM or the database —
// only scoring, id-hashing, date parsing, and string helpers.
//
// Run:  node --test tests/

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const appSource = readFileSync(join(__dirname, '..', 'app.js'), 'utf8');

function loadApp() {
    const sandbox = {
        document: {
            addEventListener: () => {},
            querySelectorAll: () => [],
            getElementById: () => null,
        },
        setInterval: () => 0,
        clearInterval: () => {},
        window: { location: { search: '', pathname: '/' } },
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        firebase: undefined,
        db: null,
        t: (key) => key,
        translateTeam: (name) => name,
        currentLang: 'he',
        console,
        URLSearchParams,
        Date,
        Math,
        Object,
        Array,
        JSON,
        String,
        Number,
        Boolean,
        RegExp,
        Promise,
        Error,
        isNaN,
        parseInt,
        parseFloat,
    };
    vm.createContext(sandbox);
    vm.runInContext(appSource, sandbox);
    return sandbox;
}

const app = loadApp();

// --- getOutcome ------------------------------------------------------------

test('getOutcome: team1 wins', () => {
    assert.equal(app.getOutcome(3, 1), 'win1');
    assert.equal(app.getOutcome(1, 0), 'win1');
});

test('getOutcome: team2 wins', () => {
    assert.equal(app.getOutcome(0, 2), 'win2');
    assert.equal(app.getOutcome(1, 5), 'win2');
});

test('getOutcome: draw', () => {
    assert.equal(app.getOutcome(0, 0), 'draw');
    assert.equal(app.getOutcome(2, 2), 'draw');
});

// --- calcPoints ------------------------------------------------------------

test('calcPoints (group): exact=4', () => {
    assert.equal(app.calcPoints(2, 1, 2, 1, 'group'), 4);
    assert.equal(app.calcPoints(0, 0, 0, 0, 'group'), 4);
    assert.equal(app.calcPoints(2, 1, 2, 1), 4);          // missing stage -> group
});

test('calcPoints (group): correct direction but wrong score = 1', () => {
    assert.equal(app.calcPoints(2, 1, 3, 0, 'group'), 1);
    assert.equal(app.calcPoints(0, 2, 1, 4, 'group'), 1);
    assert.equal(app.calcPoints(1, 1, 2, 2, 'group'), 1);
});

test('calcPoints (group): wrong = 0', () => {
    assert.equal(app.calcPoints(2, 1, 1, 2, 'group'), 0);
    assert.equal(app.calcPoints(0, 0, 1, 0, 'group'), 0);
});

test('calcPoints (knockout): exact=5, exact 5+ goals=7, direction=2, miss=0', () => {
    assert.equal(app.calcPoints(2, 1, 2, 1, 'R32'), 5);
    assert.equal(app.calcPoints(0, 0, 0, 0, 'Final'), 5);
    assert.equal(app.calcPoints(3, 2, 3, 2, 'QF'), 7);
    assert.equal(app.calcPoints(4, 1, 4, 1, 'R16'), 7);
    assert.equal(app.calcPoints(2, 1, 3, 0, 'SF'), 2);
    assert.equal(app.calcPoints(2, 1, 1, 2, '3rd'), 0);
});

test('isKnockoutStage: group/special/undefined=false, knockout=true', () => {
    assert.equal(app.isKnockoutStage('group'), false);
    assert.equal(app.isKnockoutStage('special'), false);
    assert.equal(app.isKnockoutStage(undefined), false);
    assert.equal(app.isKnockoutStage('R32'), true);
    assert.equal(app.isKnockoutStage('Final'), true);
});

// --- emailToId -------------------------------------------------------------

test('emailToId: lowercases and replaces dot', () => {
    assert.equal(app.emailToId('Foo@Bar.COM'), 'foo@bar_com');
});

test('emailToId: replaces all Firebase-reserved chars', () => {
    // `.` `#` `$` `[` `]` `/` are all illegal in RTDB keys
    assert.equal(app.emailToId('a.b#c$d[e]f/g@x.y'), 'a_b_c_d_e_f_g@x_y');
});

test('emailToId: stable for already-clean emails', () => {
    assert.equal(app.emailToId('plain@example_com'), 'plain@example_com');
});

test('emailToId matches real prod IDs', () => {
    // Confirms round-trip with the format used in the live DB.
    assert.equal(app.emailToId('shay.t@helloflare.com'), 'shay_t@helloflare_com');
    assert.equal(app.emailToId('ohad.reshef@gmail.com'), 'ohad_reshef@gmail_com');
});

// --- isPaul ----------------------------------------------------------------

test('isPaul: true only for the octopus id', () => {
    assert.equal(app.isPaul('paul-octopus'), true);
    assert.equal(app.isPaul('shay_t@helloflare_com'), false);
    assert.equal(app.isPaul(''), false);
});

// --- memberLabel -----------------------------------------------------------

test('memberLabel: Paul gets octopus icon + i18n name', () => {
    const paul = app.memberLabel('paul-octopus', 'ignored-fallback');
    assert.match(paul, /octo-icon/);
    assert.match(paul, /🐙/);
    assert.match(paul, /paul\.name/); // t() stub returns the key
});

test('memberLabel: other members get their escaped name', () => {
    assert.equal(app.memberLabel('u1', 'Tom & Jerry'), 'Tom &amp; Jerry');
});

// --- parseMatchDate (Israeli-time gotcha) ---------------------------------

test('parseMatchDate: treats naive string as UTC', () => {
    // "2026-06-11T19:00" parsed as UTC == "2026-06-11T19:00:00Z"
    const d = app.parseMatchDate('2026-06-11T19:00');
    assert.equal(d.toISOString(), '2026-06-11T19:00:00.000Z');
});

test('parseMatchDate: empty string returns epoch', () => {
    assert.equal(app.parseMatchDate('').getTime(), 0);
    assert.equal(app.parseMatchDate(null).getTime(), 0);
    assert.equal(app.parseMatchDate(undefined).getTime(), 0);
});

test('parseMatchDate: does NOT drift with host timezone', () => {
    const d = app.parseMatchDate('2026-06-11T19:00');
    assert.equal(d.getUTCHours(), 19, 'naive string is UTC');
});

// --- matchIsLocked ---------------------------------------------------------

test('matchIsLocked: match starting in 2 hours is not locked', () => {
    const in2hours = new Date(Date.now() + 2*60*60*1000).toISOString().slice(0,16);
    assert.equal(app.matchIsLocked({ date: in2hours }), false);
});

test('matchIsLocked: match starting in 30 minutes is NOT locked (5-min lock)', () => {
    const in30 = new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16);
    assert.equal(app.matchIsLocked({ date: in30 }), false);
});

test('matchIsLocked: match starting in 2 minutes IS locked (5-min lock)', () => {
    const in2 = new Date(Date.now() + 2 * 60 * 1000).toISOString().slice(0, 16);
    assert.equal(app.matchIsLocked({ date: in2 }), true);
});

test('matchIsLocked: past match is locked', () => {
    assert.equal(app.matchIsLocked({ date: '2020-01-01T12:00' }), true);
});

// --- generateInviteCode ----------------------------------------------------

test('generateInviteCode: 6 chars long', () => {
    for (let i = 0; i < 50; i++) {
        assert.equal(app.generateInviteCode().length, 6);
    }
});

test('generateInviteCode: uses only the safe alphabet (no 0/O/1/I/L)', () => {
    const safe = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
    for (let i = 0; i < 200; i++) {
        const code = app.generateInviteCode();
        assert.match(code, safe, `invalid char in ${code}`);
    }
});

// --- escapeHtml ------------------------------------------------------------

test('escapeHtml: escapes angle brackets and quotes', () => {
    assert.equal(
        app.escapeHtml('<script>alert("x")</script>'),
        '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
});

test('escapeHtml: escapes ampersand first to avoid double-escaping', () => {
    assert.equal(app.escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
    assert.equal(app.escapeHtml('&lt;'), '&amp;lt;');
});

test('escapeHtml: falsy input returns empty string', () => {
    assert.equal(app.escapeHtml(''), '');
    assert.equal(app.escapeHtml(null), '');
    assert.equal(app.escapeHtml(undefined), '');
});

// --- getFlag ---------------------------------------------------------------

test('getFlag: returns mapped flag for known team', () => {
    assert.equal(app.getFlag('ברזיל'), '🇧🇷');
    assert.equal(app.getFlag('ארגנטינה'), '🇦🇷');
    assert.equal(app.getFlag("צ'כיה"), '🇨🇿');
});

test('getFlag: falls back to white flag for unknown team', () => {
    assert.equal(app.getFlag('Atlantis'), '🏳️');
    assert.equal(app.getFlag(''), '🏳️');
});

// --- Participating-teams sanity -------------------------------------------
// Note: PARTICIPATING_TEAMS and TEAM_FLAGS are `const` and don't leak onto
// the vm sandbox, so we probe them via the exposed helpers instead.

test('getSortedParticipatingTeams: returns all 48 WC 2026 teams', () => {
    assert.equal(app.getSortedParticipatingTeams().length, 48);
});

test('every participating team has a flag (not the fallback)', () => {
    const teams = app.getSortedParticipatingTeams();
    const missing = teams.filter(name => app.getFlag(name) === '🏳️');
    // Cross-realm arrays fail deepStrictEqual even when empty, so use length.
    assert.equal(missing.length, 0, `teams without flags: ${missing.join(', ')}`);
});

// --- isInLiveTab -----------------------------------------------------------
// A game is in the Live tab when its bets are locked (<=5 min to kickoff) and it
// is not "long finished" (kept >=1h after it ends). Dates are UTC-naive, so build
// the string straight from a UTC instant (no timezone offset).
function utcString(msFromNow) {
    return new Date(Date.now() + msFromNow).toISOString().slice(0, 16);
}

test('isInLiveTab: locked (2 min to kickoff), not started -> true', () => {
    assert.equal(app.isInLiveTab({ date: utcString(2 * 60 * 1000) }, Date.now()), true);
});
test('isInLiveTab: open betting (30 min out) -> false', () => {
    assert.equal(app.isInLiveTab({ date: utcString(30 * 60 * 1000) }, Date.now()), false);
});
test('isInLiveTab: finished 30 min ago (finishedAt) -> true', () => {
    const now = Date.now();
    assert.equal(app.isInLiveTab({ date: '2020-01-01T12:00', result: { team1Goals:1, team2Goals:0 }, finishedAt: now - 30*60*1000 }, now), true);
});
test('isInLiveTab: finished 90 min ago (finishedAt) -> false', () => {
    const now = Date.now();
    assert.equal(app.isInLiveTab({ date: '2020-01-01T12:00', result: { team1Goals:1, team2Goals:0 }, finishedAt: now - 90*60*1000 }, now), false);
});
test('isInLiveTab: finished result, no finishedAt, kickoff long ago -> false (fallback kickoff+2h+1h)', () => {
    assert.equal(app.isInLiveTab({ date: '2020-01-01T12:00', result: { team1Goals:1, team2Goals:0 } }, Date.now()), false);
});

// --- scorerLine ------------------------------------------------------------

test('scorerLine: goal shows minute + escaped name, no mark', () => {
    const html = app.scorerLine({ team: 1, player: 'Brobbey', minute: 5, extra: null, kind: 'goal' });
    assert.match(html, /⚽/);
    assert.match(html, /5'/);
    assert.match(html, /Brobbey/);
    assert.doesNotMatch(html, /penaltyMark|ownGoalMark/);
});

test('scorerLine: stoppage minute formatted as N+M', () => {
    assert.match(app.scorerLine({ team: 1, player: 'X', minute: 45, extra: 2, kind: 'goal' }), /45\+2'/);
});

test('scorerLine: penalty and own-goal marks via i18n', () => {
    assert.match(app.scorerLine({ team: 1, player: 'X', minute: 60, extra: null, kind: 'pen' }), /live\.penaltyMark/);
    assert.match(app.scorerLine({ team: 2, player: 'Y', minute: 80, extra: null, kind: 'og' }), /live\.ownGoalMark/);
});

test('scorerLine: escapes player name', () => {
    assert.match(app.scorerLine({ team: 1, player: 'A & B', minute: 1, extra: null, kind: 'goal' }), /A &amp; B/);
});

// --- computeLiveMinute (now, kickoffMs, elapsed, extra, upd, status) -------
test('computeLiveMinute: ticks from API minute + elapsed since update', () => {
    const now = 1_000_000_000_000;
    assert.equal(app.computeLiveMinute(now, now - 50*60000, 50, null, now - 2*60000, 'IN_PLAY'), "52'");
});
test('computeLiveMinute: stoppage shown as 90+N (ticks the extra)', () => {
    const now = 1_000_000_000_000;
    assert.equal(app.computeLiveMinute(now, now - 95*60000, 90, 3, now - 1*60000, 'IN_PLAY'), "90+4'");
});
test('computeLiveMinute: halftime and FT show nothing (badge says it)', () => {
    assert.equal(app.computeLiveMinute(Date.now(), Date.now(), 45, 2, Date.now(), 'PAUSED'), '');
    assert.equal(app.computeLiveMinute(Date.now(), Date.now(), null, null, null, 'FT'), '');
});
test('computeLiveMinute: estimates from kickoff when no API minute', () => {
    const now = 1_000_000_000_000;
    assert.equal(app.computeLiveMinute(now, now - 10*60000, null, null, null, 'IN_PLAY'), "10'");
});
test('computeLiveMinute: estimate caps at 90+', () => {
    const now = 1_000_000_000_000;
    assert.equal(app.computeLiveMinute(now, now - 200*60000, null, null, null, 'IN_PLAY'), "90+'");
});

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

// --- projectLiveStandings (accumulate across concurrent live games) --------

test('projectLiveStandings: two in-play games accumulate per member', () => {
    const now = Date.parse('2026-06-24T20:30:00Z');
    const games = [
        { id: 'g1', date: '2026-06-24T20:00', live: { team1Goals: 1, team2Goals: 0 } },
        { id: 'g2', date: '2026-06-24T20:00', live: { team1Goals: 2, team2Goals: 1 } },
    ];
    const members = { u1: { totalPoints: 10, name: 'A' }, u2: { totalPoints: 20, name: 'B' } };
    const bets = {
        u1: { g1: { team1Goals: 1, team2Goals: 0 }, g2: { team1Goals: 2, team2Goals: 1 } }, // both exact → +4 +4
        u2: { g1: { team1Goals: 0, team2Goals: 0 }, g2: { team1Goals: 0, team2Goals: 0 } }, // both wrong → 0
    };
    const r = app.projectLiveStandings(games, members, bets, now);
    assert.equal(r.projectedTotal.u1, 18); // 10 + 8
    assert.equal(r.projectedTotal.u2, 20); // 20 + 0
    assert.deepEqual(r.orderedUids, ['u2', 'u1']); // 20 > 18
    assert.equal(r.oldPos.u2, 1);            // current standing by totalPoints
    assert.equal(r.oldPos.u1, 2);
});

test('projectLiveStandings: a member gaining in only one game adds only that game', () => {
    const now = Date.parse('2026-06-24T20:30:00Z');
    const games = [
        { id: 'g1', date: '2026-06-24T20:00', live: { team1Goals: 1, team2Goals: 0 } },
        { id: 'g2', date: '2026-06-24T20:00', live: { team1Goals: 2, team2Goals: 1 } },
    ];
    const members = { u3: { totalPoints: 5, name: 'C' } };
    const bets = { u3: { g1: { team1Goals: 1, team2Goals: 0 } } }; // exact g1 (+4); no g2 bet → 0–0 vs 2–1 → 0
    const r = app.projectLiveStandings(games, members, bets, now);
    assert.equal(r.projectedTotal.u3, 9); // 5 + 4
});

test('projectLiveStandings: a finalized game in the set contributes net 0 (no double-count)', () => {
    const now = Date.parse('2026-06-24T20:30:00Z');
    const games = [
        { id: 'gf', date: '2026-06-24T18:00', result: { team1Goals: 2, team2Goals: 0 } },          // finalized
        { id: 'gl', date: '2026-06-24T20:00', live: { team1Goals: 1, team2Goals: 0 } },             // in-play
    ];
    const members = { u1: { totalPoints: 14, name: 'A' } }; // 14 already includes gf's 4
    const bets = { u1: { gf: { team1Goals: 2, team2Goals: 0, points: 4 }, gl: { team1Goals: 1, team2Goals: 0 } } };
    const r = app.projectLiveStandings(games, members, bets, now);
    assert.equal(r.projectedTotal.u1, 18); // 14 + (gf net 0) + (gl +4)
});

test('projectLiveStandings: not-started game (null score) contributes nothing', () => {
    const now = Date.parse('2026-06-24T20:30:00Z');
    const games = [{ id: 'gns', date: '2026-06-24T23:00' }]; // future → no score
    const members = { u1: { totalPoints: 7, name: 'A' } };
    const bets = { u1: { gns: { team1Goals: 1, team2Goals: 1 } } };
    const r = app.projectLiveStandings(games, members, bets, now);
    assert.equal(r.projectedTotal.u1, 7);
});
