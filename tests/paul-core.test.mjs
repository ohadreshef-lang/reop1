import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAUL_USER_ID, PAUL_NAME, seededRandom, randomScore, randomPick, buildPaulUpdates,
} from '../scripts/lib/paul-core.mjs';

const NOW = 1_750_000_000_000;

test('seededRandom: deterministic for the same seed', () => {
  const a = seededRandom('g1:m1');
  const b = seededRandom('g1:m1');
  assert.equal(a(), b());
  assert.equal(a(), b()); // sequences stay in lockstep
});

test('seededRandom: different seeds diverge (per-group difference)', () => {
  assert.notEqual(seededRandom('g1:m1')(), seededRandom('g2:m1')());
});

test('randomScore: both sides within [0,5]', () => {
  for (let i = 0; i < 300; i++) {
    const s = randomScore(seededRandom('m' + i));
    assert.ok(s.team1Goals >= 0 && s.team1Goals <= 5, `t1=${s.team1Goals}`);
    assert.ok(s.team2Goals >= 0 && s.team2Goals <= 5, `t2=${s.team2Goals}`);
  }
});

test('randomPick: element of the list; null for empty/missing', () => {
  assert.equal(randomPick(seededRandom('s'), []), null);
  assert.equal(randomPick(seededRandom('s'), null), null);
  const list = ['a', 'b', 'c'];
  assert.ok(list.includes(randomPick(seededRandom('s'), list)));
});

test('buildPaulUpdates: creates user record when absent, omits when present', () => {
  const base = { users: {}, groups: { g1: { members: {} } }, matches: {}, bets: {}, specialBets: {}, tournament: {}, now: NOW };
  assert.deepEqual(buildPaulUpdates(base)[`users/${PAUL_USER_ID}`], { name: PAUL_NAME, email: '' });
  const present = buildPaulUpdates({ ...base, users: { [PAUL_USER_ID]: { name: PAUL_NAME } } });
  assert.equal(present[`users/${PAUL_USER_ID}`], undefined);
});

test('buildPaulUpdates: writes a bet for every unbet match, skips already-bet', () => {
  const matches = {
    m1: { team1: 'A', team2: 'B', date: '2026-07-01T20:00' },
    m2: { team1: 'C', team2: 'D', date: '2026-07-02T20:00' },
  };
  const bets = { g1: { [PAUL_USER_ID]: { m1: { team1Goals: 1, team2Goals: 1, placedAt: 1 } } } };
  const u = buildPaulUpdates({
    users: { [PAUL_USER_ID]: {} }, groups: { g1: { members: { [PAUL_USER_ID]: {} } } },
    matches, bets, specialBets: {}, tournament: {}, now: NOW,
  });
  assert.equal(u[`bets/g1/${PAUL_USER_ID}/m1`], undefined); // already bet -> untouched
  assert.ok(u[`bets/g1/${PAUL_USER_ID}/m2`]);               // unbet -> written
  assert.equal(u[`bets/g1/${PAUL_USER_ID}/m2`].placedAt, NOW);
});

test('buildPaulUpdates: same match differs across groups (per-group seed)', () => {
  const matches = { m1: { team1: 'A', team2: 'B', date: '2026-07-01T20:00' } };
  const u = buildPaulUpdates({
    users: {}, groups: { g1: { members: {} }, g2: { members: {} } },
    matches, bets: {}, specialBets: {}, tournament: {}, now: NOW,
  });
  assert.ok(u[`bets/g1/${PAUL_USER_ID}/m1`] && u[`bets/g2/${PAUL_USER_ID}/m1`]);
});

test('buildPaulUpdates: finished match scored; future match unscored; new total sums finished', () => {
  const matches = {
    done: { team1: 'A', team2: 'B', date: '2026-06-01T20:00', result: { team1Goals: 2, team2Goals: 1 } },
    fut:  { team1: 'C', team2: 'D', date: '2026-07-01T20:00' },
  };
  const u = buildPaulUpdates({
    users: {}, groups: { g1: { members: {} } },
    matches, bets: {}, specialBets: {}, tournament: {}, now: NOW,
  });
  const doneBet = u[`bets/g1/${PAUL_USER_ID}/done`];
  const futBet = u[`bets/g1/${PAUL_USER_ID}/fut`];
  assert.equal(typeof doneBet.points, 'number'); // finished -> scored here
  assert.equal(futBet.points, undefined);        // not finished -> scored later by buildResultUpdates
  const member = u[`groups/g1/members/${PAUL_USER_ID}`];
  assert.equal(member.name, PAUL_NAME);
  assert.equal(member.totalPoints, doneBet.points); // initial total = finished points only
});

test('buildPaulUpdates: special bets from tournament lists; scored only when finals set', () => {
  const u = buildPaulUpdates({
    users: {}, groups: { g1: { members: {} } }, matches: {}, bets: {}, specialBets: {},
    tournament: { teams: ['A', 'B', 'C'], scorers: ['P1', 'P2'], winner: null, topScorer: null }, now: NOW,
  });
  const w = u[`specialBets/g1/${PAUL_USER_ID}/winner`];
  const ts = u[`specialBets/g1/${PAUL_USER_ID}/topScorer`];
  assert.ok(['A', 'B', 'C'].includes(w.team));
  assert.ok(['P1', 'P2'].includes(ts.player));
  assert.equal(w.points, undefined); // winner not set -> unscored
});

test('buildPaulUpdates: special bets skipped when lists empty', () => {
  const u = buildPaulUpdates({
    users: {}, groups: { g1: { members: {} } }, matches: {}, bets: {}, specialBets: {},
    tournament: { teams: [], scorers: [] }, now: NOW,
  });
  assert.equal(u[`specialBets/g1/${PAUL_USER_ID}/winner`], undefined);
  assert.equal(u[`specialBets/g1/${PAUL_USER_ID}/topScorer`], undefined);
});

test('buildPaulUpdates: existing membership total not rewritten', () => {
  const u = buildPaulUpdates({
    users: { [PAUL_USER_ID]: {} },
    groups: { g1: { members: { [PAUL_USER_ID]: { totalPoints: 7 } } } },
    matches: {}, bets: {}, specialBets: {}, tournament: {}, now: NOW,
  });
  assert.equal(u[`groups/g1/members/${PAUL_USER_ID}`], undefined);
});
