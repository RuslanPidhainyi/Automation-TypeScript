import { APIRequestContext, Page, expect, test as setup } from '@playwright/test';
import { LoginPage, OffersPage } from '../../src/PageObjects';
import { UserDto } from './ApiClient';
import { AuthRole, CREDENTIALS, STORAGE_STATE } from './auth';
import { apiUrl, AUTH_STRATEGY, CLIENT_URL } from './env';

/**
 * The `setup` project - runs before `smoke` and `regression` (see
 * `dependencies` in playwright.config.ts) and leaves one signed-in
 * `storageState` per role behind, so no other spec has to log in through the
 * UI just to be somebody.
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
 * `auth.smoke.spec.ts` still tests login and logout itself; it simply does not
 * use these files.
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
async function signInViaToken(role: AuthRole, page: Page, request: APIRequestContext): Promise<void> {
  const { username, password } = CREDENTIALS[role];

  const response = await request.post(apiUrl('account/login'), { data: { username, password } });
  if (!response.ok()) {
    throw new Error(`Login as "${username}" failed: ${response.status()} ${await response.text()}`);
  }
  const user = (await response.json()) as UserDto;

  await page.goto(CLIENT_URL);
  await page.evaluate((u) => localStorage.setItem('user', JSON.stringify(u)), user);
}

async function signInAndSaveState(role: AuthRole, page: Page, request: APIRequestContext): Promise<void> {
  if (AUTH_STRATEGY === 'token') {
    await signInViaToken(role, page, request);
  } else {
    await signInViaUi(role, page);
  }

  await page.context().storageState({ path: STORAGE_STATE[role] });
}

setup('authenticate as a member', async ({ page, request }) => {
  await signInAndSaveState('member', page, request);
});

setup('authenticate as an admin', async ({ page, request }) => {
  await signInAndSaveState('admin', page, request);
});
