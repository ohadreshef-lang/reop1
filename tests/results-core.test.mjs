import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyMatches, buildResultUpdates, parseMatchDate, calcPoints, isKnockoutStage, espnMinute, mapEspnLive, parseEspnGoals, splitKnockoutResult } from '../scripts/lib/results-core.mjs';

const now = Date.parse('2026-06-17T22:30:00Z'); // 2.5h after the 20:00Z kickoff

// Hebrew canonical matches keyed like prod ids. Dates are UTC-naive.
const matches = {
  m_fin: { team1: 'אנגליה', team2: 'קרואטיה', date: '2026-06-17T20:00' }, // 20:00Z, finished
  m_open:{ team1: 'גאנה',   team2: 'פנמה',    date: '2026-06-30T20:00' }, // far future, ignored
};
const apiMatches = [
  { id: 1, status: 'FINISHED', utcDate: '2026-06-17T20:00:00Z',
    homeTeam: { name: 'England' }, awayTeam: { name: 'Croatia' },
    score: { duration: 'REGULAR', fullTime: { home: 4, away: 2 } } },
];

test('classifyMatches: finished fixture is detected with correct orientation', () => {
  const { finished, live } = classifyMatches({ matches, apiMatches, now, minMinutes: 0, staleMinutes: 180, inPlayWindowMs: 9000000 });
  assert.equal(finished.length, 1);
  assert.equal(finished[0].matchId, 'm_fin');
  assert.equal(finished[0].g1, 4); // England == team1
  assert.equal(finished[0].g2, 2);
  assert.equal(live.length, 0);
});

test('buildResultUpdates: finished writes result + finishedAt + clears live', () => {
  const finished = [{ matchId: 'm_fin', m: matches.m_fin, g1: 4, g2: 2 }];
  const updates = buildResultUpdates({ finished, live: [], groups: {}, bets: {}, specialBets: {}, now });
  assert.deepEqual(updates['matches/m_fin/result'], { team1Goals: 4, team2Goals: 2 });
  assert.equal(updates['matches/m_fin/status'], 'completed');
  assert.equal(updates['matches/m_fin/finishedAt'], now);
  assert.equal(updates['matches/m_fin/live'], null);
});

test('calcPoints (group): exact=4, direction=1, miss=0', () => {
  assert.equal(calcPoints(2, 1, 2, 1, 'group'), 4);
  assert.equal(calcPoints(2, 1, 3, 0, 'group'), 1);
  assert.equal(calcPoints(2, 1, 1, 2, 'group'), 0);
  assert.equal(calcPoints(2, 1, 2, 1), 4); // missing stage -> group scoring
});

test('calcPoints (knockout): exact=5, exact w/ 5+ goals=7, direction=2, miss=0', () => {
  assert.equal(calcPoints(2, 1, 2, 1, 'R32'), 5);   // exact, 3 goals
  assert.equal(calcPoints(0, 0, 0, 0, 'Final'), 5); // exact, 0 goals
  assert.equal(calcPoints(3, 2, 3, 2, 'QF'), 7);    // exact, 5 goals -> +2
  assert.equal(calcPoints(5, 0, 5, 0, 'R16'), 7);   // exact, 5 goals -> +2
  assert.equal(calcPoints(2, 1, 3, 0, 'SF'), 2);    // direction only
  assert.equal(calcPoints(2, 1, 1, 2, '3rd'), 0);   // wrong
});

test('isKnockoutStage: group/special -> false, knockout stages -> true', () => {
  assert.equal(isKnockoutStage('group'), false);
  assert.equal(isKnockoutStage('special'), false);
  assert.equal(isKnockoutStage(undefined), false);
  assert.equal(isKnockoutStage('R32'), true);
  assert.equal(isKnockoutStage('Final'), true);
});

