// Pure planning logic for the results updater. No network, DB, or process.env —
// everything is passed in, so it is unit-testable with mock data.

export const HEB_TO_EN = {
    'ארצות הברית': 'USA', 'קנדה': 'Canada', 'מקסיקו': 'Mexico',
    'ברזיל': 'Brazil', 'ארגנטינה': 'Argentina', 'אורוגוואי': 'Uruguay',
    'קולומביה': 'Colombia', 'אקוודור': 'Ecuador', 'ונצואלה': 'Venezuela',
    'פרגוואי': 'Paraguay', 'בוליביה': 'Bolivia', "צ'ילה": 'Chile',
    'צרפת': 'France', 'ספרד': 'Spain', 'גרמניה': 'Germany',
    'אנגליה': 'England', 'פורטוגל': 'Portugal', 'הולנד': 'Netherlands',
    'איטליה': 'Italy', 'בלגיה': 'Belgium', 'שווייץ': 'Switzerland',
    'קרואטיה': 'Croatia', 'סרביה': 'Serbia', 'דנמרק': 'Denmark',
    'אוסטריה': 'Austria', 'סקוטלנד': 'Scotland', 'טורקיה': 'Turkey',
    'רומניה': 'Romania', 'הונגריה': 'Hungary', 'פולין': 'Poland',
    'מרוקו': 'Morocco', 'סנגל': 'Senegal', 'ניגריה': 'Nigeria',
    'מצרים': 'Egypt', 'קמרון': 'Cameroon', 'חוף השנהב': 'Ivory Coast',
    "אלג'יריה": 'Algeria', 'תוניסיה': 'Tunisia', 'דרום אפריקה': 'South Africa',
    'יפן': 'Japan', 'קוריאה הדרומית': 'South Korea', 'איראן': 'Iran',
    'ערב הסעודית': 'Saudi Arabia', 'אוסטרליה': 'Australia', 'עיראק': 'Iraq',
    'ירדן': 'Jordan', 'אוזבקיסטן': 'Uzbekistan', 'ניו זילנד': 'New Zealand',
    'הונדורס': 'Honduras', 'פנמה': 'Panama', 'קוסטה ריקה': 'Costa Rica',
    "צ'כיה": 'Czechia', 'קטאר': 'Qatar', 'בוסניה והרצגובינה': 'Bosnia and Herzegovina',
    'האיטי': 'Haiti', 'קוראסאו': 'Curaçao', 'שוודיה': 'Sweden',
    'קאבו ורדה': 'Cape Verde', 'נורווגיה': 'Norway', 'קונגו DR': 'DR Congo', 'גאנה': 'Ghana',
};

export const API_ALIASES = {
    'bosnia-herzegovina': 'bosnia and herzegovina',
    'bosnia & herzegovina': 'bosnia and herzegovina',   // API-Football's live-feed form (ampersand)
    'cape verde islands': 'cape verde',
    'congo dr': 'dr congo',
    'united states': 'usa',
};

export function norm(name) {
    const n = (name || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/\s+/g, ' ').trim();
    return API_ALIASES[n] || n;
}

// English (football-data) -> Hebrew, keyed by norm() so API_ALIASES bridge spelling differences.
export const EN_TO_HEB = (() => {
    const m = {};
    for (const [he, en] of Object.entries(HEB_TO_EN)) m[norm(en)] = he;
    return m;
})();
export function resolveHebTeam(fdName) { return EN_TO_HEB[norm(fdName)] || null; }

const FD_STAGE = { LAST_32: 'R32', LAST_16: 'R16', QUARTER_FINALS: 'QF', SEMI_FINALS: 'SF',
                   THIRD_PLACE: '3rd', THIRD_PLACE_FINAL: '3rd', FINAL: 'Final' };
export function fdStageToOurs(fdStage) { return FD_STAGE[fdStage] || null; }

export function utcToNaive(utcDate) { return String(utcDate || '').slice(0, 16); }

