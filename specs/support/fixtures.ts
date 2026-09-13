import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { TravelApi } from '../../src/api/TravelApi';
import { MssqlClient } from '../../src/helpers/db/mssql.helper';
import { STORAGE_STATE, type AuthRole } from './auth';
import { Cleanup } from './cleanup';
import { PERSONAS, type Caller, type PersonaName } from './personas';
import { signInThroughUi } from './signIn';

interface TestFixtures {
  /**
   * Starts the test's own `page` signed in as this persona, from the session the
   * `setup` project saved: `test.use({ persona: 'member' })`. Unset, the page is
   * anonymous.
   */
  persona: AuthRole | undefined;
  /** An anonymous API client. */
  api: TravelApi;
  /** An API client signed in as `caller`, or without a token for `'anonymous'` - one sign-in per persona per test. */
  apiAs: (caller: Caller) => Promise<TravelApi>;
  /** Another, independent browser session signed in as `persona` through the login form; closed after the test. */
  pageAs: (persona: PersonaName) => Promise<Page>;
  /** Undoes, after the test, whatever the test registered - see `cleanup.ts`. */
  cleanup: Cleanup;
}

interface WorkerFixtures {
  /** One SQL Server pool per worker, opened on first use and closed when the worker finishes. */
  db: MssqlClient;
}

/**
 * The suite's `test`: Playwright's own, plus the fixtures above. Specs import
 * `test` and `expect` from `specs/support`, never from `@playwright/test`
 * (`RulesForWritingTests.md` §1, enforced by ESLint).
 */
export const test = base.extend<TestFixtures, WorkerFixtures>({
  persona: [undefined, { option: true }],

  storageState: async ({ persona, storageState }, use) => {
    await use(persona ? STORAGE_STATE[persona] : storageState);
  },

  api: async ({ request }, use) => {
    await use(new TravelApi(request));
  },

  apiAs: async ({ request }, use) => {
    const clients = new Map<Caller, Promise<TravelApi>>();
    await use((caller) => {
      const known = clients.get(caller);
      if (known) return known;

      const client =
        caller === 'anonymous'
          ? Promise.resolve(new TravelApi(request))
          : TravelApi.signedIn(request, PERSONAS[caller].credentials);
      clients.set(caller, client);
      return client;
    });
  },

  pageAs: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (persona) => {
      // An explicit empty storageState: a bare `newContext()` inherits the test's own
      // session (`TestCoveragePlan.md`, Failed attempts #19).
      const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      contexts.push(context);
      const page = await context.newPage();
      await signInThroughUi(page, PERSONAS[persona].credentials);
      return page;
    });
    await Promise.all(contexts.map((context) => context.close()));
  },

  cleanup: async ({ apiAs }, use) => {
    const cleanup = new Cleanup(apiAs);
    await use(cleanup);
    await cleanup.run();
  },

  db: [
    async ({}, use) => {
      const db = await MssqlClient.connect();
      await use(db);
      await db.close();
    },
    { scope: 'worker' },
  ],
});

export { expect };