test('classifyMatches: finalizes a knockout extra-time game on regularTime (90 min), not fullTime', () => {
  const now2 = Date.parse('2026-07-01T22:00:00Z');
  const matches2 = { ko: { team1: 'אנגליה', team2: 'קרואטיה', date: '2026-07-01T19:00', stage: 'R32' } };
  const apiMatches2 = [{
    id: 9, status: 'FINISHED', utcDate: '2026-07-01T16:00:00Z',
    homeTeam: { name: 'England' }, awayTeam: { name: 'Croatia' },
    score: { duration: 'EXTRA_TIME', fullTime: { home: 2, away: 1 }, regularTime: { home: 1, away: 1 } },
  }];
  const { finished } = classifyMatches({ matches: matches2, apiMatches: apiMatches2, now: now2, staleMinutes: 180, inPlayWindowMs: 9000000 });
  assert.equal(finished.length, 1);
  assert.equal(finished[0].g1, 1);  // 90' score (regularTime), not 2 (fullTime)
  assert.equal(finished[0].g2, 1);
});

test('classifyMatches: in-play fixture becomes a live entry', () => {
  const matches = { m_live: { team1: 'גאנה', team2: 'פנמה', date: '2026-06-17T23:00' } }; // 23:00Z
  const now = Date.parse('2026-06-17T23:50:00Z'); // 50 min in (UTC dates)
  const apiMatches = [{
    id: 9, status: 'IN_PLAY', utcDate: '2026-06-17T23:00:00Z',
    homeTeam: { name: 'Ghana' }, awayTeam: { name: 'Panama' },
    score: { duration: 'REGULAR', fullTime: { home: 1, away: 0 } },
  }];
  const { live, finished } = classifyMatches({ matches, apiMatches, now, staleMinutes: 180, inPlayWindowMs: 3*3600*1000 });
  assert.equal(finished.length, 0);
  assert.equal(live.length, 1);
  assert.equal(live[0].matchId, 'm_live');
  assert.equal(live[0].g1, 1); // Ghana == team1
  assert.equal(live[0].g2, 0);
  assert.equal(live[0].status, 'IN_PLAY');
});

test('buildResultUpdates: live entry writes a live node only', () => {
  const now = 1750000000000;
  const live = [{ matchId: 'm_live', m: { team1:'גאנה', team2:'פנמה' }, g1: 1, g2: 0, status: 'IN_PLAY' }];
  const updates = buildResultUpdates({ finished: [], live, groups: {}, bets: {}, specialBets: {}, now });
  assert.deepEqual(updates['matches/m_live/live'], { team1Goals: 1, team2Goals: 0, status: 'IN_PLAY', updatedAt: now, minute: null, extra: null });
  assert.deepEqual(updates['matches/m_live/scorers'], []);
  assert.equal(updates['matches/m_live/result'], undefined);
});

test('buildResultUpdates: finished recalcs a member bet to points', () => {
  const now = 1750000000000;
  const finished = [{ matchId: 'm_fin', m: { team1:'אנגליה', team2:'קרואטיה' }, g1: 4, g2: 2 }];
  const groups = { g1: { members: { u1: {} } } };
  const bets = { g1: { u1: { m_fin: { team1Goals: 4, team2Goals: 2, points: 0 } } } };
  const updates = buildResultUpdates({ finished, live: [], groups, bets, specialBets: {}, now });
  assert.equal(updates['bets/g1/u1/m_fin/points'], 4); // exact -> calcPoints exact value
  assert.equal(updates['groups/g1/members/u1/totalPoints'], 4);
});

const fdFinished = (h, a) => ([{ id: 1, status: 'FINISHED', utcDate: '2026-06-17T20:00:00Z',
  homeTeam: { name: 'England' }, awayTeam: { name: 'Croatia' },
  score: { duration: 'REGULAR', fullTime: { home: h, away: a } } }]);

test('classifyMatches: re-finalizes a recently-finished match whose score changed', () => {
  const matches = { m_fin: { team1: 'אנגליה', team2: 'קרואטיה', date: '2026-06-17T20:00',
    result: { team1Goals: 5, team2Goals: 2 }, finishedAt: Date.parse('2026-06-17T22:00:00Z') } };
  const now = Date.parse('2026-06-17T22:30:00Z'); // 30 min after finishedAt, within window
  const { finished } = classifyMatches({ matches, apiMatches: fdFinished(4, 2), now, refinalizeWindowMs: 6 * 3600 * 1000 });
  assert.equal(finished.length, 1);
  assert.equal(finished[0].matchId, 'm_fin');
  assert.equal(finished[0].g1, 4);
  assert.equal(finished[0].g2, 2);
});

