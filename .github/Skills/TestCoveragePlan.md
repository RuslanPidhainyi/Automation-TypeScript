# Test Coverage Plan — EW TravelApp

Living document. It records what we are covering, where the framework actually stands, which files are in
play, what has landed, which approaches already failed, and what to write next.

Companion to [`RulesForDescribingAPage.md`](./RulesForDescribingAPage.md), which owns the page-object
conventions. This file owns the **specs**.

> Sections *Changes made* and *Failed attempts* are **append-only**. Every session adds to them instead of
> rewriting history.

---

## 1. Goal

Cover the Angular 17 client of EW TravelApp with Playwright end-to-end tests, split into three
independently runnable layers with a clear promotion path.

| Layer | Question it answers | Budget | Runs |
| --- | --- | --- | --- |
| **healthCheck** | Is the stack up and are the contracts intact? | < 30 s | before everything, gates the rest |
| **smoke** | Does every core happy path still work? | < 5 min, chromium | on every PR |
| **regression** | Does the whole behaviour still hold, including negatives? | unbounded, 3 browsers | nightly |

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

---

## 2. Current state

| Area | State |
| --- | --- |
| Page-object layer | ✅ **Complete** — 15 files under `src/PageObjects/` (renamed from `src/Pages/`), 14/14 routes, documented in `RulesForDescribingAPage.md` |
| `specs/support/` | ✅ `env.ts` (URLs, credentials, `MEMBER`/`ADMIN`, `TEST_USER_1..5`, `AUTH_STRATEGY`, `FIXTURES`), `ApiClient.ts`, `auth.ts` + `auth.setup.ts`, `signIn.ts`, `index.ts` barrel |
| `specs/fixtures/` | ✅ `travel-photo.jpg` (800×600, ~25 kB, generated) + `README.md` |
| `specs/tests/healthCheck/` | ✅ **`api.spec.ts` + `app.spec.ts` + `test_Auth.spec.ts` — 23 checks in 3 files** |
| `specs/tests/smoke/` | ⬜ exists, **empty** — infrastructure ready |
| `specs/tests/regression/` | ⬜ exists, **empty** |
| `playwright.config.ts` | ✅ `testDir: './specs/tests'`, `baseURL`, `ignoreHTTPSErrors`, `setup` + one project per layer + a `Google Chrome` branded-browser project |
| `scripts/run-tests.js` | ✅ pytest-flag CLI shim (`-v/-s`, `-k`, `--tracing=`) in front of `playwright test`; `npm test`/`test:*` go through it |
| `.env` | ✅ filled + `.env.example` committed (still missing `TEST_USER_2..5` keys, see *Failed attempts*); `dotenv` and `typescript` installed |
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

### Seeded accounts

| Account | Password | Roles |
| --- | --- | --- |
| `Lisa` (+ 9 more from `API/Data/UserSeedData.json`) | `Pa$$w0rd2024` | `Member` |
| `admin` | `Admin2024` | `Admin`, `Moderator` |

There is **no Moderator-only account**. To cover Moderator behaviour, promote a member through
`/admin` → roles modal inside the test and demote them in cleanup.

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
| `specs/tests/healthCheck/api.spec.ts`, `app.spec.ts`, `test_Auth.spec.ts` (3) | the health layer | stable |
| `scripts/run-tests.js` | pytest-flag CLI shim in front of `playwright test`, invoked by every `npm run test:*` script | stable |

### Config & CI

