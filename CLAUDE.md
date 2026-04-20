# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Hebrew-first (RTL) World Cup 2026 prediction app for friend-groups. Users join a group with an invite code, predict match scores + tournament winner + golden-boot scorer, and compete on a per-group leaderboard. Deployed as a static site on GitHub Pages at `mondial.guru` (see `CNAME`); data lives in Firebase Realtime Database (project `worldcup2026-dd327`, root node `worldcup2026/`).

## Running & deploying

There is no build system, bundler, package manager, linter, or test suite. It's four files loaded directly by the browser.

- **Local dev:** `python3 -m http.server 8000` from repo root, then open `http://localhost:8000/`.
- **Deploy:** `git push origin main` — GitHub Pages auto-publishes. Changes to Firebase rules/data are made via the Firebase Console.
- **Cache-busting:** `index.html` loads `app.js`, `i18n.js`, and `styles.css` with a `?v=YYYYMMDDx` query string. When you ship JS/CSS changes, bump all three version strings in `index.html` or returning users will see stale assets.
- **Admin panel:** append `?admin` to the URL (`http://localhost:8000/?admin`). Password lives in Firebase at `settings/adminPassword`, fallback `admin2026`. Admin UI is a completely separate code path gated on the query param in `app.js:198-204`.

## Architecture

Single-page app, no modules, no framework. All screens (`login-screen`, `group-picker-screen`, `main-app`, `admin-panel`, plus modals) are in `index.html` and shown/hidden with a `.hidden` class. App state is held in module-level `let`s at the top of `app.js`.

### Files
- `app.js` — everything. ~2000 lines, organized with `// ===` banner comments into: State, Firebase listeners, Auth, Tabs, Render (matches/leaderboard/my-bets/tournament), Bet actions, Tournament, Admin (matches/users/groups/tournament), Seed matches, Group management, Helpers.
- `firebase-config.js` — initializes `db` as a global. API key is embedded (it's a Firebase web config, not a secret in the traditional sense; Firebase enforces access via database rules).
- `i18n.js` — `TRANSLATIONS` table + `t(key)` + `translateTeam(hebName)` + `currentLang`. Languages: `he` (default, RTL), `en`, `es`.
- `styles.css` — all styles, RTL-aware.

### Firebase data model (all paths rooted at `worldcup2026/`)

```
users/{userId}                 → { name, email }
groups/{groupId}               → { name, ownerId, inviteCode, logoUrl?, createdAt,
                                   members: { {userId}: { joinedAt, totalPoints } } }
userGroups/{userId}/{groupId}  → true                       (inverted index)
inviteCodes/{code}             → groupId                    (lookup for join flow)
matches/{matchId}              → { team1, team2, date, group, stage, status,
                                   result?: { team1Goals, team2Goals } }
bets/{groupId}/{userId}/{matchId}
                               → { team1Goals, team2Goals, placedAt, points }
specialBets/{groupId}/{userId}/{winner|topScorer}
                               → { team|player, placedAt, points }
settings/tournament            → { teams, scorers, winner, topScorer }
settings/adminPassword         → string
```

**`userId` is derived from email** via `emailToId(email)` in `app.js:142`: lowercase then replace `.#$[]/` with `_`. So `foo@bar.com` → `foo@bar_com`. Do NOT introduce a separate id scheme — existing data depends on this.

**Bets and specialBets are scoped per-group.** The same user in two groups has two independent sets of predictions. `groups/{gid}/members/{uid}/totalPoints` is the denormalized sum, rewritten by `recalcMemberTotal()` whenever a result lands.

**Database rules are currently wide-open** (`.read: true, .write: true`) — the frontend is the only enforcement layer. Anyone with the DB URL can read or overwrite everything. Keep this in mind before adding "trusted" admin flows.

### Scoring
- Match prediction: exact score = **3 pts**; correct outcome (win1 / draw / win2) = **1 pt**; else 0. See `calcPoints()` in `app.js:93`.
- Tournament champion and top scorer: **10 pts** each (`TOURNAMENT_POINTS` in `app.js:123`).
- Result entry (admin) triggers `recalcPoints(matchId, …)` which rewrites every user's `bets/{gid}/{uid}/{matchId}/points` and then `recalcMemberTotal()` for each affected member.

### Time and locking — gotcha

Match dates in Firebase are stored as naive strings like `"2026-06-11T19:00"` with **no timezone suffix**. They are meant as **Israeli local time (IDT = UTC+3)**. `parseMatchDate()` in `app.js:148` appends `+03:00` before parsing — always use this helper, never `new Date(m.date)` directly, or the value will be interpreted as the viewer's local zone.

- **Match bet lock:** 1 hour before kickoff (`matchIsLocked`, `app.js:162`).
- **Tournament bet lock:** 1 hour before the *first* match of the tournament — i.e. once group stage opens, tournament winner/top-scorer are frozen (`tournamentLockTime`, `app.js:748`).

### Adding or changing teams / scorer candidates

The team list is hardcoded in two places in `app.js`:
- `TEAM_FLAGS` (`app.js:16`) — Hebrew name → emoji flag.
- `PARTICIPATING_TEAMS` (`app.js:44`) — the 48-team canonical list used for the champion dropdown.

Top-scorer candidates live in `TOP_SCORER_CANDIDATES` (`app.js:66`) — prefilled, not admin-managed (the old scorers admin UI was removed).

Hebrew is the canonical form in the DB. `translateTeam(hebName)` in `i18n.js` resolves display in the active language; if you add a team, add translations in all three languages there too.

### Admin seed

`adminSeedMatches()` (`app.js:1504`) writes the 72 group-stage fixtures to `/matches`. It does not populate knockout rounds — those are added manually post-group-stage via the admin "Add match" form.