test('classifyMatches: does NOT re-finalize when the score is unchanged', () => {
  const matches = { m_fin: { team1: 'אנגליה', team2: 'קרואטיה', date: '2026-06-17T20:00',
    result: { team1Goals: 4, team2Goals: 2 }, finishedAt: Date.parse('2026-06-17T22:00:00Z') } };
  const now = Date.parse('2026-06-17T22:30:00Z');
  const { finished } = classifyMatches({ matches, apiMatches: fdFinished(4, 2), now, refinalizeWindowMs: 6 * 3600 * 1000 });
  assert.equal(finished.length, 0);
});

test('classifyMatches: does NOT re-finalize past the window', () => {
  const matches = { m_fin: { team1: 'אנגליה', team2: 'קרואטיה', date: '2026-06-17T20:00',
    result: { team1Goals: 5, team2Goals: 2 }, finishedAt: Date.parse('2026-06-17T12:00:00Z') } };
  const now = Date.parse('2026-06-17T22:30:00Z'); // 10.5h after finishedAt, outside 6h window
  const { finished } = classifyMatches({ matches, apiMatches: fdFinished(4, 2), now, refinalizeWindowMs: 6 * 3600 * 1000 });
  assert.equal(finished.length, 0);
});

// Regression guard: a knockout game reconciled to 90' result={2,2} + resultAet={3,2}.
// FD returns its full-time total (3-2) — must NOT re-finalize (the 90' result is correct).
test('classifyMatches: knockout with resultAet does NOT re-finalize when FD total equals resultAet', () => {
  const matches = { ko: { team1: 'אנגליה', team2: 'קרואטיה', date: '2026-06-17T20:00', stage: 'R32',
    result: { team1Goals: 2, team2Goals: 2 },
    resultAet: { team1Goals: 3, team2Goals: 2 },
    finishedAt: Date.parse('2026-06-17T22:00:00Z') } };
  const now = Date.parse('2026-06-17T22:30:00Z'); // within 6h window
  // FD returns full-time total 3-2 (after ET) — same as resultAet, no real change
  const apiMatchesKo = [{ id: 1, status: 'FINISHED', utcDate: '2026-06-17T20:00:00Z',
    homeTeam: { name: 'England' }, awayTeam: { name: 'Croatia' },
    score: { duration: 'EXTRA_TIME', fullTime: { home: 3, away: 2 } } }];
  const { finished } = classifyMatches({ matches, apiMatches: apiMatchesKo, now, refinalizeWindowMs: 6 * 3600 * 1000 });
  assert.equal(finished.length, 0); // must NOT clobber the correctly stored 90' result
});

// If FD returns a genuinely different total (e.g. a VAR correction), re-finalize must still fire.
test('classifyMatches: knockout with resultAet DOES re-finalize when FD total is genuinely different', () => {
  const matches = { ko: { team1: 'אנגליה', team2: 'קרואטיה', date: '2026-06-17T20:00', stage: 'R32',
    result: { team1Goals: 2, team2Goals: 2 },
    resultAet: { team1Goals: 3, team2Goals: 2 },
    finishedAt: Date.parse('2026-06-17T22:00:00Z') } };
  const now = Date.parse('2026-06-17T22:30:00Z'); // within 6h window
  // FD now returns 4-2 (VAR added a goal) — different from resultAet 3-2
  const apiMatchesKo = [{ id: 1, status: 'FINISHED', utcDate: '2026-06-17T20:00:00Z',
    homeTeam: { name: 'England' }, awayTeam: { name: 'Croatia' },
    score: { duration: 'EXTRA_TIME', fullTime: { home: 4, away: 2 } } }];
  const { finished } = classifyMatches({ matches, apiMatches: apiMatchesKo, now, refinalizeWindowMs: 6 * 3600 * 1000 });
  assert.equal(finished.length, 1); // genuine correction must flow through
  assert.equal(finished[0].g1, 4);
  assert.equal(finished[0].g2, 2);
});

