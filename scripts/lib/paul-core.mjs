// פול התמנון (Paul the Octopus) — a dummy member that makes reasonable random
// predictions in every group. Pure bet GENERATOR: it writes Paul's user record,
// per-group membership, and random bets. The existing buildResultUpdates scores
// him like any normal member. Match points are computed HERE only for matches that
// are already finished when Paul first bets them (a self-running one-time past calc).
import { calcPoints } from './results-core.mjs';

export const PAUL_USER_ID = 'paul-octopus';
export const PAUL_NAME = 'פול התמנון';
// Mirrors TOURNAMENT_POINTS in app.js (there is no shared constants module).
const TOURNAMENT_POINTS = 10;

// Deterministic PRNG from a string seed: FNV-1a hash -> mulberry32.
export function seededRandom(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Realistic per-team goal distribution.
const GOAL_WEIGHTS = [[0, 0.28], [1, 0.34], [2, 0.22], [3, 0.10], [4, 0.04], [5, 0.02]];
function weightedGoals(rng) {
  let r = rng();
  for (const [goals, w] of GOAL_WEIGHTS) {
    if (r < w) return goals;
    r -= w;
  }
  return 0;
}

// A full scoreline from one rng.
export function randomScore(rng) {
  return { team1Goals: weightedGoals(rng), team2Goals: weightedGoals(rng) };
}

// Deterministic element of a non-empty array; null for empty/missing.
export function randomPick(rng, list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(rng() * list.length)];
}

function hasResult(m) {
  return m && m.result && m.result.team1Goals !== undefined && m.result.team1Goals !== null;
}

// Build the flat { path: value } updates that create/extend Paul. Writes only paths
// absent in the data passed in, so it is idempotent.
export function buildPaulUpdates({ users, groups, matches, bets, specialBets, tournament, now }) {
  const updates = {};
  users = users || {};
  groups = groups || {};
  matches = matches || {};
  bets = bets || {};
  specialBets = specialBets || {};
  tournament = tournament || {};

  // 1. User record (once).
  if (!users[PAUL_USER_ID]) {
    updates[`users/${PAUL_USER_ID}`] = { name: PAUL_NAME, email: '' };
  }

  const winner = tournament.winner || null;
  const topScorer = tournament.topScorer || null;

  for (const gid of Object.keys(groups)) {
    const groupBets = ((bets[gid] || {})[PAUL_USER_ID]) || {};
    const memberExists = !!(((groups[gid] || {}).members || {})[PAUL_USER_ID]);
    // Sum of points written THIS run, used only to seed a NEW member's initial total.
    let initialPoints = 0;

    // 2. Match bets — every match Paul hasn't bet in this group.
    for (const matchId of Object.keys(matches)) {
      const m = matches[matchId];
      if (!m) continue;
      if (groupBets[matchId]) continue; // already bet -> leave untouched
      const score = randomScore(seededRandom(`${gid}:${matchId}`));
      const bet = { team1Goals: score.team1Goals, team2Goals: score.team2Goals, placedAt: now };
      if (hasResult(m)) {
        bet.points = calcPoints(score.team1Goals, score.team2Goals, m.result.team1Goals, m.result.team2Goals);
        initialPoints += bet.points;
      }
      updates[`bets/${gid}/${PAUL_USER_ID}/${matchId}`] = bet;
    }

    // 3. Special bets — champion + top scorer (per group), only if absent.
    const groupSpecial = ((specialBets[gid] || {})[PAUL_USER_ID]) || {};
    if (!groupSpecial.winner) {
      const team = randomPick(seededRandom(`${gid}:champion`), tournament.teams);
      if (team) {
        const sb = { team, placedAt: now };
        if (winner) { sb.points = team === winner ? TOURNAMENT_POINTS : 0; initialPoints += sb.points; }
        updates[`specialBets/${gid}/${PAUL_USER_ID}/winner`] = sb;
      }
    }
    if (!groupSpecial.topScorer) {
      const player = randomPick(seededRandom(`${gid}:topscorer`), tournament.scorers);
      if (player) {
        const sb = { player, placedAt: now };
        if (topScorer) { sb.points = player === topScorer ? TOURNAMENT_POINTS : 0; initialPoints += sb.points; }
        updates[`specialBets/${gid}/${PAUL_USER_ID}/topScorer`] = sb;
      }
    }

    // 4. Membership with seeded initial total — only when membership is new.
    // Once Paul is a member, buildResultUpdates owns his totalPoints.
    if (!memberExists) {
      updates[`groups/${gid}/members/${PAUL_USER_ID}`] = { joinedAt: now, totalPoints: initialPoints, name: PAUL_NAME };
    }
  }

  return updates;
}
