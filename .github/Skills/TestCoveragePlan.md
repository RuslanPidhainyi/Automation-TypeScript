# Test Coverage Plan — EW TravelApp

Living document. It records what we are covering, where the framework actually stands, which files are in
play, what has landed, which approaches already failed, and what to write next.

Companion to [`RulesForDescribingAPage.md`](./RulesForDescribingAPage.md), which owns the page-object
conventions. This file owns the **specs**.

> Sections *Changes made* and *Failed attempts* are **append-only**. Every session adds to them instead of
> rewriting history.

---

## 1. Goal

Cover the Angular 17 client of EW TravelApp with Playwright end-to-end tests, split into independently
runnable layers with a clear promotion path.

| Layer | Question it answers | Budget | Runs |
| --- | --- | --- | --- |
| **healthCheck** | Is the stack up and are the contracts intact? | < 30 s | before everything, gates the rest |
| **smoke** | Does every core happy path still work? | < 5 min, chromium | on every PR |
| **regression** | Does the whole behaviour still hold, including negatives? | unbounded, 3 browsers | nightly |
| **e2e** | Does the UI's data actually match what's persisted in the database? | unbounded, chromium, needs direct SQL Server access | nightly, alongside regression |

`e2e` (`specs/tests/e2e/`) is younger than the other three and answers a narrower question than its name
suggests: not "does the app work end to end" (`healthCheck`/`smoke`/`regression` already cover that from the
UI's side) but specifically "is what the UI just did actually committed to the database" — see §7.

"Covered" means:

- **All 14 routes** of `Client/src/app/app.routes.ts` reachable and asserted at least at smoke level.
- **Eight functional domains** exercised at regression level: auth, offers CRUD, likes/lists, profile &
  photos, messaging, admin & roles, error handling, navigation & guards.
- **Health** checks both sides: the API contract directly over HTTP, and the client's availability in a
  browser — no business scenarios.

### Test data strategy

- **Read-only tests** use the seeded accounts (see *Application under test* below) and must leave no trace.
- **State-changing tests** (registration, add/edit/delete post, messages, photos, roles) create their own data
  through the API and clean up after themselves. They never depend on another test's leftovers.

### Non-goals

- Unit/component tests of Angular — that is `ng test` inside `Client/`.
- Load and performance testing — the `k6-tests/` folder in the application repo owns that.
- Testing the .NET API in isolation beyond the health probes; the API is covered through the UI.
- Using direct SQL to **arrange** test state. §7's DB access is read-only verification bolted onto
  scenarios that still go through the UI/API to create data — never a shortcut to seed or mutate rows
  directly, which would stop the test from being end-to-end at all.

---

## 2. Current state

| Area | State |
| --- | --- |
| Page-object layer | ✅ **Complete** — 15 files under `src/PageObjects/` (renamed from `src/Pages/`), 14/14 routes, documented in `RulesForDescribingAPage.md` |
| `specs/support/` | ✅ `env.ts` (URLs, credentials, `MEMBER`/`ADMIN`, `TEST_USER_1..5`, `AUTH_STRATEGY`, `FIXTURES`), `ApiClient.ts`, `auth.ts` + `auth.setup.ts`, `signIn.ts`, `index.ts` barrel |
| `specs/fixtures/` | ✅ `travel-photo.jpg` (800×600, ~25 kB, generated) + `README.md` |
| `specs/tests/healthCheck/` | ✅ **`testApi.spec.ts` + `testApp.spec.ts` + `testAuth.spec.ts` — 23 checks in 3 files** |
| `specs/tests/smoke/` | ✅ **Complete** — 8 files, 11 checks (`[ID: 23]`–`[ID: 33]`), all green on chromium in ~20 s |
| `specs/tests/regression/` | ✅ **Complete** — 7 domain folders, 11 files, 39 checks (`[ID: 34]`–`[ID: 72]`), all green on chromium |
| `specs/tests/e2e/` | ✅ **4 files, 4 checks (`[ID: 73]`–`[ID: 76]`)**, all green on chromium — UI ⇒ API ⇒ DB parity for the member profile, likes, post CRUD (+ FK cascade), and admin roles. See §7. |
| `src/helpers/db/mssql.helper.ts`, `src/constants/queries/mssql/*.queries.ts` | ✅ Implemented — see §7 |
| `playwright.config.ts` | ✅ `testDir: './specs/tests'`, `baseURL`, `ignoreHTTPSErrors`, `setup` + one project per layer + a `Google Chrome` branded-browser project |
| `scripts/run-tests.js` | ✅ pytest-flag CLI shim (`-v/-s`, `-k`, `--tracing=`) in front of `playwright test`; `npm test`/`test:*` go through it |
| `.env` | ✅ filled - the only env file since 2026-09-13 (`.env.example` removed, *Changes made* #20); `dotenv` and `typescript` installed |
| CI workflow | ⚠️ exists, but starts neither the API nor the client — cannot pass |
| Git | one commit on `master` (`a8af238`); everything since — page objects, support layer, health tests, both Skills docs, the CLI shim — is staged/untracked, uncommitted |

**The former blocking fact is gone:** `testDir` now resolves, `npx playwright test --list` reports
**23 tests in 3 files** for the health layer (48 across every project Playwright discovers, since the
unscoped `Google Chrome` project also picks up `specs/tests/**` and the `setup` project adds 2 more),
`tsc --noEmit` is clean, and `npm run test:health -- --project=health` was just re-run against a live
stack — **23/23 green in 11.7 s**, comfortably inside the 30 s budget.

**Environment note for the first local run:** `API/appsettings.Development.json` sets `Data:Connection` to
`DESKTOP-SKA2QVA\SQLEXPRESS`, which does not resolve on every machine. Override it without touching the
file — ASP.NET Core reads `Data__Connection` from the environment:

```bash
# API/  - creates and seeds the TravelApp database on first run
Data__Connection="Data Source=.\SQLEXPRESS;Integrated Security=true;Database=TravelApp;Trust Server Certificate=true" \
  ASPNETCORE_ENVIRONMENT=Development dotnet run --no-launch-profile --urls "https://localhost:5001;http://localhost:5000"
# Client/
npm start
```

`--no-launch-profile` matters: `API/Properties/launchSettings.json` has a trailing comma after the `http`
profile, so the file is not valid JSON.

### Application under test

| Piece | Value |
| --- | --- |
| Angular client | `https://localhost:4200` — HTTPS with a **self-signed** cert (`Client/angular.json` → `serve.options.ssl`); `npm start` in `Client/` |
| API | `https://localhost:5001/api/` (also `http://localhost:5000`) — `API/Properties/launchSettings.json` |
| SignalR hubs | `https://localhost:5001/hubs/` — presence + message |
| CORS | `API/Program.cs:33` — only `http://localhost:4200` and `https://localhost:4200` |
| DB seed | `API/Data/Seed.cs`, runs on startup after `MigrateAsync()` |

### Accounts

Specs sign in only as the test accounts below (`.env` → `specs/support/env.ts`). They are not part of the
seed and must already exist in the target database. The seeded accounts (`Lisa` and 9 more from
`API/Data/UserSeedData.json`, plus `admin`) stay in `.env` for manual runs; no spec signs in as them.

| Account | Roles | Used as |
| --- | --- | --- |
| `test_user_1` | — | the other side of the messaging conversation; empty-state checks (no likes, no posts) |
| `test_user_2` | `Member` | the `member` storageState; promote/demote target of the roles modal |
| `test_user_3` | `Moderator` | Moderator checks; e2e liker and e2e roles target |
| `test_user_4` | `Admin` | e2e actor for the profile, likes and posts checks |
| `test_user_5` | `Admin`, `Moderator` | the `admin` storageState |

### Routes and their page objects

| Route | Guard | Page object |
| --- | --- | --- |
| `/` | `redirectAuthenticatedGuard` | `LoginPage`, `RegistrationPage` |
| `/offers` | `authGuard` | `OffersPage` |
| `/offers/:id` | `authGuard` | `OfferDetailsPage` |
| `/members/:username` | `authGuard` | `MemberProfilePage` |
| `/member/profile` | `authGuard` | `ProfilePage` |
| `/member/edit-profile` | `authGuard` + `preventUnsavedChangesGuard` | `EditProfilePage` |
| `/lists` | `authGuard` | `ListsPage` |
| `/messages` | `authGuard` | `MessagesPage` |
| `/add-offer` | `authGuard` | `AddOfferPage` |
| `/edit-offer/:id` | `authGuard` | `EditOfferPage` |
| `/admin` | `adminGuard` | `AdminPage` |
| `/errors` | `adminGuard` | `TestErrorsPage` |
| `/not-found` | — | `NotFoundPage` |
| `/server-error` | — | `ServerErrorPage` |
| `**` | — | `NotFoundPage` |

Guard notes that matter for tests:

- `adminGuard` (`_guards/admin.guard.ts`) admits **`Admin` *or* `Moderator`** and on refusal fires the toast
  `You cannot enter this area` while staying on the current page — it does not redirect.
- The nav bar hides `/errors` from Moderator (`*appHasRole="['Admin']"`) but the guard lets a Moderator in by
  direct URL. **This mismatch is real and should be asserted as current behaviour**, with a note, not silently
  "fixed" in the test.
- `preventUnsavedChangesGuard` uses a **native `confirm()`** dialog — specs must register
  `page.on('dialog', …)` before navigating away.
- Successful login redirects to `/offers` (both from the login card and the nav bar); logout goes to `/`.

### API surface

`account/register`, `account/login` · `posts` GET, `posts/{id}`, `posts/user/{username}`, `posts/add-post`
(POST multipart), `posts/edit-post/{id}` (PUT), `posts/delete-post/{id}` (DELETE) · `users` GET/PUT,
`users/{username}`, `users/add-photo`, `users/set-main-photo/{id}`, `users/delete-photo/{id}` ·
`likes/{postId}` (POST), `likes/list`, `likes?predicate=liked` · `messages` POST/GET,
`messages/thread/{username}`, `messages/{id}` (DELETE) · `admin/users-with-roles`,
`admin/edit-roles/{username}`, `admin/contents-to-moderate` · `buggy/auth|not-found|server-error|bad-request`.

Everything except `account/*` and the unauthenticated `buggy/*` probes is `[Authorize]`.
`BuggyController` gives deterministic status codes — ideal health probes.

---

## 3. Active files

### Application under test (read-only for us)

| Path | Role | Status |
| --- | --- | --- |
| `Client/src/app/app.routes.ts` | source of truth for routes and guards | stable |
| `Client/src/app/_guards/*.ts` | guard behaviour asserted in regression | stable |
| `Client/src/environments/environment.development.ts` | `apiUrl`, `hubsUrl` | stable |
| `Client/angular.json` | HTTPS dev-server config | stable |
| `API/Data/Seed.cs`, `API/Data/UserSeedData.json` | credentials and fixture data | stable |
| `API/Controllers/*.cs` | endpoints for health probes and fixtures | stable |

### Framework

| Path | Role | Status |
| --- | --- | --- |
| `src/PageObjects/index.ts` | barrel — specs import only from here (header comment still says the old `src/Pages` path, harmless) | stable |
| `src/PageObjects/BasePage.ts` | routing, waits, nav bar, toasts, `appUrl()`/`BASE_URL` | stable |
| `src/PageObjects/widgets.ts` | shared markup blocks | stable |
| `src/PageObjects/**/*.page.ts` (14) | one per route | stable |
| `specs/support/env.ts` | `CLIENT_URL`, `API_URL`, `apiUrl()`, `MEMBER`, `ADMIN`, `TEST_USER_1..5`, `AUTH_STRATEGY`, `FIXTURES` | stable |
| `specs/support/ApiClient.ts` | login → token → authorised requests, `decodeJwt`/`rolesOf` | stable |
| `specs/support/auth.ts` | `STORAGE_STATE.member` / `.admin` paths, `CREDENTIALS` | stable |
| `specs/support/auth.setup.ts` | the `setup` project — signs in per role via `AUTH_STRATEGY` (`ui`/`token`), saves the state | stable |
| `specs/support/signIn.ts` | `signInThroughUi` / `signInWithToken` — the same two strategies, callable directly from a spec (used by the sign-in health probes) | stable |
| `specs/support/index.ts` | barrel — specs import only from here | stable |
| `specs/fixtures/travel-photo.jpg` | upload fixture, reached through `FIXTURES.photo` | stable |
| `specs/tests/healthCheck/testApi.spec.ts`, `testApp.spec.ts`, `testAuth.spec.ts` (3) | the health layer | stable |
| `specs/tests/smoke/*.spec.ts` (8) | the smoke layer | stable |
| `specs/tests/regression/**/*.spec.ts` (11, across `auth/`, `guards-and-errors/`, `offers/`, `profile-and-photos/`, `likes-and-lists/`, `messaging/`, `admin/`) | the regression layer | stable |
| `specs/tests/e2e/*.spec.ts` (4: `testProfileDb`, `testLikesDb`, `testOffersDb`, `testRolesDb`) | the e2e layer — UI ⇒ API ⇒ DB parity, see §7 | stable |
| `src/helpers/browserHealth.helper.ts` | `isNoise`/`isOwnOrigin` — console/network noise predicates for `testApp.spec.ts` | stable |
| `src/helpers/dragAndDrop.helper.ts` | `dropFiles` — simulates an HTML5 file drop for zones with no backing `<input>`, used by `fileUploader().dropFiles()` | stable |
| `src/helpers/db/mssql.helper.ts` | `runMssqlQuery`/`closeMssqlPool` — pooled `mssql/msnodesqlv8` connection, see §7.3 | stable |
| `src/constants/queries/mssql/{users,likes,posts,roles}.queries.ts` | SQL text for the e2e layer, per `RulesForWritingTests.md` §2 | stable |
| `scripts/run-tests.js` | pytest-flag CLI shim in front of `playwright test`, invoked by every `npm run test:*` script | stable |

### Config & CI

| Path | Role | Status |
| --- | --- | --- |
| `playwright.config.ts` | `testDir`, `baseURL`, one project per layer plus `seed-users`, a CI pipeline of `dependencies`, CI reporters, `webServer` behind `START_STACK=1`, and `Google Chrome` repeating smoke in the branded browser | stable |
| `.env` | credentials, URLs and the optional settings (`AUTH_STRATEGY`, `TIMEOUT_MULTIPLIER`, `DB_CONNECTION_STRING`, `START_STACK`, `APP_DIR`, `DB_DRIVER` and the `DB_*` keys `tedious` reads) — the only env file, git-ignored | done |
| `package.json` | `test` / `test:health` / `test:smoke` / `test:regression` / `typecheck` now run through `scripts/run-tests.js`, `dotenv`, `typescript` | stable |
| `scripts/run-tests.js` | pytest-flag shim (`-v`/`-s`, `-k`, `--tracing=`) in front of `playwright test` | stable |
| `tsconfig.json` | TS config — `include` still lists the deleted `tests/`, harmless | stable |
| `.github/workflows/playwright.yml` | CI - SQL Server service container, both repositories, the stack through `webServer`, one pipeline run on push/PR, regression in three browsers nightly | done; needs the GitHub secrets from `README.md`, "CI" |
| `README.md` | prerequisites, the layers, structure, CI and its secrets | stable |

### Docs

| Path | Role | Status |
| --- | --- | --- |
| `.github/Skills/RulesForDescribingAPage.md` | page-object conventions | stable |
| `.github/Skills/RulesForWritingTests.md` | spec-file conventions — locators/DB/helpers/describe/ID/tags | stable |
| `.github/Skills/TestCoveragePlan.md` | this file | living |

---

## 4. Changes made

Append new entries at the bottom.

1. **Scaffolded the framework** — Playwright 1.61 + TypeScript, `npm test` / `test:headed` / `test:ui` /
   `test:debug` / `report` scripts, default CI workflow. Commit `a8af238`.
2. **Built the page-object layer over all 14 routes.** `BasePage` centralises routing, waiting, the nav bar
   and toasts (Template Method); `widgets.ts` factories remove the duplication — the biggest win is
   `postForm`, since `add-offer.component.html` and `edit-offer.component.html` are ~200 identical lines
   differing only by the `add-post-*` / `edit-post-*` class prefix and the submit caption.
3. **Wrote `RulesForDescribingAPage.md`** — folder/naming rules, the locator preference order, and the
   client-side constraints discovered while building the locators.
4. **Created `specs/tests/healthe`, `specs/tests/smoke`, `specs/tests/regression`.** Still empty.
5. **Deleted the generated `tests/example.spec.ts`** — without updating `testDir`, which is why the suite
   currently discovers nothing (see *Failed attempts*).
6. **Wrote this document** — coverage goal, current state, and the ordered backlog below.
7. **Landed Step 0 (runner + configuration).** `testDir: './specs/tests'`; `baseURL` and
   `ignoreHTTPSErrors` in `use`; the three browser projects replaced by four layer projects — `health`
   (15 s timeout, chromium), `smoke` (chromium), `regression-chromium|firefox|webkit` — each scoped by its
   own `testDir`. `dotenv` installed and wired at the top of the config; `.env` filled and `.env.example`
   committed; `npm run test:health|test:smoke|test:regression|typecheck` added. `typescript` pinned to `^5`
   — TS 7 dropped `moduleResolution: node10` and refuses the existing `tsconfig.json`, and changing the TS
   config was not worth it for a type check. `README.md` rewritten around the three layers.
   `npx playwright test --list` now reports **13 tests in 2 files**, `tsc --noEmit` is clean.
8. **Wrote the health layer** — `specs/support/` (`env.ts`, `ApiClient.ts`, `index.ts`) plus
   `specs/tests/healthCheck/api.health.spec.ts` (10 checks) and `app.health.spec.ts` (3 checks). Beyond the
   table in §6.1 the API spec also asserts the **admin token carries `Admin` + `Moderator`** (proves the
   three roles were seeded, which the whole `admin/` regression domain depends on), **`GET posts` with a
   token returns a non-empty list** (proves the seed ran and the repository reaches the database) and the
   **`ApiException` shape of a 500** (`statusCode` / `message`, camel-cased — the contract
   `server-error.component.html` reads through `error.message`). The client spec probes the API with
   `fetch` *inside the page*, because CORS (`API/Program.cs:33`) only ever applies to a request that carries
   an `Origin` header — the `request`-fixture probes cannot see it. Verified against a live stack:
   13/13 green, 8.8 s cold and 4.6 s warm. The `IGNORED_NOISE` list in `app.health.spec.ts` turned out to
   need nothing beyond the dev-server entries — the client loads `/` with a clean console.
9. **Closed the two Step 0 leftovers.** A `setup` project (`specs/support/auth.setup.ts`, `testMatch:
   /.*\.setup\.ts$/`) signs in as the member and as the admin **through the UI** and saves
   `playwright/.auth/{member,admin}.json`; `smoke` and every `regression-*` project declares
   `dependencies: ['setup']`, while `health` deliberately does not — the gate must run when nothing else
   can. The state is not forced on the projects: a spec opts in per file with
   `test.use({ storageState: STORAGE_STATE.member })`, which leaves the anonymous specs (login, register,
   guards) free to live in the same project. UI login rather than planting a token costs ~3 s per run and
   in exchange writes exactly what the client itself writes — the whole session is `localStorage['user']`
   (`account.service.ts` → `setCurrentUser`, restored by `AppComponent.ngOnInit`), so no cookie is
   involved. `specs/fixtures/travel-photo.jpg` (800×600, ~25 kB) is **generated**, not a stock photo — the
   script that draws it is in `specs/fixtures/README.md`; specs reach it through `FIXTURES.photo`, since
   `setInputFiles` resolves relative paths against the process working directory. Verified live with a
   throwaway spec, then deleted: member state opens `/offers` signed in without an `Admin` nav entry,
   `/member/profile` shows `lisa`, admin state passes `adminGuard` on `/admin`, and the fixture is a real
   JPEG (`FF D8 FF`).
10. **Renamed `src/Pages/` to `src/PageObjects/`** (barrel comment inside `src/PageObjects/index.ts` still
    says the old path — cosmetic, not worth a churn commit on its own). Renamed `api.health.spec.ts` →
    `api.spec.ts` and `app.health.spec.ts` → `app.spec.ts`: the `.health.` infix was redundant once the
    file already sits inside `specs/tests/healthCheck/`. Both are now flagged in `RulesForWritingTests.md`
    as legacy names — the convention going forward is `test_<Functionality>.spec.ts` — but renaming them
    again wasn't bundled with this round of changes.
11. **Wrote `.github/Skills/RulesForWritingTests.md`** — the rules a `*.spec.ts` file must follow: no
    inline locators (page objects only), no inline SQL (a `src/constants/queries/mssql/*.queries.ts`
    constant, executed through a `src/helpers/db/*` helper — neither exists yet, both are empty
    placeholders), no ad-hoc helper functions above a `test()` (flow-level helpers belong in
    `specs/support/`, technical ones in `src/helpers/`), one `describe` per file, a `[ID: n] who does what`
    title with a project-wide sequential `n`, matching `{ tag: ['@n', '@healthCheck'|'@smoke'|'@regression'] }`
    tags, and `test_<Functionality>.spec.ts` naming.
12. **Added a second sign-in strategy plus five role-tagged accounts, and used them to write the third
    health file.** `env.ts` gained `AUTH_STRATEGY` (`'ui' | 'token'`, from the `AUTH_STRATEGY` env var,
    defaults to `ui`) and `TEST_USER_1`..`TEST_USER_5` — one account per role combination (none, Member,
    Moderator, Admin, Moderator+Admin), distinct from `MEMBER`/`ADMIN` so these probes never share a
    session with the `setup` project. `auth.setup.ts` now branches on `AUTH_STRATEGY` internally
    (`signInViaUi` / `signInViaToken`) before saving the `storageState`, so the whole `setup` project can be
    switched to the faster token path without touching any spec. The same two strategies were pulled out
    as standalone, directly callable helpers in the new `specs/support/signIn.ts`
    (`signInThroughUi`/`signInWithToken`) and exercised once per role in
    `specs/tests/healthCheck/testAuth.spec.ts` — 10 tests (`[ID: 0]`–`[ID: 9]`), tagged and titled per
    `RulesForWritingTests.md`, the reference implementation that document points to. `.env.example` was
    only updated for `TEST_USER_1`/`TEST_PASSWORD_1` — see *Failed attempts* below.
13. **Added `scripts/run-tests.js`**, a CLI shim in front of `npx playwright test` translating the
    pytest-style flags the team already reaches for (`-v`/`-s` → `--reporter=list`, `-k <pattern>` →
    `--grep <pattern>`, `--tracing=X` → `--trace=X`; everything else, including `--project=` and a spec
    path, passes through untouched). Every `test`/`test:*` script in `package.json` now calls
    `node scripts/run-tests.js` instead of `playwright test` directly. Added a `Google Chrome` project to
    `playwright.config.ts` (system-installed Chrome via `channel: 'chrome'`, no `testDir`/`dependencies`
    override, so it discovers whatever already exists under `specs/tests/`) as a branded-browser smoke
    check alongside the bundled Chromium the layer projects use.
14. **Re-verified the health layer against a live stack.** `npx playwright test --list` now reports
    **23 tests in 3 files** for `--project=health` (48 total across every project Playwright discovers,
    since the unscoped `Google Chrome` project doubles them and `setup` adds 2 more).
    `npm run test:health -- --project=health` — **23/23 green in 11.7 s**, still comfortably inside the
    30 s budget with the extra 10 sign-in checks folded in.
15. **Brought `api.spec.ts` and `app.spec.ts` into full compliance with `RulesForWritingTests.md`,** the
    last two health-layer files still on the pre-rules shape. Renamed (`git mv`, history preserved) to
    `testApi.spec.ts` / `testApp.spec.ts` per §7 — the note in `RulesForWritingTests.md` flagging them
    as due for this rename is now updated to reflect the completed state. Every test gained its
    project-wide sequential `[ID: n]` (continuing from `testAuth.spec.ts`'s highest, `9`): IDs `10`–`19`
    for the ten checks in `testApi.spec.ts` (the four `probes` loop entries included — each probe object
    now carries its own `id`, so the loop still emits one `idTag`/title per iteration without becoming a
    second function declaration) and `20`–`22` for the three in `testApp.spec.ts`. Both files' single
    `describe` block now carries `{ tag: [LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] }` and every
    test additionally carries `idTag(n)` — all ten `testApi.spec.ts` checks and all three
    `testApp.spec.ts` checks are `@unmutation` (pure reads/probes, no persisted state changes), so each
    file needed only one tag on its `describe`. Extracted `IGNORED_NOISE`, `isNoise` and `isOwnOrigin` out
    of `app.spec.ts` into `src/helpers/browserHealth.helper.ts` — per §3 a spec may contain no function
    declarations of its own beyond `test()` callbacks (the `testApi.spec.ts` `probes` loop is the one
    named exception), and these two predicates have no notion of "a test", making them a `src/helpers/`
    candidate rather than a `specs/support/` one; `isOwnOrigin` now takes `origin` as a parameter instead
    of closing over `CLIENT_URL`, keeping the helper free of a dependency on `specs/support/env`. Updated
    every filename reference in this document and in `README.md`'s single-file run examples. Re-verified
    against a live stack after the rewrite: `tsc --noEmit` clean, `--list` still reports 23 tests in 3
    files with unique IDs, and `npx playwright test --project=health` — **23/23 green in 13.9 s**.
16. **Wrote the smoke layer** — `specs/tests/smoke/testAuth.spec.ts`, `testNavigation.spec.ts`,
    `testOffers.spec.ts`, `testAddOffer.spec.ts`, `testLikes.spec.ts`, `testProfile.spec.ts`,
    `testMessages.spec.ts`, `testAdmin.spec.ts` — 11 checks, `[ID: 23]`–`[ID: 33]`, per the backlog in
    §6.2. `testNavigation.spec.ts` and `testAuth.spec.ts`'s logout check use nested `test.describe`
    blocks to switch `storageState` per role/session within one file, per the "logical group inside a
    larger file" allowance in `RulesForWritingTests.md` §4. `testAddOffer.spec.ts` and
    `testMessages.spec.ts` create their own data and delete it again through the API in `afterEach`
    (`posts/delete-post/{id}`, `messages/{id}`), per the test-data strategy in §1; `testLikes.spec.ts`
    likes and unlikes the same post inside one test instead, so nothing outlives the test at all — tagged
    `@unmutation` rather than `@mutation` for that reason. `testMessages.spec.ts` needed a second seeded
    member as the message recipient (`Jessie`, from `API/Data/UserSeedData.json`) so `MEMBER`/`Lisa` never
    messages herself. Fixed three page-object bugs this layer's first live run exposed (see *Failed
    attempts* below): `AddOfferPage.attachPhoto` now drops the fixture onto the zone instead of calling
    `setInputFiles` on an `<input>` that does not exist (`fileUploader` gained `dropFiles`, backed by a new
    `src/helpers/dragAndDrop.helper.ts`); `AdminPage.userRow` now matches the username against
    `td:first-child` only; `MessagesPage.containerButton` now looks up the accessible role `radio` instead
    of `button`. Verified against a live stack after the fixes: `tsc --noEmit` clean, `--list` reports 13
    tests in 9 files for `--project=smoke` (setup's 2 included), and
    `npm run test:smoke -- --project=smoke` — **11/11 green in ~20 s**, well inside the 5 min budget.
    Confirmed through the API afterwards that `Lisa` has no leftover posts, messages or likes.
17. **Wrote the regression layer** — all seven domains from §6.3, 11 files, 39 checks (`[ID: 34]`–`[ID: 72]`):
    `auth/testRegistration.spec.ts` + `testLogin.spec.ts`, `guards-and-errors/testRouteGuards.spec.ts` +
    `testErrorPages.spec.ts`, `offers/testOfferForm.spec.ts` + `testOfferLifecycle.spec.ts`,
    `profile-and-photos/testEditProfile.spec.ts`, `likes-and-lists/testLikes.spec.ts`,
    `messaging/testMessaging.spec.ts`, `admin/testRoles.spec.ts` + `testPostManagement.spec.ts`.
    Verified against a live stack repeatedly: `tsc --noEmit` clean, **39/39 green on
    `--project=regression-chromium`** (two consecutive full runs), and the health (23/23) and smoke (13/13)
    layers re-verified green afterwards since this round touched shared page objects.
    - Registration and the roles modal were exercised by a test for the first time ever in this framework
      (neither had a single health/smoke check), which is why this entry also lists four real,
      previously-undetected bugs below rather than only new specs.
    - Where the coverage plan's original wording assumed behaviour that a live run disproved, the test
      documents the *actual* behaviour instead of the assumption, same principle as the nav/guard mismatch
      in §2: (a) registering with a taken username shows **no toast at all** — `AccountController.Register`
      returns a plain string body, so `RegisterComponent`'s `error` handler assigns the whole
      `HttpErrorResponse` to `validationErrors: string[]`, and `@for` over it throws
      `newCollection[Symbol.iterator] is not a function` client-side before the interceptor's own toast can
      render (a real, unfixed bug — `testRegistration.spec.ts` `[ID: 39]`); (b) the roles modal's Submit
      button is disabled only when **every** role is unchecked (`RolesModalComponent`:
      `[disabled]="selectedRoles.length === 0"`), not "unchanged from the roles the user opened with" as
      `isSubmitRolesEnabled()`'s name suggests (`testRoles.spec.ts` `[ID: 70]`); (c) clicking "Test 401
      error" on `/errors` while signed in as the admin the page requires gets **200**, not 401 — the
      client's own bearer token is attached to `buggy/auth` automatically, so no "Unauthorised" toast is
      possible from that button in the app as built (`testErrorPages.spec.ts` `[ID: 50]`); (d)
      `PostManagementComponent` is still the scaffolded placeholder (`<p>post-management works!</p>`) — it
      never calls `admin/contents-to-moderate` (`testPostManagement.spec.ts` `[ID: 72]`).
    - Two page-object bugs were fixed, both in code no prior test had ever exercised:
      `AdminPage.rolesModal` looked for `bs-modal-container .modal-content`, but this ngx-bootstrap version
      renders `<modal-container>` (no `bs-` prefix) — every roles-modal interaction hung for the full test
      timeout until this was found via a live DOM dump (`Admin.page.ts`). `MemberProfilePage.message()`'s
      `readMarker` was `root.getByText(/^\(read/)`, anchored to the start of the text; the template renders
      `(read {{...}})` with a leading space, and Playwright does not trim whitespace before testing a
      RegExp the way it does for string matching, so the anchor never matched — dropped to
      `getByText(/\(read/)` (`MemberProfile.page.ts`).
    - The messaging domain needed the most rework to become non-flaky, because `MessageHub` groups by
      **username pair**, not by test or browser context: two tests that each open "Lisa talks to Jessie"
      concurrently join the *same* SignalR group and corrupt each other's read/unread state.
      `testMessagesContainers.spec.ts` and `testMessagesRealtime.spec.ts` were merged into one
      `testMessaging.spec.ts` under a single `test.describe.configure({ mode: 'serial' })` so
      `fullyParallel` can never schedule two of them at once. Cleanup for every created message now deletes
      through **both** parties' tokens — `DELETE messages/{id}` only flags the caller's own side
      (`SenderDeleted`/`RecipientDeleted`), so a single-sided delete (what `testMessages.spec.ts`'s smoke
      cleanup already does) leaves the row sitting in the other party's view forever; this was caught by
      literally finding stray `Regression inbound …` messages still visible in Jessie's own conversation
      view days after her "cleaned up" spec had passed.
    - A second, unrelated concurrency bug: Playwright Test applies whatever `test.use({ storageState })`
      is active for a test as the **default** for *any* `browser.newContext()` called during that test, not
      only the fixture-provided `page`. `testRoles.spec.ts` opens a second context to sign in as
      `test_user_2` while the outer test is signed in as the admin (`STORAGE_STATE.admin`) — an unqualified
      `newContext()` silently opened that second context **already signed in as admin**, and the
      `test_user_2` login attempt then hung forever because `redirectAuthenticatedGuard` never showed the
      login form. Fixed by passing an explicit empty `storageState: { cookies: [], origins: [] }` whenever
      a test that carries a `storageState` needs a second, genuinely anonymous context.
    - `testRoles.spec.ts`'s two mutating tests (`[ID: 69]`, `[ID: 71]`) both promote/demote the same
      shared `test_user_2` account, so that describe block also uses `mode: 'serial'`, with `afterEach`
      unconditionally resetting the account to `Member` alone after every test regardless of outcome.
    - Several assertions hit the same "the shell renders before its data" trap as Failed attempt #11, in
      new places: `EditOfferPage`'s pre-fill (`loadPost()`'s `GET` has not resolved when the submit button
      already has), `OfferDetailsPage`'s optional sections (same story for `getPost`), and
      `MemberProfilePage.messageTexts()` right after `startConversation()` (the hub's
      `ReceiveMessageThread` history has not arrived when the panel is merely visible) — all fixed by
      polling/auto-retrying assertions instead of a single read.
    - Cloudinary-backed photo actions (`testEditProfile.spec.ts` `[ID: 60]`) and the messaging read-receipt
      round trip (`[ID: 68]`, which has to wait out a full second sign-in) both needed longer-than-default
      assertion timeouts (15–20 s) to stop being flaky under normal local load — real round-trip latency,
      not a logic bug. `[ID: 69]`/`[ID: 71]`/`[ID: 60]` also needed `test.setTimeout(60_000–90_000)` on top
      of that — webkit specifically ran noticeably slower than chromium/firefox for the same steps.
    - The most serious bug this round: `[ID: 59]` and `[ID: 60]` share one `beforeEach`/`afterEach` that
      snapshots-and-restores all four of Lisa's profile text fields — including in `[ID: 60]`, which never
      touches them. Left `fullyParallel`, the two tests can run concurrently; `[ID: 60]`'s `beforeEach` can
      then snapshot Lisa's profile *mid-edit* while `[ID: 59]` is running, and `[ID: 60]`'s own `afterEach`
      later overwrites `[ID: 59]`'s correct restore with that stale, half-edited snapshot. This was not
      theoretical — it corrupted Lisa's live `description`/`interests`/`city`/`country` twice during this
      session's verification runs (each time silently: the run still reported both tests green), and was
      only caught by independently checking the API after the run rather than trusting the test-runner
      output. Fixed with `test.describe.configure({ mode: 'serial' })` on that describe block, same
      remedy as `testRoles.spec.ts`/`testMessaging.spec.ts` for the same class of bug — **any two tests
      that snapshot-and-restore one shared external resource must be serial relative to each other, even
      if their own mutations look field-disjoint.** A first fix attempt also added a hard
      `expect(response.ok()).toBe(true)` around the restore call to fail loudly instead of silently — that
      is too strict on its own: `UsersController.UpdateUser` returns 400 whenever `SaveChangesAsync` affects
      zero rows, which is exactly what happens when `originalFields` already matches the current values (the
      normal case for `[ID: 60]`). The working version instead re-`GET`s afterward and asserts the *result*
      equals `originalFields`, tolerant of the 400. If a future session adds another test that shares
      externally-visible state with a sibling test (seed data, another test's account, a global
      counter/setting), assume they need the same `mode: 'serial'` treatment rather than trusting that
      "different fields" means "independent."
18. **Built the e2e layer** — the UI ⇒ API ⇒ DB parity checks §7 planned, now implemented as
    `specs/tests/e2e/` (4 files, `[ID: 73]`–`[ID: 76]`), a fourth Playwright project (`dependencies:
    ['setup']`, chromium only, `LAYER_TAG.e2e` = `@e2e`), and `npm run test:e2e`. Deviates from §7's own
    original sketch in one deliberate way: that section proposed bolting a DB assertion onto each existing
    regression test (§7.5) or nesting new checks under `regression/db-integrity/` (§7.6); the user
    explicitly asked for a dedicated `specs/tests/e2e/` folder instead, so this round built four
    self-contained files there rather than editing the 39 already-green regression specs.
    - **Infrastructure** (§7.3, now real): `mssql` + `msnodesqlv8` + `@types/mssql` installed;
      `src/helpers/db/mssql.helper.ts` (`runMssqlQuery`/`closeMssqlPool`, one lazily-opened pool, reads
      `process.env.DB_CONNECTION_STRING` directly rather than importing `specs/support/env` — same
      independence `browserHealth.helper.ts`'s `isOwnOrigin` already established for `src/helpers/`); four
      query-constant files under `src/constants/queries/mssql/`. `msnodesqlv8`'s install script needed an
      explicit `npm approve-scripts msnodesqlv8` — this environment's npm blocks native-module postinstall
      scripts by default — followed by `npm rebuild msnodesqlv8` to actually run it.
    - **Real obstacle, not a hypothetical one**: this SQL Server instance runs Windows Integrated Security
      only (`SELECT SERVERPROPERTY('IsIntegratedSecurityOnly')` = `1`, confirmed via `sqlcmd`) with no SQL
      logins possible without flipping the server to mixed-mode auth and restarting the service — rejected
      as too invasive (would drop the already-running API's connections) without the user's explicit
      sign-off, which wasn't given; the user instead confirmed building a DB-connecting client in the
      automation project without prescribing the auth mechanism. `mssql/msnodesqlv8` (native ODBC) was
      chosen to reuse Windows Integrated Security the same way the .NET API already does, at the cost of a
      native postinstall step. Getting the connection itself working took two more dead ends — a bare
      connection-string *string* is rejected by mssql's own ADO-style parser before `msnodesqlv8` ever
      sees it (*Failed attempts* #20), and addressing the instance by `server\instance` name hangs forever
      because SQL Server Browser is stopped with no TCP listener configured (#21). The working shape
      addresses the instance by its local Named Pipe directly: `Server=np:\\.\pipe\MSSQL$SQLEXPRESS\sql\query`,
      wrapped as `{ connectionString }`, verified with a real `SELECT COUNT(*) FROM dbo.AspNetUsers` (16
      rows, matching 10 seeded members + admin + `test_user_1..5`) before any spec was written against it.
    - **Schema verified against the actual EF migration**, not the entity classes — `API/Entities/Photo.cs`
      names its `DbSet<Photo>` property `GeneralPhotos`, and the table genuinely is `GeneralPhotos`, not
      `Photos`, confirmed from `API/Data/Migrations/20250302123454_InitialCreate.cs`'s `CreateTable` calls
      (none of the four e2e files ended up needing that table, but it would have been a silent wrong-table
      query had one been written against the entity name instead).
    - **Four checks, four different tables**: `[ID: 73]` (`dbo.AspNetUsers`) edits `test_user_2`'s profile
      through `/member/edit-profile` and reads the four text columns back directly, snapshot/restored in
      `beforeEach`/`afterEach` the same way `testEditProfile.spec.ts` `[ID: 59]` already does for Lisa.
      `[ID: 74]` (`dbo.Likes`) likes/unlikes a post and reads the composite `(AppUserId, PostId)` row
      directly — no API response exposes that row shape, since `Likes` has no surrogate `Id` at all.
      `[ID: 75]` (`dbo.Posts` + `dbo.Likes`) publishes and deletes a post, and also has `test_user_3` like
      it through the API first, so the delete step proves the `OnDelete(DeleteBehavior.Cascade)` FK on
      `Likes.PostId` actually fires against a real row rather than only inferring it from the UI. `[ID: 76]`
      (`dbo.AspNetUserRoles`/`dbo.AspNetRoles`) adds and removes a role through the admin roles modal and
      reads the join back directly, rather than trusting `admin/users-with-roles`'s own response the way
      `testRoles.spec.ts` does.
    - **Deliberately avoided the shared accounts the regression suite already owns**: `test_user_2` and
      `test_user_3` stand in for `MEMBER`/Lisa and the regression `testRoles.spec.ts`'s own `test_user_2`
      respectively — both are already snapshot/restored or promoted/demoted under `mode: 'serial'`
      *within their own file*, which offers no protection against a same-account race from a *different*
      Playwright project (`e2e` has no ordering relative to `regression-*`). Each e2e spec signs in via
      `signInThroughUi` directly rather than relying on a saved `storageState`, since only `MEMBER`/`ADMIN`
      have one.
    - **A real, previously-undetected leftover was found and fixed** while verifying this layer, not just
      hypothesised: the very first live run failed all four tests on dead end #20 above, and
      `testOffersDb.spec.ts`'s post-publish step had already succeeded before the DB call threw, orphaning
      a real `dbo.Posts` row that its `postId`-gated `afterEach` had no way to find. Caught by an
      independent `sqlcmd` audit after the (by-then green) run, not by the test runner — same lesson
      *Changes made* #17 already drew about never trusting a green run alone for shared/persisted state.
      Fixed per *Failed attempts* #22 and re-verified clean by the same audit.
    - Verified against the live stack repeatedly after every fix: `tsc --noEmit` clean throughout,
      `npx playwright test --project=e2e` — **6/6 green** (2 `setup` + 4 e2e) on two consecutive runs, and
      `--project=health` (23/23) and `--project=smoke` (13/13) re-run clean afterwards since this round
      added a project to the shared `playwright.config.ts`. A post-run `sqlcmd` audit confirmed
      `test_user_3` back to `Moderator` alone and zero leftover `dbo.Posts`/`dbo.Likes` rows for
      `test_user_2`/`test_user_3`. Not yet run on `regression-firefox`/`-webkit`-equivalent browsers for
      `e2e` — the project is chromium-only by design (§1), since a second rendering engine proves nothing
      additional about whether the database agrees with the UI.
19. **Landed phase 1 of [`Модифікація проєкту по автоматизації.md`](./Модифікація%20проєкту%20по%20автоматизації.md)
    — quality gate, timeouts, models, test data.** No test was added or renumbered; next free ID is still `77`.
    - **Quality gate** (`RulesForWritingTests.md` §10): `eslint` 10 + `typescript-eslint` +
      `eslint-plugin-playwright` in `eslint.config.mjs`, `husky` + `lint-staged` (`.husky/pre-commit` lints the
      staged `*.ts` files and runs `tsc --noEmit`), new scripts `lint` / `lint:fix` / `check` / `prepare`. The
      TypeScript block is `recommended` plus the three type-aware promise rules (`no-floating-promises`,
      `await-thenable`, `no-misused-promises`) rather than the whole `recommendedTypeChecked` set the plan
      sketched — chosen to target a forgotten `await`; the full type-checked set was not tried.
      `no-restricted-imports` for `@playwright/test` is deferred to phase 2, when the fixtures it would point
      specs to exist. The first lint run found 0 errors and 10 `playwright/prefer-hooks-on-top` warnings (every
      `afterEach` sat below its tests); the hooks were moved up, which changes nothing at run time.
    - **Branching moved out of test bodies** (`RulesForWritingTests.md` §3): `OffersPage.firstCardNotOwnedBy`,
      `EditProfilePage.mainPhotoIndex`, `RegistrationPage.fillAllExcept` + `REQUIRED_REGISTER_FIELDS`,
      `AddOfferPage.fillRequired` + `REQUIRED_POST_FIELDS` (`widgets.ts`), `firstLikablePostWithUniqueTitle`
      (`src/helpers/data/posts.helper.ts`), `collectLoadProblems` (`browserHealth.helper.ts`). `BasePage.toasts`
      replaces the raw `.locator('.ngx-toastr')` in `testRegistration.spec.ts`. The one
      `waitForLoadState('networkidle')` in `testApp.spec.ts` keeps an inline, justified disable.
    - **Timeouts** (`src/constants/timeouts.ts`, `RulesForWritingTests.md` §8): all six numeric timeouts in the
      specs plus the health project's two in `playwright.config.ts` are named, `TIMEOUT_MULTIPLIER`-scaled
      constants now. Loading `.env` moved out of the config's own `dotenv.config()` call into
      `src/helpers/loadEnv.helper.ts`, imported first by `playwright.config.ts` — the constants read
      `process.env` at module load, which happens before any statement in the config body runs.
    - **Models** (`src/models/`): zod schemas with inferred types for `UserDto`, `PostDto`,
      `MemberDto`/`PhotoDto`/`MemberUpdateDto`, `MessageDto`, `ApiException`; row interfaces `CountRow`,
      `PostRow`, `RoleNameRow`, `ProfileFieldsRow` (+ the `ProfileFields` mappers that used to be a function in
      `testProfileDb.spec.ts`). All 14 local `interface` declarations are gone from the specs; `ApiClient.ts`
      re-exports `UserDto` from the model. Responses are still cast, not parsed — parsing arrives with the
      phase 2 controllers.
    - **Test data** (`RulesForWritingTests.md` §9): `LOCATION` / `CURRENCY` (`src/constants/testData.ts`), `TOAST`
      (`src/constants/messages.ts`), `buildPost` / `buildRegistration` factories, and `uniqueName` /
      `uniqueSuffix` (timestamp + 8 random hex characters) replacing every `Date.now()` in the specs. `JESSIE`
      moved from `testMessaging.spec.ts` (and `RECIPIENT` from `testMessages.spec.ts`) into `env.ts`, with
      `JESSIE_USER` / `JESSIE_PASSWORD` documented in `.env.example`.
    - Docs: `RulesForWritingTests.md` §3 (no branching in a test body), new §8–§10 and checklist items 8–10;
      `README.md` (layers table now lists `e2e`, lint/check scripts, *Quality gate*, project structure);
      `.env.example` (`JESSIE_*`, `TIMEOUT_MULTIPLIER`, and the stale `auth.health.spec.ts` reference fixed).
    - Verified against the live stack: `npm run check` clean; `npx playwright test --project=health
      --project=smoke --project=regression-chromium --project=e2e` — **79/79 green** in 1.7 min. Not re-run on
      `regression-firefox` / `regression-webkit`. Post-run `sqlcmd` audit: no leftover posts or profile edits,
      `test_user_2` back to `Member`, `test_user_3` back to `Moderator`, Lisa with her one (main) photo — but
      **25 leftover test messages** in `dbo.Messages`: 23 from runs on 2026-09-09 and 2 from this run, all
      produced by two cleanup gaps that predate phase 1 (neither `afterEach` involved was changed), logged as
      *Failed attempts* #23 and #24.

20. **One `.env`, and every spec moved onto the test accounts** (2026-09-13, at the user's request).
    - **One env file.** `.env.example` is removed; `.env` (git-ignored) is the only env file. Its optional
      settings (`AUTH_STRATEGY`, `TIMEOUT_MULTIPLIER`, `DB_CONNECTION_STRING`) moved over as commented lines;
      `JESSIE_USER`/`JESSIE_PASSWORD` did not, since nothing reads them any more. `specs/support/env.ts`
      reads every credential through `requireEnv` with no hard-coded fallback, so a missing key fails at
      load time and names itself — which also retires *Failed attempts* #12.
    - **Specs sign in only as `test_user_1`..`test_user_5`.** The seeded accounts (Lisa, Bob, admin) stay in
      `.env` for manual runs; `MEMBER`, `ADMIN` and `JESSIE` are gone from the code. The `member`
      storageState is now `test_user_2` and `admin` is `test_user_5` (`specs/support/auth.ts`); the other
      side of the messaging conversation (was Jessie) is `test_user_1`; the e2e actor for the profile, likes
      and posts checks moved from `test_user_2` to `test_user_4`, so the e2e project never edits the profile
      or the likes of the account the regression layer uses. Titles that named Lisa or admin were reworded;
      no ID changed. Health `[ID: 10]`/`[ID: 11]` probe `test_user_2`/`test_user_5` instead of the seeded
      member/administrator.
    - **Data the specs used to get from the seed**: `specs/support/data.setup.ts` (in the `setup` project)
      gives `test_user_2` a main photo when it has none — one Cloudinary upload on the first run, a read on
      every later one. `[ID: 60]`/`[ID: 61]` depend on it.
    - **Message cleanup fixed** (*Failed attempts* #23, #24): `deleteMessagesBetween`
      (`specs/support/cleanup.ts`) looks the messages up from both sides and deletes them with both tokens;
      used by `testMessages.spec.ts` and both `afterEach` hooks of `testMessaging.spec.ts`.
    - **`[ID: 73]` restores exactly**: it used to normalise `null` columns to `''` for the comparison and then
      write that normalised snapshot back; it now snapshots and restores the raw API values. `test_user_2`
      and `test_user_4` still hold `''` instead of `NULL` in `Description`/`Interests`, written by the old
      restore.
    - First run on the test accounts: 79/80 — smoke `[ID: 32]` hit a timing race, logged as *Failed attempts*
      #25 and fixed in `MemberProfilePage.sendMessage`. Second run: **80/80 green** (`health` + `smoke` +
      `regression-chromium` + `e2e`, 1.4 min; `regression-firefox`/`-webkit` not run), `npm run check` clean.
      Post-run `sqlcmd` audit: the test accounts hold no posts, likes or messages, `test_user_2` has its one
      main photo, roles unchanged, the seeded accounts untouched, and no test message or post created on
      2026-09-13 survived. The 25 older leftovers between Lisa and Jessie (*Changes made* #19) are still there.

21. **Landed phase 2 of [`Модифікація проєкту по автоматизації.md`](./Модифікація%20проєкту%20по%20автоматизації.md)
    — fixtures, personas, API controllers, cleanup and the `db` fixture** (2026-09-13). No test was added or
    renumbered.
    - **`src/api/`**: `HttpClient` (the verbs plus a bearer token; `expectOk` through `toBeOK()`; `parse`, which
      validates the body against a zod schema and lists every mismatching field), one controller per
      `API/Controllers/*.cs` (`Account`, `Posts`, `Likes`, `Messages`, `Users`, `Admin`, `Buggy`) and the
      `TravelApi` facade. Routes live in `src/constants/endpoints.ts`; `decodeJwt`/`rolesOf` moved to
      `src/helpers/jwt.helper.ts`. `specs/support/ApiClient.ts` is deleted.
    - **A contract gap the schemas surfaced**: `MessageDto.SenderPhotoUrl`/`RecipientPhotoUrl` are `required string`
      in the DTO, but `AutoMapperProfiles` fills them from the user's main photo, which is `null` for an account
      without one (`test_user_1`). The schema marks both nullish.
    - **`specs/support/fixtures.ts`**: the suite's `test` with `persona` (an option that overrides `storageState`),
      `api`, `apiAs(persona)` (one sign-in per persona per test), `pageAs(persona)` (a context with an explicit empty
      storageState, *Failed attempts* #19), `cleanup`, and the worker-scoped `db`. `specs/support/personas.ts`
      names the accounts `noRole`, `member`, `moderator`, `admin` (`test_user_4`) and `adminModerator`
      (`test_user_5`); the saved admin session was renamed to `adminModerator`
      (`playwright/.auth/admin-moderator.json`) so session names match persona names.
    - **`Cleanup`** (`specs/support/cleanup.ts`): `post`, `messages` (both sides, #23/#24), `profile` (snapshot, exact
      restore, removal of added photos, verification) and `roles` (snapshot, restore through `admin/edit-roles`,
      verification). Tasks run in reverse order after the test and fail together. All 10 former `test.afterEach`
      hooks are gone; every cleanup is registered before its change is made.
    - **`MssqlClient`** replaces `runMssqlQuery`/`closeMssqlPool`; the `db` fixture opens one pool per worker and
      closes it when the worker finishes. The native driver is loaded on the first connect, so health and smoke
      never load it — see *Failed attempts* #26 for how.
    - **Lint**: `no-restricted-imports` rejects `test`/`expect` from `@playwright/test` in specs. A throwaway probe
      spec confirmed `eslint-plugin-playwright` still recognises `test`/`expect` imported from `specs/support`
      (`no-conditional-in-test`, `no-raw-locators` and `prefer-web-first-assertions` all fired on it). The specs
      now contain no `new ApiClient`, `test.afterEach`, `@playwright/test` import, API route string, local
      interface or DTO cast.
    - Docs: `RulesForWritingTests.md` §11 (fixtures), the `src/api/` row in §3, the anatomy example and checklist
      item 11; `README.md` (persona sessions, project structure).
    - First run: 76/80 — every e2e test failed in the `db` fixture (*Failed attempts* #26). After the fix:
      `--project=e2e` 7/7, then **80/80** (`health` + `smoke` + `regression-chromium` + `e2e`, 1.5 min;
      `regression-firefox`/`-webkit` not run), `npm run check` clean. Post-run `sqlcmd` audit: the test accounts hold
      no posts, likes or messages, roles unchanged, `test_user_2` keeps its one main photo, no test post or message
      from 2026-09-13 survived, and the 25 older Lisa/Jessie leftovers are unchanged.

22. **Landed phase 3 of [`Модифікація проєкту по автоматизації.md`](./Модифікація%20проєкту%20по%20автоматизації.md)
    — steps, soft assertions and web-first checks** (2026-09-13). No test was added, removed or renumbered.
    - **Steps**: every test in the 11 regression and 4 e2e files is split into `[Step N][UI|API|DB]` steps; a value a
      later step needs is returned from its step. Loops over independent inputs (`[ID: 34]`, `[ID: 45]`, `[ID: 47]`,
      `[ID: 51]`) make each iteration its own step. The e2e docblocks list the steps with their layers. Health and
      smoke tests stay without steps.
    - **Soft assertions** for independent checks, always after the hard preconditions of their step: the optional
      sections in `[ID: 58]`, the `dbo.Posts` fields and the post-delete checks in `[ID: 75]`, the four profile fields
      in `[ID: 73]`, the form values in `[ID: 52]`/`[ID: 53]`/`[ID: 56]`, the per-input loops, and the multi-part end
      states in `[ID: 43]`, `[ID: 39]`, `[ID: 40]`, `[ID: 50]`, `[ID: 57]`, `[ID: 61]`, `[ID: 64]`.
    - **Web-first**: the 45 `expect(await …)` and 18 `expect.poll` that read browser state are gone; what is left
      reads database rows only (`expect(totalOf(await db.query(…)))`, and the `expect.poll` over
      `dbo.AspNetUserRoles` in `[ID: 76]`). Page objects gained
      `LIKE_COLOR` (`widgets.ts`, also used by both `isLiked()` implementations) and
      `MemberProfilePage.messageWithText(text)`. `[ID: 65]` checks the thread order with an array `toContainText`
      instead of reading indexes; `[ID: 60]` reads "main photo" from the Main button being disabled (the template
      binds `[disabled]` and `btn-active` to the same `photo.isMain`).
    - **No check was lost**: each rewritten spec was diffed against its phase-2 version. Every removed
      `hasDetails()`/`isDirty()`/`hasNoPosts()`/`hasSection()`/`isOpen()` read was `isVisible()` on the locator the
      new matcher uses. Three checks got stricter: `[ID: 56]` waits for the pre-filled title before reading other
      fields, `[ID: 62]` sees the card on `/lists` before and after the reload, and `[ID: 71]` waits for the roles
      cell to drop Admin before signing in as the demoted user.
    - Docs: `RulesForWritingTests.md` §12 (steps, soft, web-first, replacement table) and checklist item 12;
      `RulesForDescribingAPage.md` *Assertions stay in specs* (locators for assertions, value queries for flow
      control) and its stale usage example (`src/Pages` → `src/PageObjects`, `test`/`expect` from `specs/support`).
    - `npm run check` clean; **80/80** (`health` + `smoke` + `regression-chromium` + `e2e`, 1.5 min;
      `regression-firefox`/`-webkit` not run); `[ID: 75]` re-run on its own after a readability refactor. Post-run
      `sqlcmd` audit: the test accounts hold no posts, likes or messages, roles unchanged, `test_user_2` keeps its one
      main photo, no test-titled post survived, and the 25 older Lisa/Jessie leftovers are unchanged.

23. **Landed phase 4 of [`Модифікація проєкту по автоматизації.md`](./Модифікація%20проєкту%20по%20автоматизації.md)
    — the `api` and `database` layers** (2026-09-13). 57 tests added, `[ID: 77]`–`[ID: 133]`; next free ID `134`.
    - **`api` project** (`specs/tests/api/`, `@api`, `npm run test:api`; no `dependencies`, no browser):
      `testAuthorizationMatrix.spec.ts` sends 10 requests as `anonymous`/`member`/`moderator`/`admin` — 36 cells, each
      its own test (`[ID: 77]`–`[ID: 112]`), built from `PROBES`/`probeTarget` in `specs/support/authorizationProbes.ts`.
      Fifteen refusals in `testAccount` (`[ID: 113]`–`[ID: 115]`), `testPosts` (`[ID: 116]`–`[ID: 118]`),
      `testLikes` (`[ID: 119]`–`[ID: 121]`), `testMessages` (`[ID: 122]`–`[ID: 125]`) and `testAdmin`
      (`[ID: 126]`–`[ID: 127]`) check the status and the API's own message (`API_ERROR`, `src/constants/messages.ts`).
    - **Two application defects confirmed, then fixed in `EW-TravelApp-.Net8-Angular17`**: `LikesController` had no
      `[Authorize]`, so an anonymous `GET likes/list` or `POST likes/{id}` reached `User.GetUserId()` and came back as a
      500 (`[ID: 93]`, `[ID: 97]`); `PostsController.UpdatePost` never checked the owner, so test_user_3 rewrote
      test_user_4's post and got a 204 (`[ID: 118]`). The fix adds `[Authorize]` to the controller and
      `if (post.AppUserId != User.GetUserId()) return Forbid();` to the action. The API was then restarted the way it
      had been started, in its own `powershell -NoExit -Command ... dotnet run` window.
    - **A plan expectation that was wrong**: `admin/edit-roles` without `roles` never answers "you must select at least
      one role" — the non-nullable `string roles` parameter makes `[ApiController]` return a `ValidationProblem` first.
      `[ID: 126]` checks that instead.
    - **`database` project** (`specs/tests/database/`, `@database`, `npm run test:database`): `testSchema.spec.ts`
      (`[ID: 128]` applied migrations, `[ID: 129]` the `FK_Likes_Posts_PostId` cascade) and `testDataIntegrity.spec.ts`
      (`[ID: 130]`–`[ID: 133]`, closing §7.6). Queries in `integrity.queries.ts`, rows in `src/models/db/integrity.rows.ts`.
    - **Framework additions**: `apiAs('anonymous')`; `cleanup.like(liker, postId)`; `HttpClient.postForm`/`putForm`; a raw
      call per probe plus `posts.add`/`get`/`editRaw`/`removeRaw`, `likes.ids`, `messages.sendRaw`, `account.registerRaw`;
      `NewPostDto`, `RegisterDto`, `ValidationProblemSchema`; `buildPostDto`, `buildRegisterDto`, `unknownUsername`,
      `firstSeededPost`; `MISSING_ID`, `SEED`, `SCHEMA` in `testData.ts`.
    - **Data safety**: ownership refusals are tried on a post test_user_4 publishes through the API for that test and
      `cleanup` deletes; the matrix and the like toggle aim at a seeded member's post, which is only read, or liked and
      unliked; the one real message goes test_user_3 → test_user_4, a conversation no UI test reads.
    - Docs: `RulesForWritingTests.md` §2, §3, §5 (the next-ID command also finds `id: n` table entries), §6 layer table,
      §9, §11, §12; `README.md` (layers, commands, structure); §7.6 and §7.7 here.
    - Before the fix: `api` + `database` 53/57 — the three defects plus `[ID: 126]`'s wrong expectation. After it: `api`
      **51/51** with no browser installed and the client URL unreachable, `database` **6/6** with the API, the client and
      the browsers unreachable, then **80/80** `health` + `smoke` + `regression-chromium` + `e2e` against the fixed API
      (1.5 min; `regression-firefox`/`-webkit` not run); `npm run check` clean. Post-run `sqlcmd` audit: the test
      accounts hold no posts, likes or messages, roles unchanged, `test_user_2` keeps its one main photo, and there is no
      `API Offer` post, no `API message` and no stray `reg_user_`/`nobody_` account.

24. **Landed phase 5 of [`Модифікація проєкту по автоматизації.md`](./Модифікація%20проєкту%20по%20автоматизації.md)
    — CI with the stack, and `data-testid`** (2026-09-13). No test was added or renumbered.
    - **Two database drivers** (`src/helpers/db/mssql.helper.ts`): `DB_DRIVER=msnodesqlv8` (default, the Named Pipe) or
      `tedious` with `DB_SERVER`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`; each is `require`d on connect.
      `msnodesqlv8` moved to `optionalDependencies`, pinned to `5.3.0` - an unpinned `npm install --save-optional` bumped
      it to 5.5.0, whose install script `allowScripts` does not cover.
    - **`seed-users` project** (`specs/support/users.seed.ts`, `testMatch: /.*\.seed\.ts$/`): registers `test_user_1..5`
      (`Username is taken` counts as done) and, only when a token's roles differ from `PERSONAS`, grants them as the seeded
      admin (`seededAdminCredentials()`, `ADMIN_USER`/`ADMIN_PASSWORD`). Locally 5/5 and no change.
    - **`playwright.config.ts`**: `PIPELINE = !!process.env.CI` chains the projects -
      `seed-users -> health -> api + database -> setup -> smoke/regression/e2e`; CI reporters `list` + `html` + `junit`
      (`reports/junit.xml`, git-ignored); `webServer` behind `START_STACK=1` (API: `dotnet run --no-launch-profile --urls
      ...` with `ASPNETCORE_ENVIRONMENT=Development`, ready on `buggy/bad-request`'s 400; client: `npm start`, on CI
      `npx ng serve --ssl=false`) with `TIMEOUT.stackStart`; `Google Chrome` limited to smoke.
    - **Workflow** (`.github/workflows/playwright.yml`): SQL Server 2022 service with a `sqlcmd` health check, both
      repositories (`vars.APP_REF`, default `main`), `dotnet dev-certs https`, one `playwright test` run on push/PR, plus
      regression in three browsers nightly or on dispatch; secrets listed in `README.md`, "CI". `actionlint` clean. Not
      run on GitHub yet - the secrets are not there.
    - **`data-testid`** in the application: 126 hooks across `nav`, the three post cards, `add-offer`, `edit-offer`,
      `offer-detail`, `messages` and `photo-editor`, added by a script that required every anchor to match an exact number
      of times and left the commented-out modal copies in `offer-card`/`offer-detail` alone. `BasePage`, `offerCard`,
      `postForm` (no `add`/`edit` variant any more; a field's id is its `formControlName`), `fileUploader` and nine page
      objects use `getByTestId`; their public members did not change, so no spec did. `fieldByLabel` is gone.
    - Docs: `RulesForDescribingAPage.md` (locator strategy with `data-testid` first, the test id table),
      `RulesForWritingTests.md` §3, `README.md` (CI, secrets, running like CI), `.env` (commented `START_STACK`, `APP_DIR`,
      `DB_DRIVER`, `DB_*`), §3 here.
    - Local, against the hand-started stack: **80/80** `health` + `smoke` + `regression-chromium` + `e2e` with the test
      ids, **57/57** `api` + `database` with the rewritten helper, `npm run check` clean.
    - **CI rehearsal** on this machine: the hand-started API and client stopped, a fresh `mssql/server:2022-latest`
      container on port 14330, then `CI=1 START_STACK=1 BASE_URL=http://localhost:4200 TIMEOUT_MULTIPLIER=2
      DB_DRIVER=tedious ... npx playwright test --project=smoke --project=e2e`. `webServer` started both applications
      against the empty database, which the API migrated and seeded: **103/103** in 3.6 min on one worker (seed-users 5,
      health 23, api 51, database 6, setup 3, smoke 11, e2e 4), `junit.xml` 103 tests, 0 failures. Container audit
      afterwards: the five accounts exist with their roles, `test_user_2` has one main photo, nothing else is left. The
      container was removed and the API and client restarted in their own windows, as before.

25. **Spec files renamed to camelCase** (2026-09-13, at the user's request): all 34 `specs/tests/**/test_<Name>.spec.ts`
    became `test<Name>.spec.ts` (`git mv`, so history follows them), and every reference in the docs, comments and
    README was updated the same way - older entries in this file included, so their paths still resolve.
    `RulesForWritingTests.md` §7 and checklist item 7 now describe the camelCase convention. No test changed:
    `playwright test --list` reports 231 tests in 37 files before and after.

---

## 5. Failed attempts

Dead ends already hit. Do not retry them. Each entry: *what was tried → why it failed → what to do instead.*
Append new entries at the bottom.

| # | Tried | Why it failed | Do instead |
| --- | --- | --- | --- |
| 1 | `check()` on the post-form checkboxes | They are `opacity: 0` and covered by `span.checkmark`; Playwright treats them as not visible and times out | Click the wrapping `label`, read the state back from the input — already implemented in `postForm` |
| 2 | `#password` on `/` | `nav.component.html` and `login.component.html` both render `id="password"`, so on `/` the id exists twice and strict mode fails | Scope every login locator to its form root and key on `name`; use `loginPage.form` for the card, the `nav*` locators for the bar |
| 3 | Placeholder lookup for the price / travel-time fields | `app-number-input-post` renders neither an id nor a placeholder | `fieldByLabel` — locate via the `.form-group` carrying the visible label |
| 4 | Placeholder match without `exact` | `Password` also resolves `Confirm Password` | Always `{ exact: true }` |
| 5 | Reading like state from a CSS class | The state is only observable as `[style.color]` (`red` / `black`) | Compare the computed colour — `offerCard().isLiked()` |
| 6 | Matching tab headings by exact string | Headings are interpolated (`About {{knownAs}}`, `{{knownAs}}'s Posts`) | Tab lookups accept a `RegExp` |
| 7 | Locating elements on `/offers/:id` by id | That template has no ids at all | Address the optional price blocks by their positional `info-row-N-left` class |
| 8 | Running the suite after deleting `tests/example.spec.ts` | `testDir: './tests'` no longer resolves, so Playwright 1.61 fails with `Error: No tests found` and **exit code 1** — CI is red for a config reason, which is easy to misread as a product failure | Point `testDir` at `./specs/tests` (Step 0); verify with `npx playwright test --list` before debugging anything else |
| 9 | `npm i -D typescript` (unpinned) for `npm run typecheck` | Resolves to TS 7, which removed `moduleResolution=node10`; `tsconfig.json` sets `"moduleResolution": "node"` and the compiler refuses to start — `error TS5108` | Pin `typescript@^5`. Revisit only together with the whole `tsconfig.json` |
| 10 | Checking CORS with the `request` fixture | `APIRequestContext` sends no `Origin` header, so the API answers happily and the check proves nothing about the browser | Run `fetch` inside the page (`page.evaluate`) — that is the only place the client origin exists. Implemented in `app.health.spec.ts` |
| 11 | Counting the cards straight after `OffersPage.open()` | `uniqueElement` is the heading, which Angular paints before `posts` comes back — `cardCount()` returns 0 | `await offers.cards.first().waitFor()` before counting, or assert with `expect(offers.cards).toHaveCount(n)`, which retries. Same trap on every list screen (`/lists`, profile tabs) |
| 12 | Documenting only `TEST_USER_1`/`TEST_PASSWORD_1` in `.env.example` when `env.ts` reads `TEST_USER_1..5` | A machine that copies `.env.example` to `.env` gets a working `TEST_USER_1` and four accounts silently falling back to the hard-coded defaults in `env.ts` — fine until the target database doesn't have `test_user_2..5` seeded under those exact names, which then fails four of the ten `testAuth.spec.ts` checks with no hint why | Add the remaining four accounts to `.env.example` before the next session touches this file — flagged, not yet done |
| 13 | `AddOfferPage.attachPhoto` calling `fileUploader().selectFiles()` (`setInputFiles` on `input[type="file"]`) | Neither `add-offer.component.html` nor `photo-editor.component.html` renders an `<input>` at all — `[ng2FileDrop]` only ever listens for the native `drop` event and reads `event.dataTransfer.files` (`FileDropDirective.onDrop`). The locator resolves to zero elements and `setInputFiles` hangs until the test's own timeout | Simulate the drop: build a real `DataTransfer`/`File` inside the page via `page.evaluateHandle` and dispatch `drop` on `.my-drop-zone` with it — `src/helpers/dragAndDrop.helper.ts`'s `dropFiles`, exposed on the widget as `fileUploader().dropFiles(...)` |
| 14 | `AdminPage.userRow(username)` filtering `userRows` by any `<td>` matching the username | The filter is not scoped to a specific column, so a row whose **roles** cell happens to equal the searched username's own role set (e.g. searching `admin`, whose roles are `Admin, Moderator`, also matches `test_user_4`'s row, whose sole role is `Admin`) collides in strict mode | Scope the match to `td:first-child` — the username is always the first cell (`user-management.component.html`) |
| 15 | `MessagesPage.containerButton` using `getByRole('button', { name })` for the Unread/Inbox/Outbox filter | The elements are `<button>` tags, but ngx-bootstrap's `btnRadio` directive overrides their accessible role to `radio` (they are one option of a radio group) — `getByRole('button', ...)` never resolves and the click times out | Look up `getByRole('radio', { name, exact: true })` instead |
| 16 | `AdminPage.rolesModal` locating `bs-modal-container .modal-content` | Never exercised by any prior test; this ngx-bootstrap version renders `<modal-container>`, no `bs-` prefix — the locator matched nothing and every roles-modal test hung for the full timeout | Locate `modal-container .modal-content`; when a selector for markup no test has ever touched turns up wrong, dump the real DOM (`page.evaluate(() => el.outerHTML)`) rather than guessing a second time |
| 17 | `MemberProfilePage.message().readMarker` as `root.getByText(/^\(read/)` | The template renders `(read {{...}})` with a leading space; Playwright tests a `RegExp` against the raw (untrimmed) text content, unlike its lenient/normalized string matching — `^` never matched | Drop the `^` anchor: `getByText(/\(read/)`. Don't anchor a regex text-matcher to the start unless the surrounding markup is known to have no leading whitespace |
| 18 | Two regression tests each opening their own "Lisa talks to Jessie" conversation, in separate spec files, under `fullyParallel` | `MessageHub` groups connections by **username pair**, not by test/browser — two concurrently-running tests both join the same SignalR group and corrupt each other's read/unread state and message order | Put every test that touches the same seeded conversation in one file under one `test.describe.configure({ mode: 'serial' })`, so Playwright can never schedule two of them at once (`testMessaging.spec.ts`) |
| 19 | `context.browser()!.newContext()` (no options) to sign in a second identity, from inside a test whose `test.use({ storageState: ... })` covers the first identity | Playwright Test applies the active `test.use({ storageState })` as the default for **any** `newContext()` called during that test, not just the fixture's own `page` — the "second" context opened already signed in as the first identity, and `signInThroughUi` then hung waiting for a login form that `redirectAuthenticatedGuard` never showed | Pass an explicit empty override: `newContext({ storageState: { cookies: [], origins: [] } })`, whenever the test itself carries a `storageState` |
| 20 | `sql.connect('Driver={ODBC Driver 17 for SQL Server};Server=np:\\.\pipe\...')` — a bare connection-string **string** passed to `mssql/msnodesqlv8`'s `connect()` | `connect()` given a string (not an object) runs it through mssql's own generic ADO-style parser, built for tedious's `Server=host;User Id=u;Password=p` shape — it explicitly recognises and rejects the `np:` Named Pipes prefix with `Error: Connection via Named Pipes is not supported`, before the string ever reaches the native `msnodesqlv8` driver that would have understood it fine | Wrap it as an object instead — `connect({ connectionString: '...' })` — which passes the ODBC string straight through to the native driver, unparsed. Needs an `as unknown as config` cast: `@types/mssql`'s `config` interface only declares `connectionString` nested under `options`, but `mssql/lib/msnodesqlv8/connection-pool.js`'s `_poolCreate` reads `this.config.connectionString` at the top level — a real typings gap, confirmed by reading that file |
| 21 | `sql.connect({ driver: 'msnodesqlv8', server: 'RUSLAN\\SQLEXPRESS', database: 'TravelApp', options: { trustedConnection: true } })` — addressing the instance by `server\instance` name, the same shape `API/appsettings.Development.json`'s `Data:Connection` uses successfully from .NET | Hangs forever (no error, no timeout, not even `connectionTimeout`/`connectionString` options helped) — resolving a named instance this way needs **SQL Server Browser** (UDP 1434) to answer with the instance's dynamic TCP port, and on this machine Browser is `STOPPED` (`sc query SQLBrowser`) with no TCP listener configured for the instance at all (`netstat -ano` shows nothing for `sqlservr.exe`'s PID). ADO.NET's own `SqlClient` avoids this entirely by falling back to Named Pipes/Shared Memory for a local instance, which `msnodesqlv8` does not do automatically | Address the instance by its Named Pipe directly instead: `Server=np:\\.\pipe\MSSQL$SQLEXPRESS\sql\query` (found via `Get-ChildItem '\\.\pipe\' \| Where Name -match sql` in PowerShell) — bypasses Browser and the TCP layer entirely. See `src/helpers/db/mssql.helper.ts` |
| 22 | `testOffersDb.spec.ts`'s `afterEach` deleting a created post by a `postId` captured mid-test (`postId = row.Id` right after the DB read that confirms the post exists) | The very first live run of this file hit dead end #20 (the DB connection was still broken) **after** the UI had already published the post but **before** `postId` could be assigned — `afterEach`'s `if (postId === undefined) return` then skipped cleanup entirely, leaving a real, permanent orphan row in `dbo.Posts` (`e2e DB Offer 1788953603041`, id 96) that only turned up during a manual post-run DB audit, not from the test runner itself. Same "green run, corrupted state" shape as entry 17's stray message and the profile-snapshot bug in *Changes made* #17 | Look the post up by `title` through `posts/user/{username}` in `afterEach`, the same pattern `testOfferLifecycle.spec.ts`/`testAddOffer.spec.ts` already use, instead of trusting a variable that a mid-test failure can leave unset. Deleted the orphan by hand through the real API once found — never patch a leftover row directly with SQL |
| 23 | `testMessages.spec.ts` (smoke) deleting its sent message in `afterEach` with Lisa's token only | `DELETE messages/{id}` only flags the caller's own side, and the row is removed only once both `SenderDeleted` and `RecipientDeleted` are set — every smoke run leaves its `Smoke message …` row behind with `SenderDeleted = 1`, still visible in Jessie's thread (6 such rows found by the post-run audit on 2026-09-12, the oldest from 2026-09-09). The green run never shows it | Delete with both parties' tokens, as `testMessaging.spec.ts`'s first `afterEach` already does — planned for phase 2's `cleanup` fixture (`Модифікація проєкту по автоматизації.md` §1) |
| 24 | `testMessaging.spec.ts` `[ID: 66]`: `afterEach` looking the message up through Lisa's `messages/thread/jessie` after the test itself deleted it through Lisa's UI | `MessageRepository.GetMessageThread` hides a message from a recipient who has deleted it (`RecipientDeleted == false` in its filter), so after Lisa's delete the lookup never finds it and Jessie's side is never deleted — one `Regression inbound …` row with `RecipientDeleted = 1` survives every run (19 such rows found by the same audit) | Look the message up from the side that has *not* deleted it (Jessie's `messages/thread/lisa`), or keep the id `POST messages` returns when the test creates it — planned for phase 2's `cleanup` fixture |
| 25 | `testMessages.spec.ts` `[ID: 32]` opening `/messages` straight after `MemberProfilePage.sendMessage` clicked Send | The UI sends through the SignalR hub (`hubConnection.invoke('SendMessage')`), and leaving the member page destroys `member-detail.component`, whose `ngOnDestroy` calls `stopHubConnection()` — an invocation the server has not processed yet dies with the connection, the message is never saved, and the Outbox shows *No messages yet*. Timing-dependent: it had passed with Lisa's account and failed on the first run with the emptier, faster-loading `test_user_2` | `sendMessage` now waits until the hub's `NewMessage` echo puts the text into the thread before returning — the wait `[ID: 68]` already did by hand in the spec |
| 26 | Loading the native SQL Server driver lazily with `await import('mssql/msnodesqlv8')` inside `MssqlClient.connect` | Playwright hands a dynamic `import()` to Node's ESM resolver, which does not add `.js` to a bare package subpath: *Cannot find module node_modules/mssql/msnodesqlv8 ... Did you mean to import "mssql/msnodesqlv8.js"?* — every e2e test failed in the `db` fixture. The static `import` used before only worked because it compiles to `require` | `require('mssql/msnodesqlv8') as typeof import('mssql/msnodesqlv8')` inside `connect()`, with a justified `no-require-imports` disable — still loaded on demand, but resolved the CommonJS way |

---

## 6. Next steps — health / smoke / regression

### Step 0 — unblock the runner *(must land before any spec)*

✅ **Landed** — items 1–6. `npx playwright test --list` reports 15 tests in 3 files (13 health + 2 setup);
`npm run typecheck` is clean. Details in *Changes made* 7 and 9.

Still open:

- **CI** (item 7) — the workflow starts neither the API nor the client, so it still cannot pass. Health is
  the cheapest layer to make green first: bring up SQL Server + `dotnet run` + `npm start` on the runner,
  then `npm run test:health`.

**How a spec becomes somebody**

```ts
import { STORAGE_STATE } from '../../support';

test.use({ storageState: STORAGE_STATE.member });   // or .admin
```

Per file, never per project: `auth.smoke.spec.ts` and the guard specs need to start out anonymous, and they
share the project with everything else. Running `--project=smoke` or any `regression-*` triggers the
`setup` project automatically; `--project=health` does not and must not.

---

### 6.1 `specs/tests/healthCheck/` — API contract + availability ✅

*(the folder is `healthCheck`, not `healthe` as earlier drafts of this document said)*

No page objects beyond the availability check; the API specs use the `request` fixture and no browser.
`ignoreHTTPSErrors` from `use` covers the API's self-signed certificate as well.

| File | Scenario | Assertion |
| --- | --- | --- |
| `testApi.spec.ts` | `[ID: 10]` `POST account/login` with the seeded member | 200, JWT `token` whose `unique_name` and `role` match, `username` (lower-cased by the seed), `knownAs` |
| | `[ID: 11]` `POST account/login` with the seeded admin | 200, token carries `Admin` **and** `Moderator` |
| | `[ID: 12]` `POST account/login` with a wrong password | 401 |
| | `[ID: 13]` `GET posts` without a token | 401 |
| | `[ID: 14]` `GET posts` with a token | 200, non-empty array — the seed ran and the DB answers |
| | `[ID: 15]` `GET buggy/not-found` | 404 (also proves the DB answers: it runs `Users.Find(-1)`) |
| | `[ID: 16]` `GET buggy/server-error` | 500 |
| | `[ID: 17]` `GET buggy/bad-request` | 400 |
| | `[ID: 18]` `GET buggy/auth` without a token | 401 |
| | `[ID: 19]` 500 body | `ApiException` shape — `statusCode`, `message`, `application/json` |
| `testApp.spec.ts` | `[ID: 20]` `GET` the client root | 200, title `TravelApp`, the login card renders |
| | `[ID: 21]` Page load | no `console.error`, no uncaught error, no failed request to the client origin |
| | `[ID: 22]` Client → API reachability | `fetch` **inside the page** reaches `apiUrl` and gets 404 → CORS admits the client origin |
| `testAuth.spec.ts` | `[ID: 0]` `test_user_1` (no role) signs in **through the login form** | lands on `/offers`, nav greeting matches the username |
| | `[ID: 1]` `test_user_2` (**Member**) signs in **through the login form** | same |
| | `[ID: 2]` `test_user_3` (**Moderator**) signs in **through the login form** | same |
| | `[ID: 3]` `test_user_4` (**Admin**) signs in **through the login form** | same |
| | `[ID: 4]` `test_user_5` (**Moderator + Admin**) signs in **through the login form** | same |
| | `[ID: 5]`–`[ID: 9]` | same five accounts, signing in **with a token planted into `localStorage`** instead | `account/login` succeeds, the planted session survives a reload, lands on `/offers` with the matching nav greeting |

Ignored console/network noise lives in one place — `IGNORED_NOISE` in `src/helpers/browserHealth.helper.ts`.
Extend that list instead of loosening the assertions.

**Done when:** green in under 30 s, no dependency on any other layer.
**Status:** ✅ 23/23 green against a live stack in 13.9 s (`npx playwright test --project=health`, run
today), no login state created by `testApi.spec.ts`/`testApp.spec.ts`, no data touched; `testAuth.spec.ts`
does sign in (both through the UI and by planting a token) but performs no writes.

---

### 6.2 `specs/tests/smoke/` — happy paths (chromium) ✅

*(filenames below use the `test_<FunctionalityChecked>.spec.ts` convention from
`RulesForWritingTests.md` §7, decided after this table was first drafted — not
the `*.smoke.spec.ts` names originally sketched here)*

| File | IDs | Scenario | Assertion |
| --- | --- | --- | --- |
| `testAuth.spec.ts` | 23–24 | Login as `Lisa` from the login card; logout from the user menu | lands on `/offers` with the nav greeting; back on `/` with the login card visible |
| `testNavigation.spec.ts` | 25–26 | Nav links per role, then reached via `goTo()` | member sees Offers/Lists/Messages, admin also sees Admin/Errors (`visibleNavLinks()`); each destination's `uniqueElement` renders |
| `testOffers.spec.ts` | 27–28 | Open `/offers`; open the first card | at least one card, `isEmpty()` false; `/offers/:id` renders with a matching title |
| `testAddOffer.spec.ts` | 29 | `attachPhoto()` + `publish()` | success toast; the post appears on `/member/profile`; cleanup deletes it via the API in `afterEach` |
| `testLikes.spec.ts` | 30 | Like another member's post, then unlike it in the same test | appears on `/lists` while liked; no trace left afterwards (`@unmutation`, not `@mutation` — see §4) |
| `testProfile.spec.ts` | 31 | Open `/member/profile` | sidebar + Posts and About tabs render |
| `testMessages.spec.ts` | 32 | Send a message from the `/members/:username` Messages tab | shows up in the `/messages` Outbox; cleanup deletes it via the API in `afterEach` |
| `testAdmin.spec.ts` | 33 | Admin opens `/admin` | User management tab lists users with their roles |

**Done when:** green on chromium in under 5 min and wired into the PR workflow.
**Status:** ✅ 11/11 green on chromium in ~20 s (`npm run test:smoke -- --project=smoke`, run
today), comfortably inside the 5 min budget; not yet wired into a CI workflow (Step 0's CI item is
still open). Cleanup verified against the live API after the run: no leftover posts, messages or
likes for `Lisa`. Three framework-layer bugs surfaced and fixed while wiring this layer — see
*Changes made* and *Failed attempts* below.

---

### 6.3 `specs/tests/regression/` — full behaviour (3 browsers) ✅

One folder per domain.

**`auth/`**
- Registration validators: `username`, `knownAs`, `dateOfBirth`, `city`, `country` required; password
  9–21 chars (`minLength(9)` / `maxLength(21)`); `confirmPassword` must match (`matchValues`);
  `dateOfBirth` max = today − 18 years (`maxDate`).
- Submit disabled while the form is invalid (`isSubmitEnabled()`), enabled once valid.
- Duplicate username surfaces the server error (`serverErrorTexts()`).
- Cancel resets the form and returns to the login card.
- Password-eye toggle flips the input `type` (`passwordInputType()`).
- Login from the nav bar redirects to `/offers`.
- Wrong credentials show an error toast and stay on `/`.
- `redirectAuthenticatedGuard` bounces a signed-in user away from `/`.

**`guards-and-errors/`**
- Signed out, each of the 10 protected routes is blocked by `authGuard`.
- As a member, `/admin` and `/errors` show the toast `You cannot enter this area` and do not navigate.
- As a **Moderator**: `/admin` is allowed and shows only the Post management tab; `/errors` is **hidden in the
  nav but reachable by direct URL** — assert the current behaviour and link back to this note.
- `preventUnsavedChangesGuard`: leaving a dirty `/member/edit-profile` raises a native `confirm()`; dismissing
  keeps the user on the page, accepting leaves. Register `page.on('dialog')` first.
- An unknown URL renders `NotFoundPage`.
- `/errors`: all **five** buttons — 400, 401, 404, 500, 400-validation — produce the matching toast/redirect.

**`offers/`**
- Full CRUD through `postForm`: required fields, the toggle-dependent price blocks, accommodation type
  (Camping/Hotel/Hostel), currency selection.
- Edit pre-fills the existing values, saves, and the change survives a reload.
- Delete removes the card from `/offers` and from the author's profile.
- `/offers/:id` renders the optional price rows only when they were filled.
- Empty state when the author has no posts.

**`profile-and-photos/`**
- Edit profile saves description/interests/city/country and survives a reload.
- Photo upload, set-main updates the nav avatar, delete photo.
- The main photo cannot be deleted.

**`likes-and-lists/`**
- Like/unlike round-trip between `/offers` and `/lists`.
- `/lists` empty state for a user with no likes.
- Like state persists across a reload (`likes/list`).

**`messaging/`**
- Inbox / Outbox / Unread containers filter correctly.
- Thread ordering on `/members/:username` → Messages tab.
- Delete a message removes it from the container.
- SignalR live delivery between two browser contexts.
- Unread badge updates when a message arrives.

**`admin/`**
- Roles modal: add and remove roles, submit persists them through `admin/edit-roles/{username}`.
- Submit disabled when nothing changed (`isSubmitRolesEnabled()`).
- A promoted Moderator sees `/admin` with only the Post management tab.
- A demoted user loses the Admin nav entry.
- Post moderation tab lists content from `admin/contents-to-moderate`.
- Cleanup restores every role change.

**Done when:** green on all three browsers nightly, no `test.only`, no unconditional waits.
**Status:** ✅ 39/39 green on chromium (`npx playwright test --project=regression-chromium`, two
consecutive full runs today), `tsc --noEmit` clean, health (23/23) and smoke (13/13) re-verified green
afterwards. Not yet run on `--project=regression-firefox`/`-webkit` — only chromium was exercised this
session. Four real product-behaviour gaps and two page-object bugs surfaced and were documented or fixed;
see *Changes made* #17 and *Failed attempts* #16–19.

---

### Execution order

```
Step 0 ✅  →  6.1 health ✅  →  6.2 smoke ✅  →  6.3 regression ✅  →  7 e2e (pilot ✅, rest open)
```

Smoke used the `setup` project and `specs/fixtures/` already in place, so `testAddOffer.spec.ts` had its
image ready and no spec needed to log in through the UI unless that *is* what it tests.

Regression domains landed in the order above — auth and guards first, since everything else depends on a
working login and on knowing exactly what each role may reach. Still open for a future session: run the
suite on `regression-firefox`/`regression-webkit` (only chromium was verified here), wire CI (Step 0's
item 7), and fix the two real bugs `[ID: 39]` and `[ID: 72]` document rather than just assert.

`e2e` landed after regression specifically because it depends on knowing the regression suite's own shared
accounts (`MEMBER`/Lisa, `testRoles.spec.ts`'s `test_user_2`) well enough to deliberately avoid them — see
§4 item 18 and §7.5's per-row account choices. Still open: the four remaining §7.5 rows
(Photos/Main-photo-guard/Messaging/Registration), §7.6's DB-only integrity checks, and wiring `test:e2e`
into CI alongside Step 0's own still-open item 7.

---

## 7. UI ⇄ DB parity — verification plan

**Status: ✅ pilot implemented, rest of the backlog open.** `src/constants/queries/mssql/` and
`src/helpers/db/mssql.helper.ts` are real (§7.3), and four checks are live in `specs/tests/e2e/`
(`[ID: 73]`–`[ID: 76]`, §4 item 18) covering one row of §7.5's table per table in §7.2 that has UI-reachable
data (`AspNetUsers`, `Likes`, `Posts`, `AspNetUserRoles`). The remaining §7.5 rows (messaging, registration)
and all of §7.6 (DB-only integrity checks) are still just planned — this section stays the backlog for
those, and the rule holds for anything added to it: don't mark a row done without also adding an entry to
§4 *Changes made* the way every prior layer did.

### 7.1 What gap this closes

Every mutating regression test today proves **UI ⇒ API**: it acts through a Page Object, then calls
`ApiClient` and re-`GET`s the same resource to confirm the response matches (`testEditProfile.spec.ts`'s
`beforeEach`/`afterEach` snapshot, `testRoles.spec.ts`'s post-submit role check, etc.). It never proves
**API ⇒ DB** — that the row `UsersController`/`PostsController`/… claims to have saved is what is actually
committed in `TravelApp`. In practice API and DB agree almost always, which is exactly why this class of bug
survives: an interceptor that swallows a partial failure, a controller that returns the in-memory entity
before `SaveChangesAsync` actually persists a particular field, a cascade delete that doesn't fire the way
`AppDbContext.OnModelCreating` declares it should. §4 item 17 (the "stray `Regression inbound …` message"
in Jessie's inbox, invisible to the test runner and only caught by manually checking the API afterwards) is
the concrete precedent — that class of bug is exactly what a direct DB read catches mechanically instead of
by luck. Adding a direct SQL read after the existing UI/API assertion turns the two-point check into a
three-point **UI ⇒ API ⇒ DB** chain for the scenarios where the extra confidence is worth the query.

This section originally argued against a fourth test layer, proposing instead that a DB read be appended to
selected existing regression tests. **That recommendation was overridden**: the user explicitly asked for a
dedicated `specs/tests/e2e/` folder, so §4 item 18 built one — a fourth Playwright project alongside
health/smoke/regression (§1), with its own `LAYER_TAG.e2e`. The checks below still describe the same UI ⇒
API ⇒ DB chain; only where they live changed. §7.5/§7.6 keep their original "bolt onto an existing test" /
"new domain folder" phrasing where they're still just planned — read `specs/tests/e2e/*.spec.ts` for how
the four implemented checks actually turned out, standalone rather than editing an existing regression file.

### 7.2 Schema reference (verified against the EF migration, not just the entity classes)

`API/Entities/*.cs` names the `DbSet<Photo>` property `GeneralPhotos`, and it is tempting to assume the
table is called `Photos` — it isn't. Table names below come from
`API/Data/Migrations/20250302123454_InitialCreate.cs`, the actual `CreateTable` calls, cross-checked
against `AppDbContext.OnModelCreating` for FK/cascade behaviour. No custom `[Table]`/`ToTable()` renames
exist anywhere else in `API/`.

| Table (as created) | Backing entity | Columns a test is likely to read | Notes |
| --- | --- | --- | --- |
| `AspNetUsers` | `AppUser : IdentityUser<int>` | `Id`, `UserName`, `KnownAs`, `Description`, `Interests`, `City`, `Country`, `DateOfBirth`, `Gender`, `Created`, `LastActive` | Identity's default schema (`IdentityDbContext<AppUser, AppRole, int, …>`); `UserName` is lower-cased by the seed |
| `AspNetRoles` | `AppRole : IdentityRole<int>` | `Id`, `Name` | — |
| `AspNetUserRoles` | `AppUserRole : IdentityUserRole<int>` | `UserId`, `RoleId` | join table, no surrogate key |
| `GeneralPhotos` | `Photo` | `Id`, `Url`, `IsMain`, `PublicId`, `AppUserId` | **not** `Photos` — confirmed from the migration, see above |
| `Posts` | `Post` | `Id`, `Title`, `LocationCountry`, `LocationCity`, `Currency`, `PublicId`, `AppUserId`, plus every priced-section column (`MinPrice*`/`MaxPrice*`, `*Fee`, `PlaceStay`, `TypePlaceStay`, …) | — |
| `Likes` | `Like` | `AppUserId`, `PostId` | **composite PK**, no `Id`/surrogate column at all (`AppDbContext`: `HasKey(l => new { l.AppUserId, l.PostId })`); `OnDelete(DeleteBehavior.Cascade)` from `Posts` |
| `Messages` | `Message` | `Id`, `SenderUsername`, `RecipientUsername`, `Content`, `DateRead`, `MessageSent`, `SenderDeleted`, `RecipientDeleted`, `SenderId`, `RecipientId` | delete is two independent boolean flags, never a row delete (confirms §4 item 17's finding at the schema level) |
| `Groups` / `Connections` | `Group` / `Connection` | — | SignalR presence bookkeeping; out of scope for §7, nothing in the UI reads these directly |

### 7.3 Infrastructure — ✅ built (§4 item 18), differs from the original sketch below in three ways

1. ~~`npm i -D mssql @types/mssql`~~ → **`npm i -D mssql msnodesqlv8 @types/mssql`, plus `npm approve-scripts
   msnodesqlv8`.** Plain `mssql` (the `tedious` driver) cannot authenticate at all against this SQL Server
   instance — it runs Windows Integrated Security only, confirmed via
   `SELECT SERVERPROPERTY('IsIntegratedSecurityOnly')` = `1`, and `tedious` has no SSPI/Windows-Integrated
   support without a domain/username/password NTLM triple. `msnodesqlv8` (native ODBC) reaches it the same
   way the .NET API's own `SqlClient` does. Its postinstall script (fetch a prebuilt binary or
   `node-gyp rebuild`) is blocked by this environment's npm by default and needs an explicit
   `npm approve-scripts msnodesqlv8` once.
2. ~~A new `.env`/`.env.example` entry, e.g. `DB_CONNECTION` … read it in `specs/support/env.ts`~~ →
   **`DB_CONNECTION_STRING`, read directly inside `src/helpers/db/mssql.helper.ts` via `process.env`, not
   through `specs/support/env.ts`.** Same reasoning `browserHealth.helper.ts`'s `isOwnOrigin` already
   established for `src/helpers/`: a helper stays free of a dependency on the support layer. The value
   itself also isn't a `server\instance` string the way `Data:Connection` is — see the Named Pipe point
   below.
3. `src/helpers/db/mssql.helper.ts` — built as planned: one pooled connection, opened lazily and reused
   (`runMssqlQuery(query, params)`). **Not** closed from a `globalTeardown`: that hook runs in a separate
   process from the worker(s) that actually open the pool, so it can never reach that module's state
   anyway — Playwright already force-exits every worker once its tests finish, which is what actually
   tears the connection down. `closeMssqlPool()` is exported for a same-process script instead.
   The connection string itself turned out to need one more twist beyond "point at `TravelApp`": addressing
   the instance by `server\instance` name (`RUSLAN\SQLEXPRESS`, the same shape `Data:Connection` uses) hangs
   forever, because that resolution path needs SQL Server Browser (stopped on this machine, no TCP listener
   configured either) — see *Failed attempts* #21. The working string addresses the instance by its local
   Named Pipe directly: `Server=np:\\.\pipe\MSSQL$SQLEXPRESS\sql\query`.
4. `src/constants/queries/mssql/*.queries.ts` — built as planned, one file per table actually queried:
   `users.queries.ts`, `likes.queries.ts`, `posts.queries.ts`, `roles.queries.ts`. `photos.queries.ts` and
   `messages.queries.ts` are not created yet — nothing in `specs/tests/e2e/` reads those tables (§7.5's
   Photos/Main-photo-guard/Messaging rows are still open); add them when those rows land, not before.
5. **Not** wired into `playwright.config.ts`'s `use` or any project's options, as planned — it's a plain
   Node import inside `src/helpers/db/`.

### 7.4 Assertion pattern

```ts
// after the existing UI action + API re-GET, e.g. inside testEditProfile.spec.ts [ID: 59]
const [dbRow] = await runMssqlQuery(UsersQueries.getByUsername, { username: MEMBER.username });
expect({
  description: dbRow.Description,
  interests: dbRow.Interests,
  city: dbRow.City,
  country: dbRow.Country,
}).toEqual(updated);
```

- **No `expect.poll` needed for plain CRUD.** `SaveChangesAsync` commits synchronously within the HTTP
  request; by the time the UI's success toast (or the API's `200`) is observed, the row is already
  committed, unlike the genuinely async Cloudinary/SignalR round-trips `[ID: 60]`/`[ID: 68]` already need
  extra timeout headroom for (§4). Reserve polling for a DB assertion that follows one of those two, not for
  a bare EF `SaveChanges`.
- **Scope every query to the exact row the test itself owns** (`WHERE UserName = @username`,
  `WHERE Id = @postId`) — never an unscoped `SELECT TOP 1` or a count query that could pick up another
  test's data under `fullyParallel`. Same principle as the serial-mode fixes already in §4/§5 for shared
  seeded resources.
- A DB assertion is additive to an existing test's mutation status — it never turns an `@unmutation` test
  into a writer and never needs its own new `[ID: n]` unless it is a genuinely new scenario (§7.6).

### 7.5 Per-domain rollout

Four of eight rows are done — as a standalone `specs/tests/e2e/` file per §4 item 18, not bolted onto the
named existing test as originally sketched, and mostly against `test_user_2`/`test_user_3` rather than the
shared accounts the named existing test itself already owns (see item 18's own note on why).

| Domain | Existing UI-level test | DB assertion | Table(s) | Status |
| --- | --- | --- | --- | --- |
| Profile fields | `profile-and-photos/testEditProfile.spec.ts` `[ID: 59]` | query `AspNetUsers` by `UserName`; assert `Description`/`Interests`/`City`/`Country` equal the values just typed | `AspNetUsers` | ✅ `[ID: 73]`, `testProfileDb.spec.ts` (`test_user_2`) |
| Photos | `profile-and-photos/testEditProfile.spec.ts` `[ID: 60]` | after upload, query `GeneralPhotos` by `AppUserId`; assert row count is `before + 1` and exactly one row has `IsMain = 1` at every step (upload → set-main → restore → delete) | `GeneralPhotos` | ⬜ still open — needs `photos.queries.ts` |
| Main-photo guard | `profile-and-photos/testEditProfile.spec.ts` `[ID: 61]` | query `GeneralPhotos` for Lisa; assert `COUNT(*) WHERE IsMain = 1` is exactly `1`, matching the disabled buttons the UI shows | `GeneralPhotos` | ⬜ still open |
| Offers CRUD | `offers/testOfferLifecycle.spec.ts` | create: row exists in `Posts` with the submitted fields. Delete: row is gone **and** any `Likes` row referencing it is gone too (`OnDelete(DeleteBehavior.Cascade)`) | `Posts`, `Likes` | ✅ `[ID: 75]`, `testOffersDb.spec.ts` (`test_user_2` creates, `test_user_3` likes it first through the API so the cascade has a real row to remove) |
| Likes | `likes-and-lists/testLikes.spec.ts` | after like: one `Likes` row with the exact `(AppUserId, PostId)` pair exists. After unlike: it's gone | `Likes` | ✅ `[ID: 74]`, `testLikesDb.spec.ts` (`test_user_2`) |
| Messaging | `messaging/testMessaging.spec.ts` | after send: `Messages` row exists with matching `Content`, `MessageSent` set, both delete flags `0`. After one party deletes: assert **only that party's** flag flipped and the row still exists | `Messages` | ⬜ still open — needs `messages.queries.ts` |
| Roles | `admin/testRoles.spec.ts` | join `AspNetUserRoles` → `AspNetRoles` for the target `UserId`; assert the role-name set matches what the modal showed pre-submit | `AspNetUserRoles`, `AspNetRoles` | ✅ `[ID: 76]`, `testRolesDb.spec.ts` (`test_user_3`, not `testRoles.spec.ts`'s own `test_user_2` — see item 18) |
| Registration | `auth/testRegistration.spec.ts` | query `AspNetUsers` by the newly chosen username; assert the row matches the submitted fields. **No cleanup path exists** (no delete-account flow in the app) — needs the plan's one sanctioned direct-write exception (`DELETE FROM AspNetUsers WHERE Id = @id`, scoped to the exact id just read back) | `AspNetUsers` | ⬜ still open |

### 7.6 New DB-only integrity checks — ✅ built as the `database` layer (§4 item 23)

These have no single UI action to hang off of; they check an invariant the UI relies on implicitly.

| Proposed check | Why it matters |
| --- | --- |
| Every seeded user has **exactly one** `GeneralPhotos` row with `IsMain = 1` | The nav avatar and member-card `<img src>` assume exactly one main photo exists; a seed or migration bug that leaves zero or two would silently render a broken image or a non-deterministic one, and nothing today asserts this fact about the DB itself |
| No `Likes` row references a `PostId` that no longer exists in `Posts` | Directly verifies the cascade FK in `AppDbContext.cs:53-55` holds for the seeded data set as a whole, independent of any single delete test's timing — `[ID: 75]` (§7.5) already proves the cascade fires for *one* row it creates itself; this would prove no *other* row has ever violated it |
| No `Messages` row has both `SenderDeleted = 1 AND RecipientDeleted = 1` while still present — i.e. a row is deleted outright when (and only when) both sides have deleted it, never left as dead weight, never removed early | Encodes the invariant `MessagesController.DeleteMessage` is supposed to enforce; a regression here is invisible from either party's own inbox alone (each independently sees "gone"), which is exactly why it slipped through once already (§4 item 17) |

All three are read-only and `@unmutation`. They landed in their own `database` layer, not in `specs/tests/e2e/`
as this section first planned: e2e crosses the UI and the database by definition, and these need neither the UI
nor the API. `specs/tests/database/testDataIntegrity.spec.ts` holds `[ID: 131]` (every seeded member has exactly
one main photo, next to `[ID: 130]`: nobody has several), `[ID: 132]` (no orphan like) and `[ID: 133]` (no message
kept after both sides deleted it); `testSchema.spec.ts` adds `[ID: 128]` (applied migrations) and `[ID: 129]`
(the `Likes` → `Posts` cascade itself).

### 7.7 Rollout order

```
DB-0 (infra: §7.3) ✅  →  [ID: 73] pilot (§7.5, simplest schema) ✅  →  [ID: 74]-[ID: 76] ✅
  →  §7.6 ✅ (the `database` layer)
  →  still open: Photos/Main-photo-guard/Messaging/Registration rows (§7.5), wire into CI
```

The pilot ran exactly as planned: `testProfileDb.spec.ts` (`AspNetUsers`, no composite key, no FK cascade
to reason about) went first and proved the helper + query-constants pattern before `testLikesDb.spec.ts`
touched `Likes`' composite key or `testOffersDb.spec.ts` touched the FK cascade.

### 7.8 Risks carried over from existing experience

- **Connection lifetime.** Per §7.3, pool once per worker process, lazily. A per-test `connect()` repeats
  the mistake the framework specifically avoided for the API (`ApiClient` reuses a token per test, not per
  request) — and, as built, is never explicitly closed either; Playwright force-exits each worker once its
  tests finish, which is what actually tears the pool's connection down (§7.3 point 3).
- **Parallelism.** The same class of bug §4/§5 already hit twice (`testRoles.spec.ts`,
  `testMessaging.spec.ts`, `[ID: 59]`/`[ID: 60]`'s shared snapshot) applies again here: two tests reading
  *and* writing the same row concurrently under `fullyParallel` will race even if the DB read itself is
  correct. Any new §7.6 check that reads shared seed data stays `@unmutation` and read-only for exactly this
  reason; any §7.5 assertion added to an already-serial describe block (`[ID: 59]`/`[ID: 60]`,
  `testRoles.spec.ts`) inherits that protection for free.
- **Secrets.** If this suite is ever pointed at a shared/CI SQL Server instance rather than a local one, the
  DB connection string becomes exactly as sensitive as the credentials in `.env` — same git-ignore treatment.
  As built, the fallback default lives inside `mssql.helper.ts` itself rather than `env.ts` (§7.3 point 2),
  but the same caution applies: that default describes *this* machine's local, credential-free Windows-auth
  setup, not a value safe to keep hard-coding once a real password or a non-local server is ever involved.