test('buildResultUpdates: scorers persisted to matches/{id}/scorers, not in the live node', () => {
  const now = 1750000000000;
  const withScorers = [{ matchId: 'm_live', m: { team1: 'גאנה', team2: 'פנמה' }, g1: 1, g2: 0, status: 'IN_PLAY',
    scorers: [{ team: 1, player: 'Z', minute: 8, extra: null, kind: 'goal' }] }];
  const u1 = buildResultUpdates({ finished: [], live: withScorers, groups: {}, bets: {}, specialBets: {}, now });
  assert.deepEqual(u1['matches/m_live/scorers'], [{ team: 1, player: 'Z', minute: 8, extra: null, kind: 'goal' }]);
  assert.equal('scorers' in u1['matches/m_live/live'], false); // scorers no longer in the live node

  const noScorers = [{ matchId: 'm_live', m: { team1: 'גאנה', team2: 'פנמה' }, g1: 0, g2: 0, status: 'IN_PLAY' }];
  const u2 = buildResultUpdates({ finished: [], live: noScorers, groups: {}, bets: {}, specialBets: {}, now });
  assert.deepEqual(u2['matches/m_live/scorers'], []);
});

import { norm as _norm } from "../scripts/lib/results-core.mjs";
test("API alias: Bosnia & Herzegovina matches our Bosnia and Herzegovina", () => {
  assert.equal(_norm("Bosnia & Herzegovina"), _norm("Bosnia and Herzegovina"));
  assert.equal(_norm("Bosnia & Herzegovina"), "bosnia and herzegovina");
});

// --- ESPN live mapping -----------------------------------------------------

const espnEvent = (homeName, awayName, hs, as, state, opts = {}) => ({
  id: opts.id || '900', date: opts.date || '2026-06-29T17:00Z',
  competitions: [{
    status: { type: { state, completed: state === 'post', detail: opts.detail || '', shortDetail: opts.shortDetail || '' }, displayClock: opts.displayClock || "41'", period: 1 },
    competitors: [
      { homeAway: 'home', score: String(hs), team: { displayName: homeName } },
      { homeAway: 'away', score: String(as), team: { displayName: awayName } },
    ],
  }],
});

test('espnMinute parses the display clock', () => {
  assert.deepEqual(espnMinute("29'"), { minute: 29, extra: null });
  assert.deepEqual(espnMinute("45'+2'"), { minute: 45, extra: 2 });
  assert.deepEqual(espnMinute(""), { minute: null, extra: null });
});

test('mapEspnLive: in-play event -> entry with score/status/minute', () => {
  const now = Date.parse('2026-06-29T17:41:00Z');
  const matches = { m1: { team1: 'ברזיל', team2: 'יפן', date: '2026-06-29T17:00' } };
  const live = mapEspnLive({ matches, espnEvents: [espnEvent('Brazil', 'Japan', 0, 1, 'in', { displayClock: "41'" })], now });
  assert.equal(live.length, 1);
  assert.equal(live[0].g1, 0); assert.equal(live[0].g2, 1);
  assert.equal(live[0].status, 'IN_PLAY'); assert.equal(live[0].minute, 41);
  assert.equal(live[0].homeIsT1, true); assert.equal(live[0].espnEventId, '900');
});

test('mapEspnLive: orientation when our team1 is the ESPN away side', () => {
  const now = Date.parse('2026-06-29T17:41:00Z');
  const matches = { m1: { team1: 'יפן', team2: 'ברזיל', date: '2026-06-29T17:00' } };
  const live = mapEspnLive({ matches, espnEvents: [espnEvent('Brazil', 'Japan', 0, 1, 'in')], now });
  assert.equal(live[0].g1, 1); assert.equal(live[0].g2, 0); assert.equal(live[0].homeIsT1, false);
});