// Mirrors app.js seedMatchKey (stage_group_date_t1_vs_t2, sanitized). group is '-' for knockout.
export function fixtureKey({ stage, team1, team2, date }) {
    return `${stage}_-_${date}_${team1}_vs_${team2}`.replace(/[.#$[\]/']/g, '_');
}

// Turn football-data matches into new knockout fixtures to insert. Add-only: dedups by
// normalized team-pair against existing matches (knockout pairings are unique), skips group/
// unknown stages, undetermined (unresolvable) teams, non-scheduled statuses, and out-of-window
// or long-past games.
export function mapScheduledFixtures({ fdMatches, existingMatches, now, windowEndMs }) {
    const pairKey = (a, b) => [a, b].sort().join('|');
    const existingPairs = new Set();
    for (const m of Object.values(existingMatches || {})) {
        if (m && m.team1 && m.team2) existingPairs.add(pairKey(m.team1, m.team2));
    }
    const SCHED = new Set(['SCHEDULED', 'TIMED']);
    const seen = new Set();
    const out = [];
    for (const fm of (fdMatches || [])) {
        if (!fm || !SCHED.has(fm.status)) continue;
        const stage = fdStageToOurs(fm.stage);
        if (!stage) continue;
        const t1 = resolveHebTeam(fm.homeTeam && fm.homeTeam.name);
        const t2 = resolveHebTeam(fm.awayTeam && fm.awayTeam.name);
        if (!t1 || !t2) continue;
        const pk = pairKey(t1, t2);
        if (existingPairs.has(pk) || seen.has(pk)) continue;
        const date = utcToNaive(fm.utcDate);
        const ms = Date.parse(`${date}Z`);
        if (!date || Number.isNaN(ms)) continue;
        if (ms < now - 6 * 3600 * 1000) continue;
        if (windowEndMs && ms > windowEndMs) continue;
        seen.add(pk);
        out.push({
            key: fixtureKey({ stage, team1: t1, team2: t2, date }),
            match: { team1: t1, team2: t2, date, stage, group: null, status: 'upcoming', result: null },
        });
    }
    return out;
}

export function parseMatchDate(dateStr) {
    // Naive strings are UTC (mirrors app.js `new Date(dateStr + 'Z')`). Returns ms.
    if (!dateStr) return 0;
    return Date.parse(`${dateStr}Z`);
}

export function getOutcome(g1, g2) {
    return g1 > g2 ? 'win1' : g1 < g2 ? 'win2' : 'draw';
}

// Knockout = any stage that isn't the group stage or the special (champion/top-scorer) bets.
export function isKnockoutStage(stage) {
    return stage != null && stage !== 'group' && stage !== 'special';
}

// Group: exact=4, direction=1, miss=0. Knockout (R32+): exact=5 (+2 if 5+ total goals), direction=2.
// Knockout games are scored on the 90-minute result (see classifyMatches regularTime sourcing).
export function calcPoints(b1, b2, r1, r2, stage) {
    const ko = isKnockoutStage(stage);
    if (b1 === r1 && b2 === r2) { if (ko) return (r1 + r2) >= 5 ? 7 : 5; return 4; }
    if (getOutcome(b1, b2) === getOutcome(r1, r2)) return ko ? 2 : 1;
    return 0;
}

// Split a finished knockout score into the 90-minute result (scored) and the after-extra-time
// result (display). g1/g2 are football-data's authoritative full-time total; ESPN scorers'
// minutes identify extra-time goals (minute > 90). Only splits for knockout games with ET goals
// when the goal count agrees with the total (high confidence); otherwise returns the total with
// no a.e.t. (group games, normal-time games, or ambiguous data like penalty shootouts).
export function splitKnockoutResult({ stage, g1, g2, scorers }) {
    const result = { team1Goals: g1, team2Goals: g2 };
    if (!isKnockoutStage(stage) || !Array.isArray(scorers)) return { result, resultAet: null };
    const et1 = scorers.filter(s => s && s.team === 1 && typeof s.minute === 'number' && s.minute > 90).length;
    const et2 = scorers.filter(s => s && s.team === 2 && typeof s.minute === 'number' && s.minute > 90).length;
    if (et1 + et2 === 0) return { result, resultAet: null };
    if (et1 > g1 || et2 > g2 || scorers.length !== g1 + g2) return { result, resultAet: null };
    return { result: { team1Goals: g1 - et1, team2Goals: g2 - et2 }, resultAet: { team1Goals: g1, team2Goals: g2 } };
}

// --- ESPN live source (in-play scores + goal events) ----------------------

// Parse an ESPN displayClock ("29'", "45'+2'") to {minute, extra}.
export function espnMinute(displayClock) {
    const s = String(displayClock || '').replace(/'/g, '').trim();
    if (!s) return { minute: null, extra: null };
    const [base, plus] = s.split('+');
    const minute = parseInt(base, 10);
    const extra = plus != null ? parseInt(plus, 10) : null;
    return { minute: Number.isNaN(minute) ? null : minute, extra: (extra == null || Number.isNaN(extra)) ? null : extra };
}

// Map ESPN scoreboard events to our live entries. Pure. One DB match -> a single ESPN event
// by team pair (norm/HEB_TO_EN) within ±36h of kickoff, in a live-or-just-finished state.
export function mapEspnLive({ matches, espnEvents, now, inPlayWindowMs = 3 * 3600 * 1000 }) {
    const out = [];
    for (const [matchId, m] of Object.entries(matches || {})) {
        if (!m || !m.team1 || !m.team2 || !m.date) continue;
        if (m.result && m.result.team1Goals !== undefined) continue;
        const en1 = HEB_TO_EN[m.team1], en2 = HEB_TO_EN[m.team2];
        if (!en1 || !en2) continue;
        const t1 = norm(en1), t2 = norm(en2);
        const kickoff = parseMatchDate(m.date);
        if (now - kickoff > inPlayWindowMs) continue;   // too long after kickoff — not live anymore
        const hits = (espnEvents || []).filter(e => {
            const comp = (e.competitions || [])[0] || {};
            const state = comp.status && comp.status.type && comp.status.type.state;
            if (state !== 'in' && state !== 'post') return false;
            const cs = comp.competitors || [];
            const home = cs.find(c => c.homeAway === 'home') || {};
            const away = cs.find(c => c.homeAway === 'away') || {};
            const hn = norm(home.team && home.team.displayName);
            const an = norm(away.team && away.team.displayName);
            const same = (hn === t1 && an === t2) || (hn === t2 && an === t1);
            if (!same) return false;
            const edate = e.date ? Date.parse(e.date) : NaN;
            return Number.isNaN(edate) ? true : Math.abs(edate - kickoff) <= 36 * 3600 * 1000;
        });
        if (hits.length !== 1) continue;
        const e = hits[0];
        const comp = (e.competitions || [])[0] || {};
        const cs = comp.competitors || [];
        const home = cs.find(c => c.homeAway === 'home') || {};
        const away = cs.find(c => c.homeAway === 'away') || {};
        const hs = parseInt(home.score, 10), as = parseInt(away.score, 10);
        if (Number.isNaN(hs) || Number.isNaN(as)) continue;
        const homeIsT1 = norm(home.team && home.team.displayName) === t1;
        const g1 = homeIsT1 ? hs : as;
        const g2 = homeIsT1 ? as : hs;
        const type = (comp.status && comp.status.type) || {};
        const det = `${type.detail || ''} ${type.shortDetail || ''}`;
        const status = (type.state === 'post' || type.completed) ? 'FT'
            : /half|halftime|(^|\s)ht(\s|$)/i.test(det) ? 'PAUSED' : 'IN_PLAY';
        const { minute, extra } = espnMinute(comp.status && comp.status.displayClock);
        out.push({ matchId, m, g1, g2, status, minute, extra,
                   espnEventId: e.id, homeName: home.team && home.team.displayName, homeIsT1 });
    }
    return out;
}

// Parse ESPN summary keyEvents into our scorer shape. Pure. Best-effort: structured
// participants give the scorer; own-goal/penalty inferred from type/text.
export function parseEspnGoals(keyEvents, { homeName, homeIsT1 }) {
    const out = [];
    for (const e of (keyEvents || [])) {
        if (!e || e.scoringPlay !== true || e.shootout === true) continue;
        const player = e.participants && e.participants[0] && e.participants[0].athlete && e.participants[0].athlete.displayName;
        if (!player) continue;
        const { minute, extra } = espnMinute(e.clock && e.clock.displayValue);
        const blob = `${(e.type && e.type.type) || ''} ${(e.type && e.type.text) || ''} ${e.text || ''}`.toLowerCase();
        const kind = /\bown goal\b|own-goal/.test(blob) ? 'og' : /penalt/.test(blob) ? 'pen' : 'goal';
        const eventIsHome = norm(e.team && e.team.displayName) === norm(homeName);
        const team = eventIsHome ? (homeIsT1 ? 1 : 2) : (homeIsT1 ? 2 : 1);
        out.push({ team, player, minute, extra, kind });
    }
    out.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0) || (a.extra ?? 0) - (b.extra ?? 0));
    return out;
}

// Match a DB match to a single API fixture by team pair + ±36h window.
function findApiFixture(m, apiMatches) {
    const en1 = HEB_TO_EN[m.team1];
    const en2 = HEB_TO_EN[m.team2];
    if (!en1 || !en2) return { error: 'mapping', en1, en2 };
    const t1 = norm(en1), t2 = norm(en2);
    const kickoff = parseMatchDate(m.date);
    const hits = apiMatches.filter(am => {
        const home = norm(am.homeTeam && am.homeTeam.name);
        const away = norm(am.awayTeam && am.awayTeam.name);
        const same = (home === t1 && away === t2) || (home === t2 && away === t1);
        if (!same) return false;
        return Math.abs(Date.parse(am.utcDate) - kickoff) <= 36 * 3600 * 1000;
    });
    if (hits.length !== 1) return { error: hits.length === 0 ? 'none' : 'ambiguous', en1, en2, count: hits.length };
    const am = hits[0];
    const t1IsHome = norm(am.homeTeam.name) === t1;
    return { am, en1, en2, t1IsHome };
}

// Split candidates into finished (final score) and live (in-play score), and flag
// stale unmatched ones (well past kickoff, no usable API data).
export function classifyMatches({ matches, apiMatches, now, staleMinutes = 180, inPlayWindowMs = 3 * 3600 * 1000, refinalizeWindowMs = 6 * 3600 * 1000 }) {
    const finished = [];
    const live = [];
    const staleUnmatched = [];

    for (const [matchId, m] of Object.entries(matches || {})) {
        if (!m || !m.team1 || !m.team2 || !m.date) continue;
        const hasResult = m.result && m.result.team1Goals !== undefined;
        // A finalized match is normally done. Re-examine it only briefly after finishing
        // so a VAR correction to the final score can still be applied.
        const withinRefinalize = hasResult && m.finishedAt != null && (now - m.finishedAt) <= refinalizeWindowMs;
        if (hasResult && !withinRefinalize) continue;
        const kickoff = parseMatchDate(m.date);
        if (kickoff > now) continue;                       // not started -> nothing to fetch
        const minsSince = (now - kickoff) / 60000;
        const isStale = minsSince >= staleMinutes;

        const found = findApiFixture(m, apiMatches);
        if (found.error) {
            if (isStale && !hasResult) staleUnmatched.push(`${matchId} — "${found.en1 || m.team1}" vs "${found.en2 || m.team2}", ${found.error}`);
            continue;
        }
        const am = found.am;
        // Score the 90-minute (regulation) result. football-data.org exposes score.regularTime
        // (goals after 90') separately from extra time / penalties; for normal-time games it may
        // be absent, so fall back to fullTime (which equals the 90' score when there was no ET).
        const ft = (am.score && am.score.regularTime && am.score.regularTime.home != null)
            ? am.score.regularTime
            : (am.score && am.score.fullTime);
        const g1 = found.t1IsHome ? (ft && ft.home) : (ft && ft.away);
        const g2 = found.t1IsHome ? (ft && ft.away) : (ft && ft.home);

        if (am.status === 'FINISHED' && ft && ft.home !== null && ft.away !== null) {
            if (hasResult) {
                // g1/g2 are football-data's full-time TOTAL. For a knockout game already
                // reconciled to its after-extra-time total, compare against resultAet — the
                // stored `result` is the 90' score, which always differs from the FD total for
                // an ET game and would re-trigger (and risk clobbering) every cycle.
                const cmp = (isKnockoutStage(m.stage) && m.resultAet) ? m.resultAet : m.result;
                // Re-finalize only if the authoritative total actually changed (e.g. a VAR fix).
                if (g1 !== cmp.team1Goals || g2 !== cmp.team2Goals) {
                    finished.push({ matchId, m, g1, g2 });
                }
            } else {
                finished.push({ matchId, m, g1, g2 });
            }
        } else if (!hasResult && (am.status === 'IN_PLAY' || am.status === 'PAUSED') && ft && ft.home !== null && ft.away !== null
                   && (now - kickoff) <= inPlayWindowMs) {
            live.push({ matchId, m, g1, g2, status: am.status });
        } else if (isStale && !hasResult) {
            staleUnmatched.push(`${matchId} — "${found.en1}" vs "${found.en2}", status=${am.status}, no usable score`);
        }
    }
    return { finished, live, staleUnmatched };
}

// Build one Firebase multi-path patch: live nodes, final results (+finishedAt,
// clear live), and recalculated per-bet points + member totals.
export function buildResultUpdates({ finished, live, groups, bets, specialBets, now }) {
    const updates = {};

    for (const { matchId, g1, g2, status, minute, extra, scorers } of live) {
        updates[`matches/${matchId}/live`] = { team1Goals: g1, team2Goals: g2, status, updatedAt: now, minute: minute == null ? null : minute, extra: extra == null ? null : extra };
        // Scorers live on a PERSISTENT path so they survive finalize (when the live node
        // is nulled). Never cleared — becomes part of the match's history.
        updates[`matches/${matchId}/scorers`] = Array.isArray(scorers) ? scorers : [];
    }

    for (const f of finished) {
        const { matchId, m, g1, g2 } = f;
        const split = splitKnockoutResult({ stage: m.stage, g1, g2, scorers: m.scorers });
        f.r1 = split.result.team1Goals;   // 90-minute score — used by the points loop below
        f.r2 = split.result.team2Goals;
        updates[`matches/${matchId}/result`] = split.result;
        updates[`matches/${matchId}/status`] = 'completed';
        updates[`matches/${matchId}/finishedAt`] = now;
        updates[`matches/${matchId}/live`] = null;
        if (split.resultAet) {
            updates[`matches/${matchId}/resultAet`] = split.resultAet;
        } else if (isKnockoutStage(m.stage) && Array.isArray(m.scorers)
                   && m.scorers.some(s => s && typeof s.minute === 'number' && s.minute > 90)) {
            // ET goals present but the 90' split was skipped (scorer count != FD total, e.g. a
            // penalty shootout or a missed goal). Scored on the full total — flag for review.
            console.warn(`[finalize] ${matchId}: knockout has extra-time goals but scorer count (${m.scorers.length}) != total (${g1 + g2}); scored on full total ${g1}-${g2} — review the 90' result manually.`);
        }
    }

    const scored = finished.filter(f => !f.m.noPoints);
    if (scored.length > 0) {
        const allBets = bets || {};
        for (const groupId of Object.keys(groups || {})) {
            const members = (groups[groupId] && groups[groupId].members) || {};
            for (const userId of Object.keys(members)) {
                const userBets = ((allBets[groupId] || {})[userId]) || {};
                for (const { matchId, r1, r2, m } of scored) {
                    const bet = userBets[matchId];
                    if (!bet) {
                        const filled = { team1Goals: 0, team2Goals: 0, placedAt: 0, points: calcPoints(0, 0, r1, r2, m.stage) };
                        updates[`bets/${groupId}/${userId}/${matchId}`] = filled;
                        userBets[matchId] = filled;
                    } else {
                        bet.points = calcPoints(bet.team1Goals, bet.team2Goals, r1, r2, m.stage);
                        updates[`bets/${groupId}/${userId}/${matchId}/points`] = bet.points;
                    }
                }
                const special = ((specialBets || {})[groupId] || {})[userId] || {};
                const matchPts = Object.values(userBets).reduce((s, b) => s + (b.points || 0), 0);
                const specialPts = ((special.winner && special.winner.points) || 0)
                    + ((special.topScorer && special.topScorer.points) || 0);
                updates[`groups/${groupId}/members/${userId}/totalPoints`] = matchPts + specialPts;
                if (!((allBets[groupId] || {})[userId])) {
                    allBets[groupId] = allBets[groupId] || {};
                    allBets[groupId][userId] = userBets;
                }
            }
        }
    }
    return updates;
}
