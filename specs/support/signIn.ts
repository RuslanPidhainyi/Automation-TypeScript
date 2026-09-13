import { APIRequestContext, Page, expect } from '@playwright/test';
import { TravelApi } from '../../src/api/TravelApi';
import { LoginPage, OffersPage } from '../../src/PageObjects';
import type { Credentials } from '../../src/models';
import { CLIENT_URL } from './env';

/**
 * The two ways a spec can sign a user in without relying on `auth.setup.ts`'s
 * saved `storageState` - useful for the health probes, which must be able to
 * run before `setup`, and for every test account without a storageState of its
 * own (only `test_user_2` and `test_user_5` have one). Both end the same way: prove
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
  const loggedInUser = await new TravelApi(request).account.login(user);

  await page.goto(CLIENT_URL);
  await page.evaluate((u) => localStorage.setItem('user', JSON.stringify(u)), loggedInUser);
  // AppComponent only reads localStorage on init, so the session needs a
  // fresh load before the guard sees it and redirects off the login page.
  await page.reload();

  const offers = await new OffersPage(page).waitForLoaded();
  await expect(offers.navUserMenuToggle).toContainText(new RegExp(user.username, 'i'));
}