test('mapEspnLive: halftime -> PAUSED, post -> FT, pre -> ignored', () => {
  const now = Date.parse('2026-06-29T17:41:00Z');
  const m = { m1: { team1: 'ברזיל', team2: 'יפן', date: '2026-06-29T17:00' } };
  assert.equal(mapEspnLive({ matches: m, espnEvents: [espnEvent('Brazil', 'Japan', 0, 1, 'in', { detail: 'Halftime' })], now })[0].status, 'PAUSED');
  assert.equal(mapEspnLive({ matches: m, espnEvents: [espnEvent('Brazil', 'Japan', 0, 1, 'post')], now })[0].status, 'FT');
  assert.equal(mapEspnLive({ matches: m, espnEvents: [espnEvent('Brazil', 'Japan', 0, 0, 'pre')], now }).length, 0);
});

test('mapEspnLive: alias teams resolve (United States / Bosnia-Herzegovina)', () => {
  const now = Date.parse('2026-07-02T00:30:00Z');
  const matches = { m1: { team1: 'ארצות הברית', team2: 'בוסניה והרצגובינה', date: '2026-07-02T00:00' } };
  const live = mapEspnLive({ matches, espnEvents: [espnEvent('United States', 'Bosnia-Herzegovina', 1, 0, 'in', { date: '2026-07-02T00:00Z' })], now });
  assert.equal(live.length, 1); assert.equal(live[0].g1, 1);
});

test('parseEspnGoals: structured goal -> scorer; non-goal and shootout ignored', () => {
  const keyEvents = [
    { scoringPlay: true, shootout: false, type: { type: 'goal', text: 'Goal' }, clock: { displayValue: "29'" }, team: { displayName: 'Japan' }, participants: [{ athlete: { displayName: 'Kaishu Sano' } }], text: 'Goal! Brazil 0, Japan 1. Kaishu Sano (Japan)...' },
    { scoringPlay: false, type: { type: 'yellow-card', text: 'Yellow Card' }, team: { displayName: 'Brazil' } },
    { scoringPlay: true, shootout: true, type: { type: 'goal' }, clock: { displayValue: "0'" }, team: { displayName: 'Brazil' }, participants: [{ athlete: { displayName: 'X' } }] },
  ];
  const goals = parseEspnGoals(keyEvents, { homeName: 'Brazil', homeIsT1: true });
  assert.equal(goals.length, 1);
  assert.deepEqual(goals[0], { team: 2, player: 'Kaishu Sano', minute: 29, extra: null, kind: 'goal' });
});

test('parseEspnGoals: penalty and own-goal kinds', () => {
  const keyEvents = [
    { scoringPlay: true, type: { type: 'goal', text: 'Penalty - Scored' }, clock: { displayValue: "55'" }, team: { displayName: 'Brazil' }, participants: [{ athlete: { displayName: 'P' } }], text: 'Penalty! converts the penalty' },
    { scoringPlay: true, type: { type: 'own-goal', text: 'Own Goal' }, clock: { displayValue: "70'" }, team: { displayName: 'Brazil' }, participants: [{ athlete: { displayName: 'O' } }], text: 'Own Goal!' },
  ];
  const goals = parseEspnGoals(keyEvents, { homeName: 'Brazil', homeIsT1: true });
  assert.equal(goals.find(g => g.player === 'P').kind, 'pen');
  assert.equal(goals.find(g => g.player === 'O').kind, 'og');
});

test('mapEspnLive: a game far past kickoff (beyond inPlayWindowMs) is excluded', () => {
  const now = Date.parse('2026-06-29T22:00:00Z');   // 5h after the 17:00 kickoff
  const matches = { m1: { team1: 'ברזיל', team2: 'יפן', date: '2026-06-29T17:00' } };
  const live = mapEspnLive({ matches, espnEvents: [espnEvent('Brazil', 'Japan', 0, 1, 'post')], now });
  assert.equal(live.length, 0);
});

test('mapEspnLive: alias teams resolve (Congo DR)', () => {
  const now = Date.parse('2026-07-04T02:00:00Z');
  const matches = { m1: { team1: 'ארצות הברית', team2: 'בוסניה והרצגובינה', date: '2026-07-02T00:00' },
                    m2: { team1: 'קונגו DR', team2: 'גאנה', date: '2026-07-04T01:30' } };
  const live = mapEspnLive({
    matches,
    espnEvents: [
      espnEvent('United States', 'Bosnia-Herzegovina', 1, 0, 'in', { date: '2026-07-02T00:00Z', id: '800' }),
      espnEvent('Congo DR', 'Ghana', 2, 1, 'in', { date: '2026-07-04T01:30Z', id: '901' }),
    ],
    now,
  });
  const congoEntry = live.find(e => e.matchId === 'm2');
  assert.ok(congoEntry, 'Congo DR match should be in live results');
  assert.equal(congoEntry.g1, 2);
  assert.equal(congoEntry.g2, 1);
});