| Path | Role | Status |
| --- | --- | --- |
| `playwright.config.ts` | `testDir`, `baseURL`, one project per layer, plus an unscoped `Google Chrome` branded-browser project | stable |
| `.env` / `.env.example` | credentials and URLs — `.env` has `TEST_USER_1..5`/`AUTH_STRATEGY`, `.env.example` only documents `TEST_USER_1` | **needs change** |
| `package.json` | `test` / `test:health` / `test:smoke` / `test:regression` / `typecheck` now run through `scripts/run-tests.js`, `dotenv`, `typescript` | stable |
| `scripts/run-tests.js` | pytest-flag shim (`-v`/`-s`, `-k`, `--tracing=`) in front of `playwright test` | stable |
| `tsconfig.json` | TS config — `include` still lists the deleted `tests/`, harmless | stable |
| `.github/workflows/playwright.yml` | CI | **needs change** (Step 0.7) |
| `README.md` | prerequisites, the three layers, structure | stable |

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
    `specs/tests/healthCheck/test_Auth.spec.ts` — 10 tests (`[ID: 0]`–`[ID: 9]`), tagged and titled per
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
| 12 | Documenting only `TEST_USER_1`/`TEST_PASSWORD_1` in `.env.example` when `env.ts` reads `TEST_USER_1..5` | A machine that copies `.env.example` to `.env` gets a working `TEST_USER_1` and four accounts silently falling back to the hard-coded defaults in `env.ts` — fine until the target database doesn't have `test_user_2..5` seeded under those exact names, which then fails four of the ten `test_Auth.spec.ts` checks with no hint why | Add the remaining four accounts to `.env.example` before the next session touches this file — flagged, not yet done |

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
| `api.spec.ts` | `POST account/login` with the seeded member | 200, JWT `token` whose `unique_name` and `role` match, `username` (lower-cased by the seed), `knownAs` |
| | `POST account/login` with the seeded admin | 200, token carries `Admin` **and** `Moderator` |
| | `POST account/login` with a wrong password | 401 |
| | `GET posts` without a token | 401 |
| | `GET posts` with a token | 200, non-empty array — the seed ran and the DB answers |
| | `GET buggy/not-found` | 404 (also proves the DB answers: it runs `Users.Find(-1)`) |
| | `GET buggy/server-error` | 500 |
| | `GET buggy/bad-request` | 400 |
| | `GET buggy/auth` without a token | 401 |
| | 500 body | `ApiException` shape — `statusCode`, `message`, `application/json` |
| `app.spec.ts` | `GET` the client root | 200, title `TravelApp`, the login card renders |
| | Page load | no `console.error`, no uncaught error, no failed request to the client origin |
| | Client → API reachability | `fetch` **inside the page** reaches `apiUrl` and gets 404 → CORS admits the client origin |
| `test_Auth.spec.ts` | `[ID: 0]` `test_user_1` (no role) signs in **through the login form** | lands on `/offers`, nav greeting matches the username |
| | `[ID: 1]` `test_user_2` (**Member**) signs in **through the login form** | same |
| | `[ID: 2]` `test_user_3` (**Moderator**) signs in **through the login form** | same |
| | `[ID: 3]` `test_user_4` (**Admin**) signs in **through the login form** | same |
| | `[ID: 4]` `test_user_5` (**Moderator + Admin**) signs in **through the login form** | same |
| | `[ID: 5]`–`[ID: 9]` | same five accounts, signing in **with a token planted into `localStorage`** instead | `account/login` succeeds, the planted session survives a reload, lands on `/offers` with the matching nav greeting |

Ignored console/network noise lives in one place — `IGNORED_NOISE` in `app.spec.ts`. Extend that list
instead of loosening the assertions.

**Done when:** green in under 30 s, no dependency on any other layer.
**Status:** ✅ 23/23 green against a live stack in 11.7 s (`npm run test:health -- --project=health`, run
today), no login state created by `api.spec.ts`/`app.spec.ts`, no data touched; `test_Auth.spec.ts` does
sign in (both through the UI and by planting a token) but performs no writes.

---

### 6.2 `specs/tests/smoke/` — happy paths (chromium)

| File | Scenario | Assertion |
| --- | --- | --- |
| `auth.smoke.spec.ts` | Login as `Lisa` from the login card | lands on `/offers`, nav shows `Welcome Lisa` |
| | Logout from the user menu | back on `/`, login form visible |
| `navigation.smoke.spec.ts` | Visit each route via the nav bar | every page's `uniqueElement` is visible |
| | Nav links per role | member sees Offers/Lists/Messages; admin also sees Admin/Errors (`visibleNavLinks()`) |
| `offers.smoke.spec.ts` | Open `/offers` | at least one card, `isEmpty()` false |
| | Open the first card | `/offers/:id` with the same title |
| `addOffer.smoke.spec.ts` | `attachPhoto()` + `publish()` | success toast; the post appears on `/member/profile` |
| | cleanup | delete via API in `afterEach` |
| `likes.smoke.spec.ts` | Toggle like on a card | the post appears on `/lists` |
| | cleanup | untoggle to restore the original state |
| `profile.smoke.spec.ts` | Open `/member/profile` | sidebar + Posts and About tabs render |
| `messages.smoke.spec.ts` | Send a message from the `/members/:username` Messages tab | the message shows up in Outbox |
| `admin.smoke.spec.ts` | Admin opens `/admin` | User management tab lists users with their roles |

**Done when:** green on chromium in under 5 min and wired into the PR workflow.

---

### 6.3 `specs/tests/regression/` — full behaviour (3 browsers)

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

---

### Execution order

```
Step 0 ✅  →  6.1 health ✅  →  6.2 smoke ⬅ next  →  6.3 regression (one PR per domain)
```

Smoke can start immediately — the `setup` project and `specs/fixtures/` are in place, so
`addOffer.smoke.spec.ts` has its image and no spec needs to log in through the UI unless that *is* what it
tests.

Regression domains land in the order above — auth and guards first, since everything else depends on a
working login and on knowing exactly what each role may reach.
