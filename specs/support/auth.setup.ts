import type { Page } from '@playwright/test';
import type { TravelApi } from '../../src/api/TravelApi';
import { LoginPage, OffersPage } from '../../src/PageObjects';
import { AuthRole, CREDENTIALS, STORAGE_STATE } from './auth';
import { AUTH_STRATEGY, CLIENT_URL } from './env';
import { expect, test as setup } from './fixtures';

/**
 * The `setup` project - runs before `smoke`, `regression` and `e2e` (see
 * `dependencies` in playwright.config.ts) and leaves one signed-in
 * `storageState` per saved persona behind, so no other spec has to log in
 * through the UI just to be somebody.
 *
 * Two ways to get there, picked by `AUTH_STRATEGY` (env `AUTH_STRATEGY`,
 * defaults to `ui`):
 *  - `ui`    - clicks through the login form. One extra second per run, and in
 *              exchange the state is exactly what the application itself
 *              writes - including `generalPhotoUrl`, which the nav bar avatar
 *              reads.
 *  - `token` - calls `account/login` directly and plants the response under
 *              `localStorage['user']` itself, skipping the browser for the
 *              sign-in. Faster, but only as trustworthy as the assumption that
 *              the client still stores the session exactly this way.
 *
 * `specs/tests/smoke/test_Auth.spec.ts` still tests login and logout itself; it
 * simply does not use these files.
 */
async function signInViaUi(role: AuthRole, page: Page): Promise<void> {
  const { username, password } = CREDENTIALS[role];

  const login = await new LoginPage(page).open();
  await login.login(username, password);

  // Successful login lands on /offers; the nav bar greeting proves the client
  // stored the session, which is the thing being saved.
  const offers = await new OffersPage(page).waitForLoaded();
  await expect(offers.navUserMenuToggle).toContainText(new RegExp(username, 'i'));
}

/**
 * Plants the session the same way `AccountService.setCurrentUser` does
 * (`_services/account.service.ts`): the raw `account/login` response under
 * `localStorage['user']`, which `AppComponent.ngOnInit` reads back on load.
 */
async function signInViaToken(role: AuthRole, page: Page, api: TravelApi): Promise<void> {
  const user = await api.account.login(CREDENTIALS[role]);

  await page.goto(CLIENT_URL);
  await page.evaluate((u) => localStorage.setItem('user', JSON.stringify(u)), user);
}

async function signInAndSaveState(role: AuthRole, page: Page, api: TravelApi): Promise<void> {
  if (AUTH_STRATEGY === 'token') {
    await signInViaToken(role, page, api);
  } else {
    await signInViaUi(role, page);
  }

  await page.context().storageState({ path: STORAGE_STATE[role] });
}

setup('authenticate as a member', async ({ page, api }) => {
  await signInAndSaveState('member', page, api);
});

setup('authenticate as an admin and moderator', async ({ page, api }) => {
  await signInAndSaveState('adminModerator', page, api);
});
