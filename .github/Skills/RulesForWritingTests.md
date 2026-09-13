# Rules for Writing Tests — EW TravelApp

Companion to [`RulesForDescribingAPage.md`](./RulesForDescribingAPage.md), which owns the page-object
layer, and [`TestCoveragePlan.md`](./TestCoveragePlan.md), which owns the three layers and the backlog.
This file owns **what is and isn't allowed to live inside a `*.spec.ts` file**.

## The rule in one sentence

A spec file reads like a scenario — open a page, call a handful of named actions, assert — and nothing
else. Locators, SQL, and multi-line utility logic are never written *at* the test; they are written *once*,
somewhere reusable, and the test only calls them by name.

`specs/tests/healthCheck/test_Auth.spec.ts` is the reference implementation of every rule below.

---

## 1. Locators never live in the spec

A `page.locator(...)`, `page.getByRole(...)`, `page.getByTestId(...)` etc. appearing inside a `specs/`
file is always a mistake. It belongs on a Page Object (or a widget) per
[`RulesForDescribingAPage.md`](./RulesForDescribingAPage.md#anatomy-of-a-page-file) — as a `readonly`
field if it names an element, or inside a method on that page if it names an action.

```ts
// ✘ locator written at the test
test('a member can sign in', async ({ page }) => {
  await page.goto('/');
  await page.locator('form.login-form input[name="username"]').fill('lisa');
  await page.locator('form.login-form input[name="password"]').fill('Pa$$w0rd2024');
  await page.getByRole('button', { name: 'Login' }).click();
});

// ✔ the same locators, already declared on LoginPage
test('a member can sign in', async ({ page }) => {
  const login = await new LoginPage(page).open();
  await login.login('lisa', 'Pa$$w0rd2024');
});
```

If the scenario needs an element no page object exposes yet, add it there first — never as a one-off
inline locator "just for this test".

---

## 2. Database access — MSSQL queries live in constants, never as inline strings

A raw SQL string typed inside a spec (or a helper) is a maintenance trap: nobody can grep for every place
that reads `AspNetUsers`, and a schema change means hunting through test files. Every query text lives
under `src/constants/queries/mssql/`, one file per table/domain, and the spec/helper only ever imports the
constant.

```
src/constants/
└── queries/
    └── mssql/
        ├── users.queries.ts
        ├── posts.queries.ts
        ├── likes.queries.ts
        ├── roles.queries.ts
        └── integrity.queries.ts   whole-database invariants and schema facts - specs/tests/database/
```

```ts
// src/constants/queries/mssql/users.queries.ts
/** Queries against dbo.AspNetUsers. Parameters are named for `mssql`'s Request.input(). */
export const UsersQueries = {
  getByUsername: `SELECT Id, UserName, KnownAs FROM dbo.AspNetUsers WHERE UserName = @username`,
  countByUsername: `SELECT COUNT(*) AS total FROM dbo.AspNetUsers WHERE UserName = @username`,
} as const;
```

- **Only the SQL text goes here** — no connection string, no `mssql.connect(...)`, no assertions. A
  queries file exports data, not behaviour.
- Group by table/domain, not by test — `UsersQueries`, `PostsQueries`, not `LoginTestQueries`. The same
  constant is reused by every test that needs it.
- A query with parameters is still just a string; the values are bound where the query actually runs (see
  §3), never string-interpolated into the SQL itself — that is a SQL-injection habit even in test code.
- The shape of the rows a query returns is declared once in `src/models/db/` (§9), in a file named after
  the same table — never as an `interface` inside the spec.
- **Implemented** — `users.queries.ts`, `likes.queries.ts`, `posts.queries.ts`, `roles.queries.ts`, added
  together with `src/helpers/db/mssql.helper.ts` (§3) by `specs/tests/e2e/` (`TestCoveragePlan.md` §7). The
  driver ended up being `mssql/msnodesqlv8`, not plain `mssql`, and the connection string addresses the
  instance by its Named Pipe rather than `server\instance` — see `TestCoveragePlan.md` §5 for why the more
  obvious approaches didn't work on this SQL Server instance (Windows Integrated Security only, SQL Server
  Browser stopped).

