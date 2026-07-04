// Twice-daily fixture sync: pull upcoming scheduled knockout games from football-data.org and
// insert any new, determined ones into Firebase. Add-only (dedup by team pair). Finals, live
// scores, and points are handled by scripts/update-results.mjs — this script only inserts
// scheduled match rows.
//
// Env:
//   FOOTBALL_DATA_TOKEN  (required) football-data.org API token.
import { mapScheduledFixtures } from './lib/results-core.mjs';

const FD_TOKEN = process.env.FOOTBALL_DATA_TOKEN;
const FB_KEY   = 'AIzaSyAyOY_It3oq3Q4ferO_zE23sFLJ_bUZB9g'; // public Firebase web API key
const DB       = 'https://mondial2026-a77fc-default-rtdb.firebaseio.com';
const ROOT     = 'worldcup2026';
const WINDOW_END = Date.parse('2026-07-22T00:00:00Z');

async function signIn() {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' });
    if (!r.ok) throw new Error(`Firebase sign-in failed: HTTP ${r.status}`);
    return (await r.json()).idToken;
}
const utcDay = ms => new Date(ms).toISOString().slice(0, 10);

async function main() {
    if (!FD_TOKEN) throw new Error('FOOTBALL_DATA_TOKEN is not set');
    const now = Date.now();
    if (now > WINDOW_END) { console.log('Outside tournament window; nothing to do.'); return; }

    const token = await signIn();
    const url = `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${utcDay(now)}&dateTo=${utcDay(WINDOW_END)}`;
    const res = await fetch(url, { headers: { 'X-Auth-Token': FD_TOKEN } });
    if (!res.ok) { console.warn(`football-data request failed (HTTP ${res.status}); skipping this run.`); return; }
    const fdMatches = (await res.json()).matches || [];

    // Abort if we can't read the current matches — proceeding with an empty set would
    // disable the team-pair dedup and risk inserting near-duplicate fixture rows.
    const existingRes = await fetch(`${DB}/${ROOT}/matches.json?auth=${token}`);
    if (!existingRes.ok) { console.warn(`Could not read existing matches (HTTP ${existingRes.status}); skipping this run to avoid duplicates.`); return; }
    const existingMatches = (await existingRes.json()) || {};
    const toAdd = mapScheduledFixtures({ fdMatches, existingMatches, now, windowEndMs: WINDOW_END });

    if (toAdd.length === 0) {
        console.log(`No new fixtures to add (scanned ${fdMatches.length} football-data matches).`);
        return;
    }
    const updates = {};
    for (const { key, match } of toAdd) updates[`matches/${key}`] = match;
    const patch = await fetch(`${DB}/${ROOT}.json?auth=${token}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    if (!patch.ok) throw new Error(`Firebase PATCH failed: HTTP ${patch.status} ${await patch.text()}`);
    console.log(`Added ${toAdd.length} fixture(s):`);
    for (const { match } of toAdd) console.log(`  [${match.stage}] ${match.team1} vs ${match.team2} @ ${match.date}Z`);
}

main().catch(err => { console.error('sync-fixtures failed:', err.message); process.exit(1); });
