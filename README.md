# Automation-TypeScript

End-to-end tests for **EW TravelApp** (Angular 17 client + .NET 8 API), built with
[Playwright](https://playwright.dev/) and TypeScript.

## Prerequisites

- Node.js 18+ and npm
- The application under test running locally:
  - API — `dotnet run` in `EW-TravelApp-.Net8-Angular17/API` → `https://localhost:5001`
  - client — `npm start` in `EW-TravelApp-.Net8-Angular17/Client` → `https://localhost:4200`

Both serve HTTPS with self-signed certificates, so the config sets `ignoreHTTPSErrors: true`.

If the API cannot reach SQL Server, override the connection string from the environment instead of editing
`API/appsettings.Development.json` (the database is created and seeded on first run):

```bash
Data__Connection="Data Source=.\SQLEXPRESS;Integrated Security=true;Database=TravelApp;Trust Server Certificate=true" \
  ASPNETCORE_ENVIRONMENT=Development dotnet run --no-launch-profile --urls "https://localhost:5001;http://localhost:5000"
```

## Setup

```bash
npm install               # also installs the pre-commit hook (see "Quality gate")
npx playwright install
```

Credentials, URLs and optional settings live in `.env` in the project root. It is git-ignored and it is the
only env file: every key the suite reads is listed there, the optional ones commented out.

## The layers

| Layer | Question it answers | Budget | Command |
| --- | --- | --- | --- |
| **health** | Is the stack up and are the contracts intact? | < 30 s | `npm run test:health` |
| **smoke** | Does every core happy path still work? | < 5 min, chromium | `npm run test:smoke` |
| **regression** | Does the whole behaviour still hold? | nightly, 3 browsers | `npm run test:regression` |
| **e2e** | Does the UI's data actually match what's in the database? | chromium, needs SQL Server access | `npm run test:e2e` |
| **api** | Does every route let in exactly the right callers, and refuse a bad request properly? | seconds, no browser, needs only the API | `npm run test:api` |
| **database** | Do the schema and the stored data keep their invariants? | seconds, no browser, needs only SQL Server | `npm run test:database` |
| **accessibility** | Does axe-core find no violation on any screen, in any state a user can open? | ~1 min, chromium | `npm run test:a11y` |
| **visual** | Do the screens that show no data still look the same? | seconds, chromium, **local only** | `npm run test:visual` |

Health gates the rest: if it is red, the stack is down and the other layers cannot say anything
useful. It needs no login state and creates no data.

Run `api` on its own rather than alongside `regression` or `e2e`: those promote and demote the test accounts,
and the authorization matrix reads each account's roles from the token it signs in with.

## Running tests

```bash
npm test              # every layer, headless
npm run test:all      # every layer in pipeline order, one merged HTML report opened at the end (see below)
npm run test:health   # the gate - API contract + client availability
npm run test:api      # authorization matrix + refused requests, straight against the API
npm run test:database # schema + data invariants, straight against SQL Server
npm run test:a11y     # axe-core over every screen and every state a user can open
npm run test:visual   # screenshots against the committed baselines (local only)
npm run test:headed   # run with a visible browser
npm run test:ui       # interactive UI mode (see "UI mode & Playwright Inspector" below)
npm run test:debug    # Playwright Inspector - headed, paused, step-through (see below)
npm run typecheck     # tsc --noEmit over src/ and specs/
npm run lint          # ESLint, zero warnings allowed
npm run check         # typecheck + lint - what the pre-commit hook runs
npm run report        # open the last HTML report
```

Run a single file or test:

```bash
npx playwright test specs/tests/healthCheck/testApi.spec.ts
npx playwright test specs/tests/healthCheck/testApi.spec.ts -g "401"
```

On a slower machine or runner, stretch every timeout at once instead of editing specs:

```bash
TIMEOUT_MULTIPLIER=2 npm test
```

### Every layer, one report

`npm run test:all` runs the layers in the order CI does, one `playwright test` per phase, and merges the phases
into a single HTML report that opens when the run is over (`http://localhost:9323`, Ctrl+C to close it;
`npm run report` opens it again later). If a report from an earlier run is still being served there, reload that tab -
it reads `playwright-report/` from disk:

```
seed-users -> health -> api + database -> smoke, regression (3 browsers), e2e, accessibility, visual, Google Chrome
```

The order comes from the phases, not from the projects' `dependencies`, so a red phase does not hide the ones after
it - except health: when it fails the stack is down and the remaining phases are skipped. `api` runs before the
phases that promote and demote the test accounts. The pytest-style flags work here too. Locally nothing is retried,
so the default `on-first-retry` records no trace - add `--tracing=retain-on-failure` to get one for every failed test:

```bash
npm run test:all
npm run test:all -- -k "@smoke" --tracing=retain-on-failure
```

### Running by tag

Every test carries an `@<n>` ID tag plus exactly one layer tag (`@healthCheck` / `@smoke` /
`@regression` / `@e2e` / `@api` / `@database` / `@accessibility` / `@visual`) — see `RulesForWritingTests.md` §6. Both come from named constants in
`specs/support/tags.ts` (`idTag(n)`, `LAYER_TAG.healthCheck` etc.), never hand-typed strings in the spec
itself, but at the CLI they are matched as plain text with Playwright's own `-g`/`--grep` (there is no
`--grep-invoke-tag` flag — that name doesn't exist in `@playwright/test`):

```bash
npx playwright test --project=health -g "@healthCheck"   # every test tagged @healthCheck
npx playwright test --project=health -g "@3"              # just [ID: 3], wherever it lives
npx playwright test --project=health -G "@healthCheck"    # everything except @healthCheck
```

Always pass `--project=` alongside a tag/file filter. Without it every project whose `testDir` holds the file
runs it - a smoke spec, for one, also runs in the `Google Chrome` project, which repeats smoke in the branded
Chrome installed on the machine (see `playwright.config.ts`).

### UI mode & Playwright Inspector

Both are built into `@playwright/test` and already wired as npm scripts — nothing extra to install.

**UI mode** (`--ui`) opens an interactive window: pick tests from a tree, run them, and step through the
timeline/DOM snapshot/network/console for each one after the fact.

```bash
npm run test:ui                                                    # whole suite, pick tests in the UI
npm run test:ui -- specs/tests/healthCheck/testAuth.spec.ts       # scoped to one file
npx playwright test --ui --project=health -g "@3"                  # scoped to one tagged test
```

**Playwright Inspector** (`--debug`) is a shortcut for `PWDEBUG=1` plus `--timeout=0 --max-failures=1
--headed`: it opens a real, visible browser paused at the first action, with step/resume controls and a
locator picker.

```bash
npm run test:debug                                                  # whole suite, headed, paused at start
npm run test:debug -- specs/tests/healthCheck/testAuth.spec.ts -g "@3"   # a single test
```

Setting `PWDEBUG=1` directly does the same thing for any command, including the layer scripts:

```bash
# bash / macOS / Linux
PWDEBUG=1 npm run test:health
```

```powershell
# PowerShell
$env:PWDEBUG = '1'; npm run test:health
```

To pause mid-test at an exact line instead of only at the start, drop `await page.pause();` into the spec
temporarily — it opens the Inspector right there, with or without `--debug`. Remove it before committing.

### pytest-style flags

`npm test`/`npm run test:*` go through `scripts/run-tests.js`, a thin shim that translates the
pytest-style flags the team is used to into their `@playwright/test` equivalent before handing
everything else straight to `playwright test`:

| Flag | Translated to |
| --- | --- |
| `-v`, `-s` | `--reporter=list` (the configured `html` reporter prints nothing while the run is in progress) |
| `-k <pattern>` | `--grep <pattern>` (substring/regex on the test title, not pytest's `-k` boolean expressions) |
| `--tracing=on` \| `off` \| ... | `--trace=on` \| `off` \| ... |
| `--headed` | passed through unchanged - already a native Playwright flag |

```bash
npm test -- -v -s --headed --tracing=on -k "sign in"
npm run test:health -- -v -k "token"
node scripts/run-tests.js -k "token" --tracing=on
```

### Visual baselines

`npm run test:visual` compares the screens that show no data - login, registration, not-found and the empty add-post form -
with the images in `specs/tests/visual/testScreens.spec.ts-snapshots/`. They are rendered on Windows, so the `visual`
project runs locally only and CI never lists it. After an intended change to one of those screens:

```bash
npm run test:visual -- --update-snapshots   # then review the new images before committing them
```

## Reports

Besides the HTML report, a run writes `reports/test-ids.json` and `reports/test-ids.csv` (`src/reporters/testIdReporter.ts`,
git-ignored): one row per test and project, with its `[ID: n]`, layer and mutation tags, outcome, retries, duration and
the product issues annotated on it. A test that caught a product defect carries it as an `issue` annotation
(`specs/support/issues.ts`), which the HTML report shows on the test too. `npm run test:all` and CI write the files from
the merged report.

## Test agents

`.claude/agents/` holds the three [Playwright Test Agents](https://playwright.dev/docs/test-agents) for Claude Code, and
`.mcp.json` the MCP server they drive the browser through (`npx playwright run-test-mcp-server`, started with `PW_AGENTS=1`):

| Agent | Does |
| --- | --- |
| `playwright-test-planner` | explores the running application from `test-plans/seed.spec.ts` (test_user_2 signed in, on /offers) and saves a Markdown test plan into `test-plans/` |
| `playwright-test-generator` | turns a plan into specs that follow `.github/Skills/RulesForWritingTests.md` and `RulesForDescribingAPage.md` |
| `playwright-test-healer` | debugs a failing spec; when the application itself is at fault it reports the defect instead of changing the test |

The `agents` project that runs the seed exists only while `PW_AGENTS=1`, so no ordinary run picks it up. To regenerate
the agent files run `PW_AGENTS=1 npx playwright init-agents --loop=claude --project=agents`, then restore the
"Project rules" block at the top of each agent's instructions.

## Quality gate

`npm run check` type-checks the project and runs ESLint (`eslint.config.mjs`) with zero warnings allowed:
the TypeScript rules catch a forgotten `await`, and `eslint-plugin-playwright` enforces the spec rules —
no raw locators, no branching inside a test, web-first assertions, no numeric timeouts. The pre-commit hook
(`.husky/pre-commit`) runs ESLint on the staged files plus the type check and refuses a commit that fails.
What each rule enforces is in `.github/Skills/RulesForWritingTests.md` §10.

## Project structure

```
src/PageObjects/       page objects, one per route (see .github/Skills/RulesForDescribingAPage.md)
src/api/               the .NET API as typed controllers behind TravelApi
src/constants/         API routes, SQL queries, timeouts, shared test data, toast texts
src/helpers/           technical helpers: DB access, data factories, API stubs, time, browser checks, .env loading
src/models/            API bodies (zod schemas) and database row shapes
src/reporters/         testIdReporter - reports/test-ids.json and .csv
specs/support/         the suite's test and expect (fixtures, matchers), personas, cleanup, product issues, env/credentials, setup projects
specs/fixtures/        files the specs upload (reach them through FIXTURES)
specs/tests/
├── healthCheck/       is the stack up?           (project: health)
├── smoke/             core happy paths           (project: smoke)
├── regression/        full behaviour             (projects: regression-chromium|firefox|webkit)
├── e2e/               UI ⇒ API ⇒ DB parity       (project: e2e)
├── api/               routes, roles, refusals    (project: api)
├── database/          schema + data invariants   (project: database)
├── accessibility/     axe-core on every screen   (project: accessibility)
└── visual/            screenshot baselines       (project: visual, local only)
playwright.config.ts   testDir, baseURL, timeouts, setup + one project per layer
test-plans/            Markdown test plans and the seed of the Playwright Test Agents
.claude/agents/        the planner, generator and healer agents; .mcp.json starts their MCP server
eslint.config.mjs      the lint rules behind `npm run check`
```

### Signing in

Specs sign in only as the test accounts `test_user_1`…`test_user_5` from `.env`, one per role combination.
The seeded accounts `.env` also lists (Lisa, Bob, admin) are for manual runs; no spec touches them.

The `setup` project logs in once per role — `member` is `test_user_2`, `adminModerator` is `test_user_5` — and saves
the browser state to `playwright/.auth/`. It also makes sure `test_user_2` has a main photo
(`specs/support/data.setup.ts`). It runs automatically before `smoke`, `regression` and `e2e` (not before
`health` — the gate stands alone). A spec opts in per file, so the specs that test login itself stay anonymous:

```ts
import { test } from '../../support';

test.use({ persona: 'member' });   // or 'adminModerator'
```

Coverage status and the backlog live in [`.github/Skills/TestCoveragePlan.md`](.github/Skills/TestCoveragePlan.md);
the planned framework changes in
[`.github/Skills/Модифікація проєкту по автоматизації.md`](.github/Skills/Модифікація%20проєкту%20по%20автоматизації.md).

## CI

`.github/workflows/playwright.yml` brings the whole stack up on an Ubuntu runner and runs the layers in
pipeline order - on every push to `master` and every pull request, every night at 02:00 UTC with regression
added, and on demand (*Run workflow*, with a checkbox for regression).

1. SQL Server 2022 starts as a service container; the job waits until it answers.
2. This repository and the application (`RuslanPidhainyi/EW-TravelApp-.Net8-Angular17`, branch `vars.APP_REF`,
   default `main`, into `app/`) are checked out; .NET 8, Node, the client, the suite and Chromium are installed,
   and `dotnet dev-certs https` gives the API a certificate.
3. `npx playwright test --project=smoke --project=accessibility --project=e2e --shard=i/n` does the rest - one shard on a
   push or a pull request, three at night and on demand, when regression joins. Playwright runs a project's
   dependencies in every shard, so each runner walks the whole chain on its own stack. `START_STACK=1` makes the config's
   `webServer` start the API (`dotnet run`, HTTPS on 5001 - it migrates and seeds the empty database first) and the
   client (`ng serve --ssl=false`, HTTP on 4200). With `CI` set, every layer depends on the one below it, so the
   two projects pull in the whole chain and each layer runs only after the previous one passed:

   ```
   seed-users -> health -> api + database -> setup -> smoke + accessibility + e2e   (+ regression in three browsers at night)
   ```

   `seed-users` (`specs/support/users.seed.ts`) registers `test_user_1`…`test_user_5` on the fresh database and
   grants their roles as the seeded admin. Where the accounts already exist it changes nothing.
4. Every shard uploads a blob report (and, when it fails, its `test-results/`). The `report` job merges the blobs with
   `merge-reports` into `playwright-report/`, `reports/junit.xml` and `reports/test-ids.*`, uploaded as the
   `playwright-report` artifact.

On the runner the suite reaches the database with `DB_DRIVER=tedious` and a SQL login; locally it keeps the native
`msnodesqlv8` driver over the Named Pipe (`src/helpers/db/mssql.helper.ts`). `msnodesqlv8` is an optional
dependency, so `npm ci` succeeds on a machine that cannot build it.

The application code the workflow checks out must contain what the suite expects - the `data-testid` hooks and the
`LikesController` / `PostsController.UpdatePost` fixes - so merge those into `main` (or point `APP_REF` at their
branch) before relying on a green run.

### Secrets and variables

*Settings → Secrets and variables → Actions*:

| Secret | Value |
| --- | --- |
| `MSSQL_SA_PASSWORD` | any password SQL Server accepts (8+ characters, three of: upper case, lower case, digit, symbol) - the container is created with it |
| `TOKEN_KEY` | the API's `TokenKey`, at least 64 characters (`TokenService`) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | the Cloudinary account photo uploads go to |
| `ADMIN_USER`, `ADMIN_PASSWORD` | the seeded admin - `admin` and the password `API/Data/Seed.cs` creates it with |
| `TEST_USER_1`…`TEST_USER_5`, `TEST_PASSWORD_1`…`TEST_PASSWORD_5` | the test accounts, as in `.env`; passwords 9-21 characters with an upper-case letter, a lower-case letter and a digit, or `account/register` refuses them |
| `APP_REPO_TOKEN` | optional - only if the application repository is private |

| Variable | Value |
| --- | --- |
| `APP_REF` | optional - the application branch to test, `main` by default |

Every run on a fresh database uploads one photo to Cloudinary for `test_user_2` (`specs/support/data.setup.ts`)
and does not delete it - the database it belonged to is gone when the job ends.

### Running like CI on your machine

`START_STACK=1` works locally too: the API and the client are started unless they are already running (outside CI a
running server is reused). The rest of the CI setup can be reproduced against a SQL Server container:

```bash
docker run -d --name ew-ci-mssql -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='<password>' -p 14330:1433 \
  mcr.microsoft.com/mssql/server:2022-latest

CI=1 START_STACK=1 BASE_URL=http://localhost:4200 TIMEOUT_MULTIPLIER=2 \
DB_DRIVER=tedious DB_PORT=14330 DB_USER=sa DB_PASSWORD='<password>' \
Data__Connection='Server=localhost,14330;Database=TravelApp;User Id=sa;Password=<password>;TrustServerCertificate=True' \
  npx playwright test --project=smoke --project=e2e
```

With `CI` set nothing may already listen on 4200, 5000 or 5001 - stop the stack you started by hand first.