---

## 3. Helper / utility methods never live in the spec

If you are about to write an `async function`, a loop, a retry, or anything longer than a couple of
straight-line calls *above or inside* a `test()` block, it is a helper, and helpers do not live in
`specs/tests/`. This repo already has two helper layers — pick by what the code touches:

| Layer | Holds | Examples already there |
| --- | --- | --- |
| `specs/support/` | Spec-facing flows: orchestrates Page Objects, the API, env/credentials for a whole scenario. Barrel-exported through `index.ts`; specs import only from `'../../support'`. | `test`/`expect` with the suite fixtures (`fixtures.ts`, §11), `PERSONAS` (`personas.ts`), `Cleanup` (`cleanup.ts`), `PROBES`/`probeTarget` (`authorizationProbes.ts`), the `seed-users` project (`users.seed.ts`), `signInThroughUi`, `signInWithToken` (`signIn.ts`), `STORAGE_STATE`/`CREDENTIALS` (`auth.ts`), `TEST_USER_1`..`TEST_USER_5`/`FIXTURES` (`env.ts`) |
| `src/helpers/` | Low-level technical utilities with no notion of "a test" or "a scenario": DB access, data generators, date/formatting utils, polling/retry utils. Called by `specs/support/` (or directly by a spec only when no support-level wrapper exists yet). | `dragAndDrop.helper.ts`, `browserHealth.helper.ts` (`collectLoadProblems`), `data/post.factory.ts` / `data/registration.factory.ts` / `data/unique.helper.ts` (§9), `data/posts.helper.ts`, `db/mssql.helper.ts` (`MssqlClient`, executing the strings from §2 — reads `DB_DRIVER` and the connection settings of that driver from `process.env` directly rather than importing `specs/support/env`, same reasoning as `browserHealth.helper.ts`'s `isOwnOrigin` taking `origin` as a parameter; specs reach it only through the `db` fixture), `jwt.helper.ts` |
| `src/api/` | The .NET API as typed controllers, one per `API/Controllers/*.cs`. Routes come from `src/constants/endpoints.ts`; every typed response is validated against its zod schema, and a `xxxRaw()` variant returns the bare `APIResponse` when the status itself is what a test checks. | `TravelApi` - `api.posts.list()`, `api.messages.send(...)`, `api.admin.editRoles(...)` - reached through the `api` / `apiAs` fixtures (§11) |

```ts
// ✘ ad-hoc DB helper written inside the spec
test('a registered user is persisted', async ({ page }) => {
  const pool = await sql.connect(connectionString);
  const result = await pool.request().input('username', username).query(
    'SELECT COUNT(*) AS total FROM dbo.AspNetUsers WHERE UserName = @username',
  );
  expect(result.recordset[0].total).toBe(1);
});

// ✔ query text from constants, the connection from the `db` fixture (§11)
import { UsersQueries } from '../../../src/constants/queries/mssql/users.queries';

test('a registered user is persisted', async ({ page, db }) => {
  // ... register through the UI via a Page Object ...
  const [row] = await db.query(UsersQueries.getByUsername, { username });
  expect(row).toBeTruthy();
});
```

Rule of thumb: a spec file should contain **no function declarations of its own** beyond the `test()`
callbacks (the small `probes.map(...)`-style table-driven loop in `test_Api.spec.ts` is the accepted exception —
it stays inline because it only drives `test.each`-style titles, it does not implement behaviour).

A test body holds **no branching** either — no `if`, `?:`, `&&`/`||` or `switch`. A plain `for` loop over a
fixed list of inputs is fine; the moment it needs a condition, the condition moves into a Page Object method
(`RegistrationPage.fillAllExcept`, `OffersPage.firstCardNotOwnedBy`) or a helper
(`firstLikablePostWithUniqueTitle`). ESLint's `playwright/no-conditional-in-test` enforces this (§10).

---

## 4. Every spec file is wrapped in `describe`

One `test.describe(...)` per file (or per logical group inside a larger file), named after what it checks
at a surface level — not the mechanics of how.

```ts
test.describe('Tests verify sign-in', () => {
  test('[ID: 0] test_user_1 without role can sign in through the login form', /* ... */);
  // ...
});
```

`✘ describe('testAuth')` — restates the filename, tells the reader nothing.
`✔ describe('Tests verify sign-in')` — states the behaviour under test.

---

## 5. Every test states its ID and what it verifies

Title format, exactly:

```
[ID: <n>] <who/what> <does what>
```

```ts
test('[ID: 1] test_user_2 like Member role can sign in through the login form', /* ... */);
```

- `<n>` is a **project-wide sequential ID**, not per-file — it is the same numbering space as every other
  spec's `[ID: n]`. Before adding a test, find the highest existing ID across `specs/tests/` and continue
  from there:

  ```bash
  grep -rhoE '\[ID: [0-9]+\]|\bid: [0-9]+' specs/tests | grep -oE '[0-9]+' | sort -n | tail -1
  ```

  The second pattern finds the table-driven tests (`test_Api.spec.ts`, `test_AuthorizationMatrix.spec.ts`),
  whose titles build `[ID: ${id}]` from an `id: n` entry and so never contain a literal `[ID: n]`.
- IDs are **never reused or renumbered**, even if the test they belonged to is later deleted — a stale
  gap is fine, a collision is not (it breaks the 1:1 mapping to the tag in §6).
- The rest of the title reads as a sentence: *who* (which seeded user/role, or which actor) *does what*
  (the action) *in what way* (through the form / via the API / with a planted token, etc.) — enough that
  the title alone tells a reader what failed, without opening the file.

---

## 6. Every test — and its `describe` block — carries its tags from constants, never magic strings

A tag typed as a raw literal at the call site (`'@1'`, `'@healthCheck'`, or worse, a bare identifier like
`HEALTHCHECK` that isn't even declared anywhere) is the same mistake as an inline locator or an inline SQL
string, and it has already caused a real bug: nothing catches a typo (`'@healtCheck'` compiles fine and
just never matches `--grep`/`-g`), and nothing catches a name that resolves to nothing at all until the
file crashes at collection time. Every tag always comes from `specs/support/tags.ts` — never hand-typed,
never re-declared locally.

```ts
// ✘ tags written as magic strings (or a stray identifier, which throws at collection time)
test.describe('Tests verify sign-in', () => {
  test('[ID: 1] test_user_2 like Member role can sign in through the login form', { tag: ['@1', '@healthCheck'] }, /* ... */);
});

// ✔ the same tags, from the shared constants — a typo here is a compile error, not a silent no-op
import { idTag, LAYER_TAG, MUTATION_TAG } from '../../support';

test.describe('Tests verify sign-in', { tag: [LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] }, () => {
  test(
    '[ID: 1] test_user_2 like Member role can sign in through the login form',
    { tag: [idTag(1), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
    async ({ page }) => { /* ... */ },
  );
});
```

Three tags, every time, each pulled from its own constant:

- **`idTag(n)`** — the numeric tag mirrors the `[ID: n]` in the title exactly (`[ID: 1]` ↔ `idTag(1)` ↔
  `'@1'`). This is what makes a single test addressable by `-g "@1"` regardless of where it lives or how
  its title changes. Carried by the test only — a `describe` block covers several IDs, so it has none.
- **Exactly one `LAYER_TAG` member**, matching the layer the file already lives in under `specs/tests/`:

  | Folder | `LAYER_TAG` member | Tag | Question it answers |
  | --- | --- | --- | --- |
  | `specs/tests/healthCheck/` | `LAYER_TAG.healthCheck` | `@healthCheck` | Is the stack up and are the contracts intact? |
  | `specs/tests/smoke/` | `LAYER_TAG.smoke` | `@smoke` | Does this core happy path still work? |
  | `specs/tests/regression/` | `LAYER_TAG.regression` | `@regression` | Does the full behaviour still hold, including negatives? |
  | `specs/tests/e2e/` | `LAYER_TAG.e2e` | `@e2e` | Does the UI's data actually match what's persisted in the database? |
  | `specs/tests/api/` | `LAYER_TAG.api` | `@api` | Does every route let in exactly the right callers, and refuse a bad request the way it should? |
  | `specs/tests/database/` | `LAYER_TAG.database` | `@database` | Do the schema and the stored data keep the invariants the application relies on? |

  The tag is redundant with the folder (Playwright's `testDir` per project already isolates each layer —
  see `playwright.config.ts`), and that is intentional: it lets a run filter by layer *across* folders
  (e.g. `-g "@healthCheck"`), and it keeps the layer visible in test-report output where the folder path
  is not shown. A test never carries more than one layer tag — if a scenario seems to belong to two layers,
  it belongs in the stricter one (`e2e`/regression over smoke, smoke over health).
- **Exactly one `MUTATION_TAG` member**, depending on whether the test writes, edits, deletes or otherwise
  changes persisted application state through the UI or the API:

  | `MUTATION_TAG` member | Tag | Use when the test... |
  | --- | --- | --- |
  | `MUTATION_TAG.mutation` | `@mutation` | ...creates, edits, deletes, or otherwise changes data that outlives the test (a post, a photo, a role, a message). |
  | `MUTATION_TAG.unmutation` | `@unmutation` | ...only reads or observes state — including signing in: a sign-in leaves no lasting change to application data. |

  This is a second, independent axis from the layer tag: it lets a run exclude every mutating test
  (`-G "@mutation"`) when pointed at an environment where side effects are unwelcome, without touching
  which layer runs.

**`test.describe` itself carries `{ tag: [...] }` too** — the layer tag always, and the mutation tag when
every test inside the block shares the same mutation status (as `test_Auth.spec.ts` does — ten tests, all
`@unmutation`). Playwright merges a `describe`-level tag onto every test inside it, so the group-level tag
is not just documentation: it is what lets `-g "@healthCheck"` or `-G "@mutation"` find a test even before
its own tag is read. If a block would mix mutating and non-mutating tests, split it into two `describe`
blocks — one per mutation status — rather than putting a misleading tag on the group.

---

## 7. Spec file naming — `test_<FunctionalityChecked>.spec.ts`

```
test_[NameOfCheckedFunctionality].spec.ts
```

- `test_` is a literal prefix — always lower-case, always followed by an underscore.
- `<NameOfCheckedFunctionality>` is PascalCase and names the functionality the file covers, not the
  scenario or the layer — `Auth`, `Offers`, `Likes`, `AdminRoles`, not `Login1` or `SmokeAuth` (the layer
  is already the folder it sits in, per §6, and is never repeated in the filename).
- One file per functionality per layer folder: `specs/tests/healthCheck/test_Auth.spec.ts` and a future
  `specs/tests/smoke/test_Auth.spec.ts` are two different files checking the same functionality at two
  different layers — both keep the `test_Auth` stem.

```
✔ specs/tests/healthCheck/test_Auth.spec.ts
✔ specs/tests/smoke/test_Offers.spec.ts
✘ specs/tests/healthCheck/testAuth.spec.ts        no underscore after `test`
✘ specs/tests/healthCheck/auth.spec.ts            missing the `test_` prefix
✘ specs/tests/healthCheck/test_auth.spec.ts       functionality name must be PascalCase
```

`test_Api.spec.ts` and `test_App.spec.ts` in the same folder were renamed to this convention from their
original `api.spec.ts` / `app.spec.ts` names — don't reintroduce the old, unprefixed style for a new file.

---

## 8. Timeouts come from `src/constants/timeouts.ts`, never as numbers

A `timeout: 15_000` or `test.setTimeout(60_000)` at the call site says nothing about *why* the wait is
long, and the same number ends up meaning different things in different files. Every timeout that is not
Playwright's default is a named constant in `src/constants/timeouts.ts`, with a JSDoc line naming the slow
operation.

```ts
// ✘ a magic number - why 15 s, and is it the same wait as the 15 s in the health project?
await expect(lisaThread.message(ownIndex).readMarker).toBeVisible({ timeout: 15_000 });

// ✔ the slow operation is named, and the value lives in one place
await expect(lisaThread.message(ownIndex).readMarker).toBeVisible({ timeout: TIMEOUT.signalR });
```

- Playwright's defaults (30 s per test, 5 s per `expect`) are never passed explicitly.
- A test that is slow as a whole, with no single operation to blame, calls `test.slow()` instead of
  getting a new constant.
- Every constant is scaled by `TIMEOUT_MULTIPLIER` (default `1`), so a slower runner stretches the whole
  suite with one variable: `TIMEOUT_MULTIPLIER=2 npm test`. It can also be set in `.env` —
  `playwright.config.ts` imports `src/helpers/loadEnv.helper.ts` first, so `.env` is loaded before the
  constants are evaluated.
- ESLint rejects a numeric literal passed as `timeout:` or to `setTimeout(...)` (§10).

---

## 9. Test data — shared values, payloads and data shapes are declared once

The same five strings copied into every spec that publishes a post, a toast text typed by hand, a
`Date.now()` title, an `interface PostSummary` re-declared in four files — each is the same mistake as an
inline locator: a change has to be hunted down everywhere.

| Kind of value | Lives in | Example |
| --- | --- | --- |
| Values typed into the app, ids and schema facts shared by several specs | `src/constants/testData.ts` | `LOCATION.morskieOko`, `CURRENCY.pln`, `MISSING_ID`, `SEED.members`, `SCHEMA.migrations` |
| Toast texts and API error bodies the specs assert on | `src/constants/messages.ts` | `TOAST.postAdded`, `API_ERROR.usernameTaken` |
| A complete, valid form payload or API body | `src/helpers/data/*.factory.ts` | `buildPost({ title })`, `buildPostDto()`, `buildRegistration()`, `buildRegisterDto()` |
| Data a test creates and has to find again, or a name nobody has | `src/helpers/data/unique.helper.ts` | `uniqueName('Regression Offer')`, `unknownUsername()` |
| Credentials — test accounts only | `.env` → `specs/support/env.ts` | `TEST_USER_1` … `TEST_USER_5` |
| API bodies and database rows | `src/models/` | `PostDto`, `MessageDto`, `CountRow`, `ProfileFieldsRow` |

```ts
// ✘ copied strings, a timestamp that can collide across workers, a local interface
interface PostSummary { id: number; title: string }
title = `Regression Offer ${Date.now()}`;
await addOffer.publish({ title, locationCountry: 'Poland', locationCity: 'Malopolska', lastCountry: 'Poland', lastRegion: 'Krakow', currency: 'PLN' });
await expect(addOffer.successToast).toContainText('Post added successfully');
const posts = (await response.json()) as PostSummary[];

// ✔
title = uniqueName('Regression Offer');
await addOffer.publish(buildPost({ title }));
await expect(addOffer.successToast).toContainText(TOAST.postAdded);
const posts = (await response.json()) as PostDto[];
```

- A factory fills exactly what the form requires; the test passes in `overrides` only what the scenario is
  about (`buildPost({ title, entranceFee: { minPrice: '5', maxPrice: '15' } })`).
- `Date.now()` on its own is not unique: regression runs three browsers in parallel under one account, and
  a cleanup that finds data by name could delete another worker's row. `uniqueName` adds a random part.
- A spec never declares an `interface`/`type` for an API body or a database row. DTOs are zod schemas in
  `src/models/dto/` that mirror `API/DTOs/*.cs`; rows are plain interfaces in `src/models/db/`, one file per
  table, next to the query they describe (§2).
- Specs sign in only as the test accounts `TEST_USER_1`..`TEST_USER_5`, one per role combination; the
  `member` and `admin` storage states belong to `test_user_2` and `test_user_5` (`auth.ts`). The seeded
  accounts `.env` also lists (Lisa, Bob, admin) are for manual runs only, so the suite never leaves data on
  the accounts a real visitor sees.
- Credentials never go into `testData.ts`. A new account goes into `.env` and `specs/support/env.ts`, which
  reads it without a fallback - a missing key fails loudly instead of silently using a stale default.

---

## 10. The quality gate — `npm run check` and the pre-commit hook

`npm run check` runs `tsc --noEmit` and ESLint (`eslint.config.mjs`, `--max-warnings=0`). The pre-commit
hook (`.husky/pre-commit`, installed by `npm install` through the `prepare` script) runs ESLint on the staged
`*.ts` files and the type check, so a commit that breaks either is refused.

| Rule | Applies to | Enforces |
| --- | --- | --- |
| `@typescript-eslint/no-floating-promises`, `await-thenable`, `no-misused-promises` | every `.ts` | no forgotten `await` |
| `no-restricted-syntax` (numeric `timeout:` / `setTimeout(...)`) | every `.ts` | §8 |
| `playwright/no-raw-locators` | `specs/tests/**` | §1, for raw `.locator(...)` calls |
| `playwright/no-conditional-in-test` | `specs/tests/**` | §3 — no branching in a test body |
| `no-restricted-imports` (`test` / `expect` from `@playwright/test`) | `specs/tests/**` | §11 — specs use the suite's `test`, with its fixtures |
| `playwright/expect-expect` | `specs/tests/**` | every test asserts; `signInThroughUi` / `signInWithToken` count as assertions |
| `playwright/prefer-web-first-assertions`, `no-wait-for-timeout`, `missing-playwright-await`, `no-force-option` and the rest of `flat/recommended` | `specs/tests/**` | Playwright best practices |

What the linter cannot see, and review still has to:

- `prefer-web-first-assertions` only recognises direct `Locator` calls.
  `expect(await registration.isSubmitEnabled()).toBe(false)` goes through a Page Object method, so it is
  not flagged — yet it still reads the state once without retrying. Prefer
  `await expect(registration.registerButton).toBeDisabled()` (§12).
- `no-raw-locators` catches `.locator(...)`, not `getByRole(...)` — §1 still applies to those.

A justified exception is a single-line disable with the reason after `--`:

```ts
// eslint-disable-next-line playwright/no-networkidle -- no single element or response marks "the bundle finished loading"
await page.waitForLoadState('networkidle');
```

---

## 11. Fixtures — sessions, API calls, cleanup and the database come from `test`

`specs/support/fixtures.ts` extends Playwright's `test`. Specs import `test` and `expect` from `specs/support` —
ESLint rejects importing them from `@playwright/test` — and take what they need as fixture parameters instead
of building it:

| Fixture | Gives | Replaces |
| --- | --- | --- |
| `persona` (option) | `test.use({ persona: 'member' })` starts `page` signed in from a saved session (`member`, `adminModerator`) | `test.use({ storageState: STORAGE_STATE.member })` |
| `api` | an anonymous `TravelApi` (`src/api/`) | `new ApiClient(request)` |
| `apiAs(persona)` | a `TravelApi` signed in as any persona from `PERSONAS` — one sign-in per persona per test; `apiAs('anonymous')` sends no token | authenticating and passing tokens around |
| `pageAs(persona)` | another, independent browser session signed in through the login form, closed after the test | `browser.newContext(...)` + `signInThroughUi` + `close()` |
| `cleanup` | undoes what the test registered: `cleanup.post(owner, title)`, `cleanup.like(liker, postId)`, `cleanup.messages(a, b, contents)`, `await cleanup.profile(owner)`, `await cleanup.roles(target)` | `test.afterEach` hooks |
| `db` (worker) | one SQL Server pool per worker, closed when the worker finishes | opening a connection in the spec |

```ts
test.use({ persona: 'member' });

test('[ID: n] ...', { tag: [...] }, async ({ page, apiAs, cleanup }) => {
  const title = uniqueName('Regression Offer');
  cleanup.post('member', title);            // registered before the post exists

  // ... publish it through the UI ...

  const posts = await (await apiAs('member')).posts.byUser(TEST_USER_2.username);
  expect(posts.map((post) => post.title)).toContain(title);
});
```

- Register a cleanup **before** making the change: a test that fails halfway still leaves nothing behind, and
  every task tolerates finding nothing to undo. `profile()` and `roles()` snapshot the current state right
  away, so `await` them before the test changes anything — usually in `beforeEach`.
- A spec never writes a `test.afterEach` for cleanup, never builds an API client or a database connection, and
  never types an API route — controllers take their routes from `src/constants/endpoints.ts`.
- Prefer the parsed calls (`api.posts.list()`): when the API contract changes they fail with every mismatching
  field listed. Reach for a `xxxRaw()` call only when the status code itself is what the test checks.

---

## 12. Steps, soft assertions and web-first checks

**Steps.** Every regression and e2e test is split into `test.step` calls named `[Step N][Layer] what happens`,
with `UI`, `API` or `DB` as the layer. The HTML report and the trace list the steps, so a failure reads as
"step 3 of 5" instead of a wall of clicks. A step is one action - a Page Object or controller call - plus its
checks; a value a later step needs is returned from the step. Health and smoke tests are short enough to go
without steps. In the api layer, a test that makes more than one call is split into `[Step N][API]` steps; a
single request needs none, and neither does a database-layer test, which is one query. e2e files also list their steps, with layers, in the file's docblock.

```ts
const postId = await test.step('[Step 2][DB] dbo.Posts row matches the form', async () => {
  const [row] = await db.query<PostRow>(PostsQueries.getByTitle, { title: post.title });
  expect(row, 'the post is committed to dbo.Posts').toBeTruthy(); // precondition - hard
  expect.soft(row.LocationCity, 'LocationCity').toBe(post.locationCity);
  expect.soft(row.Currency, 'Currency').toBe(post.currency);
  return row.Id;
});
```

**Soft assertions.** `expect.soft` records a failure and lets the test go on, so one run reports every
mismatching field, section or route instead of only the first. Use it for checks that do not depend on each other.

- A precondition the rest of the step relies on - the row exists, the page opened, the element appeared - is a
  hard `expect` and comes **before** the first `expect.soft` of the step. No hard `expect` follows a soft one
  inside the same step.
- Waiting for the UI so the next action can run stays a hard `expect`.
- A loop over independent inputs - required fields, guarded routes - makes each iteration its own step with a
  soft check, so every failing input is reported.

**Web-first checks.** Anything asserted about the browser goes through a `Locator` and a retrying matcher -
`toBeVisible`, `toBeHidden`, `toBeEnabled`, `toBeDisabled`, `toHaveValue`, `toHaveText`, `toContainText`,
`toHaveCount`, `toHaveAttribute`, `toHaveCSS`. `expect(await page.something()).toBe(...)` reads the state
once and never retries; ESLint only notices it for direct locator calls (§10), so review catches the rest.
`expect(await ...)` and `expect.poll` stay for values that do not come from the browser - database rows and API
bodies.

| Instead of | Write |
| --- | --- |
| `expect(await registration.isSubmitEnabled()).toBe(false)` | `await expect(registration.registerButton).toBeDisabled()` |
| `expect(await target.isOpen()).toBe(false)` | `await expect(target.uniqueElement).toBeHidden()` |
| `expect(await login.passwordInputType()).toBe('text')` | `await expect(login.passwordInput).toHaveAttribute('type', 'text')` |
| `expect(await offers.visibleNavLinks()).toEqual([...])` | `await expect(offers.navLinks).toHaveText([...])` |
| `expect(await lists.cardCount()).toBe(0)` | `await expect(lists.cards).toHaveCount(0)` |
| `await expect.poll(() => card.isLiked()).toBe(true)` | `await expect(card.likeIcon).toHaveCSS('color', LIKE_COLOR.liked)` |
| `await expect.poll(() => thread.messageTexts()).toContain(text)` | `await expect(thread.messageWithText(text)).toBeVisible()` |

---

## Anatomy of a compliant spec file

```ts
import { LoginPage, OffersPage } from '../../../src/PageObjects';
import { UsersQueries } from '../../../src/constants/queries/mssql/users.queries';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test, TEST_USER_2 } from '../../support';

/**
 * What this file checks at a surface level, and why — same header style as
 * the rest of specs/tests/**.
 */
test.describe(
  'Tests verify sign-in persists the expected session',
  { tag: [LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 10] test_user_2 like Member role is redirected to /offers after sign-in',
      { tag: [idTag(10), LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
      async ({ page, db }) => {
        const login = await new LoginPage(page).open();
        await login.login(TEST_USER_2.username, TEST_USER_2.password);

        const offers = await new OffersPage(page).waitForLoaded();
        await expect(offers.navUserMenuToggle).toContainText(new RegExp(TEST_USER_2.username, 'i'));

        const [row] = await db.query(UsersQueries.getByUsername, {
          username: TEST_USER_2.username,
        });
        expect(row).toBeTruthy();
      },
    );
  },
);
```

Everything technical — the locators (`LoginPage`, `OffersPage`), the SQL text (`UsersQueries`), the DB
connection (the `db` fixture) — is imported or injected, not written. The test itself is only the scenario: sign in,
land on `/offers`, and the row exists.

## Checklist for a new spec

1. `test.describe('...')` names what the file checks at a surface level.
2. Every element/action comes from a Page Object or widget — never a raw locator in the spec.
3. Every DB read goes through the `db` fixture and a query from
   `src/constants/queries/mssql/*.queries.ts` — never an inline SQL string or ad-hoc connection.
4. Any reusable logic longer than a couple of calls is a helper in `specs/support/` (flow-level) or
   `src/helpers/` (technical) — never a function declared next to the test, and no branching in a test body.
5. Title is `[ID: <n>] <who/what> <does what>`, with `<n>` the next free project-wide ID.
6. `test.describe(...)` itself carries `{ tag: [LAYER_TAG.<layer>, MUTATION_TAG.<mutation|unmutation>] }`
   when every test in it shares one mutation status (split the block into two if it doesn't). Every
   individual test then carries all three: `{ tag: [idTag(<n>), LAYER_TAG.<layer>, MUTATION_TAG.<...>] }` —
   all imported from `specs/support/tags.ts`, never hand-typed strings. Numeric tag matches the ID, exactly
   one layer tag matching the folder the file is in, exactly one mutation tag (`mutation` if the test
   creates/edits/deletes persisted data, `unmutation` if it only reads or signs in).
7. File is named `test_<FunctionalityChecked>.spec.ts` — literal `test_` prefix, PascalCase functionality
   name, no layer name repeated in it.
8. Every non-default timeout is a `TIMEOUT.*` constant (§8).
9. Shared values, toast texts, payloads, unique names and data shapes come from `src/constants/`,
   `src/helpers/data/` and `src/models/` (§9).
10. `npm run check` passes (§10).
11. `test` / `expect` come from `specs/support`; API calls go through `api` / `apiAs`, a second session through
    `pageAs`, and every change is registered with `cleanup` before it is made (§11).
12. Regression and e2e tests are split into `[Step N][Layer]` steps; independent checks are `expect.soft`
    after the hard preconditions; browser state is asserted web-first, on locators (§12).
