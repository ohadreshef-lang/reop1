// Automatic match-result updater.
//
// Fetches finished World Cup matches from football-data.org and writes the
// scores into Firebase exactly like the admin "save result" flow does
// (result + status, then per-bet points and member totals).
//
// Runs from .github/workflows/update-results.yml on a 30-minute cron.
//
// Finished results + points come from football-data.org. Live in-play scores come
// from ESPN's keyless public API (no key needed) — football-data.org's free tier
// never emits IN_PLAY. The live layer is best-effort: if the ESPN call fails,
// finals/points still work and the Live tab simply shows no live score.
//
// Env:
//   FOOTBALL_DATA_TOKEN  (required) football-data.org API token — finals + points
//   DRY_RUN=1            print planned writes without touching Firebase

import { classifyMatches, buildResultUpdates, mapEspnLive, parseMatchDate, parseEspnGoals } from './lib/results-core.mjs';
import { buildPaulUpdates } from './lib/paul-core.mjs';

const FIREBASE_API_KEY = 'AIzaSyAyOY_It3oq3Q4ferO_zE23sFLJ_bUZB9g';
const DB_URL = 'https://mondial2026-a77fc-default-rtdb.firebaseio.com';
const ROOT = 'worldcup2026';

const FD_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
const DRY_RUN = !!process.env.DRY_RUN;

// Tournament window: June 11 – July 19, 2026 (with margin). Outside it the
// cron exits immediately without spending API calls.
const WINDOW_START = Date.parse('2026-06-08T00:00:00Z');
const WINDOW_END = Date.parse('2026-07-22T00:00:00Z');

// Past this long after kickoff a game is certainly over and the API has had ample
// time to publish the FINISHED result. A candidate still unmatched at this point is
// an anomaly (bad team-name mapping or wrong fixture date), not "not finished yet" —
// the run fails (red) so it's visible instead of silently passing. Self-clears once
// the result is auto-matched or entered manually (then it's no longer a candidate).
const STALE_MINUTES = 180;

// The self-polling workflow run ends early (prints LOOP_IDLE) when no match is live
// and none kicks off within this window — so the runner isn't held open all night.
const IDLE_LOOKAHEAD_MS = 120 * 60 * 1000;
const REFINALIZE_WINDOW_MS = 6 * 60 * 60 * 1000; // re-check a finished match this long for VAR score corrections

// In-run retry with exponential backoff. A transient blip (network/DNS error, 429
// rate-limit, or 5xx) self-heals within the run instead of failing it — and flipping
// the Action red — until the next 30-min cron. Other 4xx (bad token/request) are
// fatal and fail fast. Every caller is idempotent (reads, and a multi-path PATCH that
// writes the same values), so re-attempts are safe.
const RETRY_ATTEMPTS = 4;
const RETRY_BASE_MS = 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function retryFetch(label, url, options) {
    let lastErr;
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;
            const err = new Error(`${label} failed: ${res.status} ${await res.text()}`);
            if (res.status !== 429 && res.status < 500) { err.fatal = true; throw err; } // fatal 4xx — don't retry
            lastErr = err;
        } catch (err) {
            // Network/DNS errors are retryable; rethrow the fatal-4xx we just threw.
            if (err.fatal) throw err;
            lastErr = err;
        }
        if (attempt < RETRY_ATTEMPTS) {
            const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
            console.warn(`${label} attempt ${attempt}/${RETRY_ATTEMPTS} failed: ${lastErr.message} — retrying in ${delay}ms`);
            await sleep(delay);
        }
    }
    throw new Error(`${label} failed after ${RETRY_ATTEMPTS} attempts: ${lastErr.message}`);
}

async function firebaseSignIn() {
    const res = await retryFetch(
        'Firebase anonymous sign-in',
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' },
    );
    return (await res.json()).idToken;
}

async function fbGet(path, token) {
    const res = await retryFetch(`Firebase GET ${path}`, `${DB_URL}/${ROOT}/${path}.json?auth=${token}`);
    return res.json();
}

