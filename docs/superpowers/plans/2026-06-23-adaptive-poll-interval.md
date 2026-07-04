# Quota-Aware Updater Poll Interval — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the updater poll every 5 min when API-Football quota is healthy and every 10 min when it's low, deciding automatically each loop iteration — no manual toggling.

**Architecture:** A pure `choosePollSeconds(remaining)` helper + a thin `poll-seconds.mjs` script that reads the free `/status` endpoint and prints the interval. The GitHub Actions poll loop becomes deadline-bounded and calls that script to pick its sleep each iteration (auto-reverting today's temporary fixed 10-min).

**Tech Stack:** Node ES modules (`scripts/`, `node --test`); GitHub Actions bash.

## Global Constraints

- `POLL_LOW_QUOTA_THRESHOLD = 30`; `choosePollSeconds(remaining)` returns `300` when `Number.isFinite(remaining) && remaining >= 30`, else `600` (low OR unknown → conservative 10-min).
- `/status` is free (doesn't consume quota): `GET https://v3.football.api-sports.io/status` with header `x-apisports-key: <FOOTBALL_API_KEY>`; `remaining = response.requests.limit_day - response.requests.current`.
- `poll-seconds.mjs` prints exactly `300` or `600` to stdout; any failure (no key, network, non-OK, malformed) → `600`.
- Workflow loop stays bounded ~5.5h, keeps `set +e`, the `LOOP_IDLE` early-break, and `exit $last`; `timeout-minutes: 350` retained.
- Backend/CI only — no frontend change, no `index.html` bump.
- Tests run with bare `node --test tests/<file>` (NOT `node --test tests/`).

---

### Task 1: `choosePollSeconds` helper + `poll-seconds.mjs` script

**Files:**
- Create: `scripts/lib/poll-interval.mjs`
- Create: `scripts/poll-seconds.mjs`
- Test: `tests/poll-interval.test.mjs`

**Interfaces:**
- Produces: `choosePollSeconds(remaining: number): 300 | 600`, `POLL_LOW_QUOTA_THRESHOLD = 30` (from `scripts/lib/poll-interval.mjs`); a runnable `scripts/poll-seconds.mjs` that prints `300`/`600`.

- [ ] **Step 1: Write the failing test**

Create `tests/poll-interval.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choosePollSeconds, POLL_LOW_QUOTA_THRESHOLD } from '../scripts/lib/poll-interval.mjs';

test('POLL_LOW_QUOTA_THRESHOLD is 30', () => {
  assert.equal(POLL_LOW_QUOTA_THRESHOLD, 30);
});
test('choosePollSeconds: healthy quota -> 300 (5 min)', () => {
  assert.equal(choosePollSeconds(50), 300);
  assert.equal(choosePollSeconds(30), 300);   // boundary: >= threshold
});
test('choosePollSeconds: low quota -> 600 (10 min)', () => {
  assert.equal(choosePollSeconds(29), 600);
  assert.equal(choosePollSeconds(0), 600);
});
test('choosePollSeconds: unknown remaining -> 600 (conservative)', () => {
  assert.equal(choosePollSeconds(undefined), 600);
  assert.equal(choosePollSeconds(NaN), 600);
  assert.equal(choosePollSeconds(null), 600);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/poll-interval.test.mjs`
Expected: FAIL — `Cannot find module '../scripts/lib/poll-interval.mjs'`.

- [ ] **Step 3: Create the pure helper**

Create `scripts/lib/poll-interval.mjs`:

```js
// Choose the updater poll cadence from the remaining API-Football daily quota.
// 5 min (300s) when quota is healthy; 10 min (600s) when low OR unknown (conservative).
export const POLL_LOW_QUOTA_THRESHOLD = 30;

export function choosePollSeconds(remaining) {
    return (Number.isFinite(remaining) && remaining >= POLL_LOW_QUOTA_THRESHOLD) ? 300 : 600;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/poll-interval.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Create the I/O script**

Create `scripts/poll-seconds.mjs`:

```js
// Prints the updater's next poll interval in seconds (300 or 600), chosen from the
// remaining API-Football quota via the FREE /status endpoint (does not consume quota).
// Any failure -> 600 (conservative). Called by the GitHub Actions poll loop.
import { choosePollSeconds } from './lib/poll-interval.mjs';

const KEY = process.env.FOOTBALL_API_KEY;

async function remainingQuota() {
    if (!KEY) return undefined;
    try {
        const res = await fetch('https://v3.football.api-sports.io/status', {
            headers: { 'x-apisports-key': KEY },
        });
        if (!res.ok) return undefined;
        const json = await res.json();
        const r = json && json.response && json.response.requests;
        if (!r || typeof r.current !== 'number' || typeof r.limit_day !== 'number') return undefined;
        return r.limit_day - r.current;
    } catch {
        return undefined;
    }
}

console.log(choosePollSeconds(await remainingQuota()));
```

- [ ] **Step 6: Syntax-check the script and verify the no-key path**

Run: `node --check scripts/poll-seconds.mjs && node scripts/poll-seconds.mjs`
Expected: `node --check` exits 0 (no output); the run prints `600` (no `FOOTBALL_API_KEY` in the local env → conservative default). This confirms the script runs and falls back safely without needing the secret. (In CI the key is present and it will print `300`/`600` from live quota.)

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/poll-interval.mjs scripts/poll-seconds.mjs tests/poll-interval.test.mjs
git commit -m "feat: choosePollSeconds + poll-seconds.mjs (quota-aware poll cadence)"
```

---

### Task 2: Adaptive poll loop in the workflow

**Files:**
- Modify: `.github/workflows/update-results.yml` (the "Poll finished + live matches" step, ~lines 28-51)

**Interfaces:**
- Consumes: `scripts/poll-seconds.mjs` (Task 1) and the existing `scripts/update-results.mjs`.

- [ ] **Step 1: Replace the fixed-cadence loop with an adaptive, deadline-bounded loop**

In `.github/workflows/update-results.yml`, find the step (it currently holds the temporary fixed 10-min loop):

```yaml
      - name: Poll finished + live matches (~10-min cadence, up to ~5.5h)
        run: |
          # TEMPORARY: 10-min cadence to conserve API-Football quota (revert to 5 min /
          # sleep 300 / seq 66 after the daily quota renewal at 00:00 UTC).
          # Poll every 10 min for up to ~5.5h. set +e so a single failing iteration
          # (transient blip / stale-red) never aborts the loop; we exit with the LAST
          # iteration's status (persistent issue -> red, recovered transient -> green).
          # The script prints LOOP_IDLE when no match is live and none starts within
          # ~2h — we end the run early then so the runner isn't held open all night
          # (the cron re-triggers before the next match).
          set +e
          last=0
          for i in $(seq 1 33); do
            echo "::group::poll $i/33 ($(date -u +%H:%M:%S)Z)"
            out=$(node scripts/update-results.mjs 2>&1); last=$?
            printf '%s\n' "$out"
            echo "::endgroup::"
            if printf '%s' "$out" | grep -q 'LOOP_IDLE'; then
              echo "No live game and none within ~2h — ending run early; cron will re-trigger."
              break
            fi
            [ "$i" -lt 33 ] && sleep 600
          done
          exit $last
```

Replace it with:

```yaml
      - name: Poll finished + live matches (~adaptive 5/10-min by quota, up to ~5.5h)
        run: |
          # Adaptive cadence: poll every 5 min when API-Football quota is healthy, every
          # 10 min when it's low — scripts/poll-seconds.mjs decides from the FREE /status
          # endpoint each iteration (auto-throttles, and auto-recovers after the daily
          # 00:00 UTC reset). set +e so a single failing iteration (transient blip /
          # stale-red) never aborts the loop; we exit with the LAST iteration's status.
          # The script prints LOOP_IDLE when no match is live and none starts within ~2h —
          # we end the run early then (the cron re-triggers before the next match).
          set +e
          last=0
          end=$(( $(date +%s) + 19800 ))   # ~5.5h wall-clock deadline (interval varies)
          i=0
          while [ "$(date +%s)" -lt "$end" ]; do
            i=$((i+1))
            echo "::group::poll $i ($(date -u +%H:%M:%S)Z)"
            out=$(node scripts/update-results.mjs 2>&1); last=$?
            printf '%s\n' "$out"
            echo "::endgroup::"
            if printf '%s' "$out" | grep -q 'LOOP_IDLE'; then
              echo "No live game and none within ~2h — ending run early; cron will re-trigger."
              break
            fi
            sleep_s=$(node scripts/poll-seconds.mjs 2>/dev/null || echo 600)
            echo "next poll in ${sleep_s}s"
            sleep "$sleep_s"
          done
          exit $last
```

(Leave the following `env:` block and everything after it unchanged.)

- [ ] **Step 2: Sanity-check the workflow loop**

Run:
```bash
W=.github/workflows/update-results.yml
grep -q 'scripts/poll-seconds.mjs' "$W" && grep -q 'while \[' "$W" \
  && ! grep -qE 'TEMPORARY|seq 1 33' "$W" \
  && echo "workflow loop OK"
```
Expected: `workflow loop OK` (poll-seconds wired in, deadline `while` loop present, temporary fixed-10-min loop gone).

- [ ] **Step 3: Confirm the referenced scripts exist and parse**

Run: `node --check scripts/poll-seconds.mjs && test -f scripts/lib/poll-interval.mjs && echo "scripts present"`
Expected: `scripts present`.

- [ ] **Step 4: Full unit run (no regressions)**

Run: `node --test tests/poll-interval.test.mjs tests/results-core.test.mjs tests/paul-core.test.mjs tests/pure-logic.test.js`
Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/update-results.yml
git commit -m "chore: adaptive poll cadence (5/10-min by quota) in updater workflow"
```

---

## Notes for the implementer

- CI/backend only — no `index.html` version bump, no frontend change.
- The workflow change cannot be run end-to-end locally (needs the runner + secrets). Verify by inspection + the YAML sanity check + that the referenced scripts parse.
- `node scripts/poll-seconds.mjs` with no `FOOTBALL_API_KEY` must print `600` (the conservative default) — that's the local verification path; do not put the secret in any committed file.
- This change supersedes today's temporary fixed 10-min loop; after merge the updater self-manages its cadence and reverts to 5-min automatically once the quota resets.
