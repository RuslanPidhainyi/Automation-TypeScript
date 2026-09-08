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
        └── likes.queries.ts
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
- This folder is currently empty — no spec talks to the database directly yet. The first one that does
  must also add the `mssql` client (`npm i -D mssql`) and a connection helper (§3) before writing to this
  folder; the layout is decided up front so nobody improvises a different shape later.

---

## 3. Helper / utility methods never live in the spec

If you are about to write an `async function`, a loop, a retry, or anything longer than a couple of
straight-line calls *above or inside* a `test()` block, it is a helper, and helpers do not live in
`specs/tests/`. This repo already has two helper layers — pick by what the code touches:

| Layer | Holds | Examples already there |
| --- | --- | --- |
| `specs/support/` | Spec-facing flows: orchestrates Page Objects, the API, env/credentials for a whole scenario. Barrel-exported through `index.ts`; specs import only from `'../../support'`. | `signInThroughUi`, `signInWithToken` (`signIn.ts`), `ApiClient`, `STORAGE_STATE`/`CREDENTIALS` (`auth.ts`), `MEMBER`/`ADMIN`/`FIXTURES` (`env.ts`) |
| `src/helpers/` | Low-level technical utilities with no notion of "a test" or "a scenario": DB access, data generators, date/formatting utils, polling/retry utils. Called by `specs/support/` (or directly by a spec only when no support-level wrapper exists yet). | *(empty — first candidate is the MSSQL query runner, e.g. `src/helpers/db/mssql.helper.ts`, executing the strings from §2)* |

```ts
// ✘ ad-hoc DB helper written inside the spec
test('a registered user is persisted', async ({ page }) => {
  const pool = await sql.connect(connectionString);
  const result = await pool.request().input('username', username).query(
    'SELECT COUNT(*) AS total FROM dbo.AspNetUsers WHERE UserName = @username',
  );
  expect(result.recordset[0].total).toBe(1);
});

// ✔ query text from constants, connection/execution from a helper
import { UsersQueries } from '../../../src/constants/queries/mssql/users.queries';
import { runMssqlQuery } from '../../../src/helpers/db/mssql.helper';

test('a registered user is persisted', async ({ page }) => {
  // ... register through the UI via a Page Object ...
  const [row] = await runMssqlQuery(UsersQueries.getByUsername, { username });
  expect(row).toBeTruthy();
});
```

Rule of thumb: a spec file should contain **no function declarations of its own** beyond the `test()`
callbacks (the small `probes.map(...)`-style table-driven loop in `api.spec.ts` is the accepted exception —
it stays inline because it only drives `test.each`-style titles, it does not implement behaviour).

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
  grep -rhoE '\[ID: [0-9]+\]' specs/tests | grep -oE '[0-9]+' | sort -n | tail -1
  ```
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

  The tag is redundant with the folder (Playwright's `testDir` per project already isolates each layer —
  see `playwright.config.ts`), and that is intentional: it lets a run filter by layer *across* folders
  (e.g. `-g "@healthCheck"`), and it keeps the layer visible in test-report output where the folder path
  is not shown. A test never carries more than one of the three layer tags — if a scenario seems to belong
  to two layers, it belongs in the stricter one (regression over smoke, smoke over health).
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

`api.spec.ts` and `app.spec.ts` in the same folder predate this rule and are due a rename to
`test_Api.spec.ts` / `test_App.spec.ts` — don't copy their filenames for a new file.

---

## Anatomy of a compliant spec file

```ts
import { expect, test } from '@playwright/test';
import { LoginPage, OffersPage } from '../../../src/PageObjects';
import { runMssqlQuery } from '../../../src/helpers/db/mssql.helper';
import { UsersQueries } from '../../../src/constants/queries/mssql/users.queries';
import { idTag, LAYER_TAG, MUTATION_TAG, TEST_USER_2 } from '../../support';

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
      async ({ page }) => {
        const login = await new LoginPage(page).open();
        await login.login(TEST_USER_2.username, TEST_USER_2.password);

        const offers = await new OffersPage(page).waitForLoaded();
        await expect(offers.navUserMenuToggle).toContainText(new RegExp(TEST_USER_2.username, 'i'));

        const [row] = await runMssqlQuery(UsersQueries.getByUsername, {
          username: TEST_USER_2.username,
        });
        expect(row).toBeTruthy();
      },
    );
  },
);
```

Everything technical — the locators (`LoginPage`, `OffersPage`), the SQL text (`UsersQueries`), the DB
connection (`runMssqlQuery`) — is imported, not written. The test itself is only the scenario: sign in,
land on `/offers`, and the row exists.

## Checklist for a new spec

1. `test.describe('...')` names what the file checks at a surface level.
2. Every element/action comes from a Page Object or widget — never a raw locator in the spec.
3. Every DB read/write goes through `src/helpers/db/*` and a query from
   `src/constants/queries/mssql/*.queries.ts` — never an inline SQL string or ad-hoc connection.
4. Any reusable logic longer than a couple of calls is a helper in `specs/support/` (flow-level) or
   `src/helpers/` (technical) — never a function declared next to the test.
5. Title is `[ID: <n>] <who/what> <does what>`, with `<n>` the next free project-wide ID.
6. `test.describe(...)` itself carries `{ tag: [LAYER_TAG.<layer>, MUTATION_TAG.<mutation|unmutation>] }`
   when every test in it shares one mutation status (split the block into two if it doesn't). Every
   individual test then carries all three: `{ tag: [idTag(<n>), LAYER_TAG.<layer>, MUTATION_TAG.<...>] }` —
   all imported from `specs/support/tags.ts`, never hand-typed strings. Numeric tag matches the ID, exactly
   one layer tag matching the folder the file is in, exactly one mutation tag (`mutation` if the test
   creates/edits/deletes persisted data, `unmutation` if it only reads or signs in).
7. File is named `test_<FunctionalityChecked>.spec.ts` — literal `test_` prefix, PascalCase functionality
   name, no layer name repeated in it.
