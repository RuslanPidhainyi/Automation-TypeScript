import { APIRequestContext, Page, expect } from '@playwright/test';
import { LoginPage, OffersPage } from '../../src/PageObjects';
import { ApiClient, UserDto } from './ApiClient';
import { CLIENT_URL, Credentials } from './env';

/**
 * The two ways a spec can sign a user in without relying on `auth.setup.ts`'s
 * saved `storageState` - useful for the health probes, which must be able to
 * run before `setup` and against credentials that have no role/storageState
 * of their own (`TEST_USER_2`..`TEST_USER_5`). Both end the same way: prove
 * the session took by loading `/offers` and reading the username off the nav
 * bar.
 */

/** Clicks through the login form, exactly like a real visitor. */
export async function signInThroughUi(page: Page, user: Credentials): Promise<void> {
  const login = await new LoginPage(page).open();
  await login.login(user.username, user.password);

  const offers = await new OffersPage(page).waitForLoaded();
  await expect(offers.navUserMenuToggle).toContainText(new RegExp(user.username, 'i'));
}

/**
 * Calls `account/login` directly and plants the response into
 * `localStorage['user']`, the way `AccountService.setCurrentUser` does, then
 * reloads so `AppComponent.ngOnInit` picks the session back up and
 * `redirectAuthenticatedGuard` sends `/` to `/offers`.
 */
export async function signInWithToken(
  page: Page,
  request: APIRequestContext,
  user: Credentials,
): Promise<void> {
  const response = await new ApiClient(request).login(user);
  expect(response.status()).toBe(200);
  const loggedInUser = (await response.json()) as UserDto;

  await page.goto(CLIENT_URL);
  await page.evaluate((u) => localStorage.setItem('user', JSON.stringify(u)), loggedInUser);
  // AppComponent only reads localStorage on init, so the session needs a
  // fresh load before the guard sees it and redirects off the login page.
  await page.reload();

  const offers = await new OffersPage(page).waitForLoaded();
  await expect(offers.navUserMenuToggle).toContainText(new RegExp(user.username, 'i'));
}