async function fbPatch(updates, token) {
    await retryFetch('Firebase PATCH', `${DB_URL}/${ROOT}/.json?auth=${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });
}

async function fetchApiMatches(dateFrom, dateTo) {
    // Do NOT add status=FINISHED to the query: combining it with a date range makes
    // football-data.org intermittently omit genuinely-finished fixtures (observed:
    // Ghana–Panama 2026-06-17 stayed absent from the filtered view for 13+ hours while
    // its neighbours returned). Fetching the range unfiltered returns every match
    // (FINISHED, IN_PLAY, PAUSED, SCHEDULED, etc.) so classifyMatches sees all statuses.
    const url = `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
    const res = await retryFetch('football-data.org request', url, { headers: { 'X-Auth-Token': FD_TOKEN } });
    return (await res.json()).matches || [];
}

// Live in-play scores from ESPN's keyless public API (no key, no quota). Best-effort:
// any failure -> [] (finals via football-data.org are unaffected). One scoreboard call
// covers all current games.
async function fetchEspnScoreboard() {
    try {
        const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard');
        if (!res.ok) { console.warn(`ESPN scoreboard unavailable (HTTP ${res.status}) — skipping live this run.`); return []; }
        const j = await res.json();
        return j.events || [];
    } catch (err) {
        console.warn('ESPN scoreboard fetch failed (live skipped this run):', err.message);
        return [];
    }
}

// Goal events (scorers) for one ESPN event. Best-effort: failure -> [] (scorers stay empty).
async function fetchEspnSummary(eventId) {
    try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${eventId}`);
        if (!res.ok) return [];
        const j = await res.json();
        return j.keyEvents || [];
    } catch (err) {
        console.warn(`ESPN summary fetch failed for event ${eventId} (scorers skipped):`, err.message);
        return [];
    }
}

function utcDay(ms) {
    return new Date(ms).toISOString().slice(0, 10);
}

async function main() {
    if (!FD_TOKEN) throw new Error('FOOTBALL_DATA_TOKEN is not set');

    const now = Date.now();
    if (now < WINDOW_START || now > WINDOW_END) {
        console.log('Outside tournament window, nothing to do. LOOP_IDLE');
        return;
    }

    const token = await firebaseSignIn();
    const matches = (await fbGet('matches', token)) || {};

    // Ensure פול התמנון exists in every group with random predictions. Runs every
    // invocation (independent of live state) so Paul bets on matches well before
    // kickoff. buildPaulUpdates only writes absent paths, so this is idempotent.
    await ensurePaul(token, matches, now);

    const candidates = Object.entries(matches).filter(([, m]) => {
        if (!m || !m.team1 || !m.team2 || !m.date) return false;
        if (m.result && m.result.team1Goals !== undefined) return false;
        return parseMatchDate(m.date) <= now;            // any started, unfinished game
    });
    // Recently-finished matches are re-checked so a VAR correction to the final score
    // can be applied (classifyMatches with refinalizeWindowMs).
    const recheckable = Object.values(matches).filter(m =>
        m && m.result && m.result.team1Goals !== undefined
        && m.finishedAt != null && (now - m.finishedAt) <= REFINALIZE_WINDOW_MS);
    if (candidates.length === 0 && recheckable.length === 0) {
        // Nothing live. Tell the polling loop whether to keep going: stay alive if a
        // match kicks off within IDLE_LOOKAHEAD_MS, otherwise emit LOOP_IDLE so the
        // workflow can end this run early (the cron re-triggers before the next game).
        const soon = Object.values(matches).some(m =>
            m && m.date && !(m.result && m.result.team1Goals !== undefined)
            && parseMatchDate(m.date) > now && (parseMatchDate(m.date) - now) <= IDLE_LOOKAHEAD_MS);
        console.log(`No started, unfinished matches and nothing to re-check.${soon ? ' (a match starts soon — keep polling)' : ' LOOP_IDLE'}`);
        return;
    }

    const dateFrom = utcDay(WINDOW_START);
    const dateTo = utcDay(WINDOW_END);
    const apiMatches = await fetchApiMatches(dateFrom, dateTo);
    console.log(`API returned ${apiMatches.length} match(es) (all statuses) between ${dateFrom} and ${dateTo}.`);

    // football-data.org is authoritative for FINISHED results (+ points). Its free
    // tier never reports IN_PLAY, so we ignore its `live` and source live scores
    // from API-Football instead.
    const { finished, staleUnmatched } = classifyMatches({
        matches, apiMatches, now, staleMinutes: STALE_MINUTES, inPlayWindowMs: 3 * 3600 * 1000,
        refinalizeWindowMs: REFINALIZE_WINDOW_MS,
    });

    let live = [];
    if (candidates.length > 0) {
        const espnEvents = await fetchEspnScoreboard();
        live = mapEspnLive({ matches, espnEvents, now, inPlayWindowMs: 3 * 3600 * 1000 });
        for (const entry of live) {
            const prev = entry.m.live;
            // Scorers live on the persistent matches/{id}/scorers path; fall back to the
            // live node only for transitional data written before that move.
            const prevScorers = Array.isArray(entry.m.scorers) ? entry.m.scorers
                : ((prev && Array.isArray(prev.scorers)) ? prev.scorers : []);
            const prevTotal = (prev && prev.team1Goals != null ? prev.team1Goals : 0)
                            + (prev && prev.team2Goals != null ? prev.team2Goals : 0);
            const newTotal = entry.g1 + entry.g2;
            // Score back to 0 (e.g. a goal was cancelled) -> clear the list.
            if (newTotal === 0) { entry.scorers = []; continue; }
            // No change and the stored list is already complete -> reuse, no extra call.
            if (newTotal === prevTotal && prevScorers.length === newTotal) {
                entry.scorers = prevScorers;
                continue;
            }
            const keyEvents = await fetchEspnSummary(entry.espnEventId);
            entry.scorers = parseEspnGoals(keyEvents, { homeName: entry.homeName, homeIsT1: entry.homeIsT1 });
        }
    }
    console.log(`Classified: ${finished.length} finished, ${live.length} live.`);

    let groups = {}, bets = {}, specialBets = {};
    if (finished.some(f => !f.m.noPoints)) {
        [groups, bets, specialBets] = await Promise.all([
            fbGet('groups', token), fbGet('bets', token), fbGet('specialBets', token),
        ]);
    }
    const updates = buildResultUpdates({ finished, live, groups: groups || {}, bets: bets || {}, specialBets: specialBets || {}, now });

    if (Object.keys(updates).length === 0) { console.log('Nothing to write.'); reportStale(staleUnmatched); return; }
    if (DRY_RUN) { console.log(`DRY RUN — ${Object.keys(updates).length} path(s):\n${JSON.stringify(updates, null, 2)}`); reportStale(staleUnmatched); return; }
    await fbPatch(updates, token);
    console.log(`Wrote ${Object.keys(updates).length} path(s) (${finished.length} finished, ${live.length} live).`);
    reportStale(staleUnmatched);
}

// Throws (fails the run) when matches are well past kickoff with no usable auto result.
function reportStale(staleUnmatched) {
    if (staleUnmatched.length === 0) return;
    throw new Error(
        `${staleUnmatched.length} match(es) past kickoff with no automatic result — ` +
        `enter the result in the admin panel, or fix the team-name/date mapping:\n  ` +
        staleUnmatched.join('\n  '),
    );
}

// One Firebase read of the nodes paul-core needs, build, and patch. Best-effort:
// reuses the same token and the existing fbGet/fbPatch helpers.
async function ensurePaul(token, matches, now) {
  const [users, groups, bets, specialBets, tournament] = await Promise.all([
    fbGet('users', token),
    fbGet('groups', token),
    fbGet('bets', token),
    fbGet('specialBets', token),
    fbGet('settings/tournament', token),
  ]);
  const updates = buildPaulUpdates({
    users: users || {},
    groups: groups || {},
    matches: matches || {},
    bets: bets || {},
    specialBets: specialBets || {},
    tournament: tournament || {},
    now,
  });
  const n = Object.keys(updates).length;
  if (n === 0) { console.log('Paul: nothing to write.'); return; }
  if (DRY_RUN) { console.log(`Paul DRY RUN — ${n} path(s):\n${JSON.stringify(updates, null, 2)}`); return; }
  await fbPatch(updates, token);
  console.log(`Paul: wrote ${n} path(s).`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