// --- splitKnockoutResult ---------------------------------------------------

test('splitKnockoutResult: group stage never splits', () => {
  const scorers = [{ team: 1, minute: 120 }];
  assert.deepEqual(splitKnockoutResult({ stage: 'group', g1: 3, g2: 2, scorers }),
    { result: { team1Goals: 3, team2Goals: 2 }, resultAet: null });
});

test('splitKnockoutResult: knockout with no ET goals -> no split', () => {
  const scorers = [{ team: 1, minute: 20 }, { team: 1, minute: 80 }, { team: 2, minute: 55 }];
  assert.deepEqual(splitKnockoutResult({ stage: 'R32', g1: 2, g2: 1, scorers }),
    { result: { team1Goals: 2, team2Goals: 1 }, resultAet: null });
});

test('splitKnockoutResult: knockout ET goal splits 90 vs a.e.t. (Belgium-Senegal)', () => {
  const scorers = [
    { team: 2, minute: 25 }, { team: 2, minute: 51 },
    { team: 1, minute: 86 }, { team: 1, minute: 89 }, { team: 1, minute: 120 },
  ];
  assert.deepEqual(splitKnockoutResult({ stage: 'R32', g1: 3, g2: 2, scorers }),
    { result: { team1Goals: 2, team2Goals: 2 }, resultAet: { team1Goals: 3, team2Goals: 2 } });
});

test('splitKnockoutResult: ET goals but scorer count != total (penalty/missed) -> no split', () => {
  const scorers = [{ team: 1, minute: 120 }]; // only 1 scorer but total says 2
  assert.deepEqual(splitKnockoutResult({ stage: 'SF', g1: 1, g2: 1, scorers }),
    { result: { team1Goals: 1, team2Goals: 1 }, resultAet: null });
});

test('splitKnockoutResult: et count exceeding a team total -> no split (guard)', () => {
  const scorers = [{ team: 1, minute: 100 }, { team: 1, minute: 110 }]; // et1=2 but g1=1
  assert.deepEqual(splitKnockoutResult({ stage: 'QF', g1: 1, g2: 1, scorers }),
    { result: { team1Goals: 1, team2Goals: 1 }, resultAet: null });
});

test('buildResultUpdates: knockout ET game scores on 90-minute result + writes resultAet', () => {
  const now = Date.parse('2026-07-01T23:00:00Z');
  const m = { team1: 'A', team2: 'B', date: '2026-07-01T20:00', stage: 'R32',
    scorers: [{ team: 2, minute: 25 }, { team: 2, minute: 51 }, { team: 1, minute: 86 }, { team: 1, minute: 89 }, { team: 1, minute: 120 }] };
  const finished = [{ matchId: 'ko', m, g1: 3, g2: 2 }];
  const groups = { g1: { members: { u1: {}, u2: {} } } };
  const bets = { g1: { u1: { ko: { team1Goals: 1, team2Goals: 1 } }, u2: { ko: { team1Goals: 3, team2Goals: 2 } } } };
  const updates = buildResultUpdates({ finished, live: [], groups, bets, specialBets: {}, now });
  assert.deepEqual(updates['matches/ko/result'], { team1Goals: 2, team2Goals: 2 });   // 90'
  assert.deepEqual(updates['matches/ko/resultAet'], { team1Goals: 3, team2Goals: 2 }); // 120'
  assert.equal(updates['bets/g1/u1/ko/points'], 2);   // 1-1 vs 2-2 draw -> knockout direction = 2
  assert.equal(updates['bets/g1/u2/ko/points'], 0);   // 3-2 vs 2-2 -> wrong (win1 vs draw) = 0
});
