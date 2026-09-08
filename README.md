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
npm install
npx playwright install
cp .env.example .env      # then adjust URLs / credentials if needed
```

`.env` is git-ignored; `.env.example` documents every key.

## The three layers

| Layer | Question it answers | Budget | Command |
| --- | --- | --- | --- |
| **health** | Is the stack up and are the contracts intact? | < 30 s | `npm run test:health` |
| **smoke** | Does every core happy path still work? | < 5 min, chromium | `npm run test:smoke` |
| **regression** | Does the whole behaviour still hold? | nightly, 3 browsers | `npm run test:regression` |

Health gates the rest: if it is red, the stack is down and the other layers cannot say anything
useful. It needs no login state and creates no data.

## Running tests

```bash
npm test              # every layer, headless
npm run test:health   # the gate - API contract + client availability
npm run test:headed   # run with a visible browser
npm run test:ui       # interactive UI mode (see "UI mode & Playwright Inspector" below)
npm run test:debug    # Playwright Inspector - headed, paused, step-through (see below)
npm run typecheck     # tsc --noEmit over src/ and specs/
npm run report        # open the last HTML report
```

Run a single file or test:

```bash
npx playwright test specs/tests/healthCheck/api.spec.ts
npx playwright test specs/tests/healthCheck/api.spec.ts -g "401"
```

### Running by tag

Every test carries an `@<n>` ID tag plus exactly one layer tag (`@healthCheck` / `@smoke` /
`@regression`) — see `RulesForWritingTests.md` §6. Both come from named constants in
`specs/support/tags.ts` (`idTag(n)`, `LAYER_TAG.healthCheck` etc.), never hand-typed strings in the spec
itself, but at the CLI they are matched as plain text with Playwright's own `-g`/`--grep` (there is no
`--grep-invoke-tag` flag — that name doesn't exist in `@playwright/test`):

```bash
npx playwright test --project=health -g "@healthCheck"   # every test tagged @healthCheck
npx playwright test --project=health -g "@3"              # just [ID: 3], wherever it lives
npx playwright test --project=health -G "@healthCheck"    # everything except @healthCheck
```

Always pass `--project=` alongside a tag/file filter. Without it Playwright also matches the unscoped
`Google Chrome` project (see `playwright.config.ts`), which has no `testDir` of its own and so runs the
same file a second time.

### UI mode & Playwright Inspector

Both are built into `@playwright/test` and already wired as npm scripts — nothing extra to install.

**UI mode** (`--ui`) opens an interactive window: pick tests from a tree, run them, and step through the
timeline/DOM snapshot/network/console for each one after the fact.

```bash
npm run test:ui                                                    # whole suite, pick tests in the UI
npm run test:ui -- specs/tests/healthCheck/test_Auth.spec.ts       # scoped to one file
npx playwright test --ui --project=health -g "@3"                  # scoped to one tagged test
```

**Playwright Inspector** (`--debug`) is a shortcut for `PWDEBUG=1` plus `--timeout=0 --max-failures=1
--headed`: it opens a real, visible browser paused at the first action, with step/resume controls and a
locator picker.

```bash
npm run test:debug                                                  # whole suite, headed, paused at start
npm run test:debug -- specs/tests/healthCheck/test_Auth.spec.ts -g "@3"   # a single test
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

## Project structure

```
src/PageObjects/       page objects, one per route (see .github/Skills/RulesForDescribingAPage.md)
specs/support/         env/credentials, the API client, and the auth setup project
specs/fixtures/        files the specs upload (reach them through FIXTURES)
specs/tests/
├── healthCheck/       is the stack up?           (project: health)
├── smoke/             core happy paths           (project: smoke)
└── regression/        full behaviour             (projects: regression-chromium|firefox|webkit)
playwright.config.ts   testDir, baseURL, setup + one project per layer
```

### Signing in

The `setup` project logs in once per role and saves the browser state to `playwright/.auth/`. It runs
automatically before `smoke` and `regression` (not before `health` — the gate stands alone). A spec opts in
per file, so the specs that test login itself stay anonymous:

```ts
import { STORAGE_STATE } from '../../support';

test.use({ storageState: STORAGE_STATE.member });   // or STORAGE_STATE.admin
```

Coverage status and the backlog live in [`.github/Skills/TestCoveragePlan.md`](.github/Skills/TestCoveragePlan.md).

## CI

`.github/workflows/playwright.yml` runs the suite on push/PR. It does **not** start the API or the
client yet, so it cannot pass until the workflow brings the stack up on the runner — see Step 0.7 of
the coverage plan.
