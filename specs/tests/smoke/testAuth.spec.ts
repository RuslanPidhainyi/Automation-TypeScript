import { LoginPage, OffersPage } from '../../../src/PageObjects';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test, TEST_USER_2 } from '../../support';

/**
 * Smoke layer - the login card's happy path.
 *
 * Only the `member` test account (`test_user_2`) is exercised here; every
 * role/strategy combination is already covered at the health layer
 * (`testAuth.spec.ts` under `healthCheck/`). This file only proves the one path
 * a real visitor takes.
 */
test.describe(
  'Tests verify sign-in and sign-out from the login card',
  { tag: [LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 23] test_user_2 signs in from the login card and lands on /offers',
      { tag: [idTag(23), LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const login = await new LoginPage(page).open();
        await login.login(TEST_USER_2.username, TEST_USER_2.password);

        const offers = await new OffersPage(page).waitForLoaded();
        await expect(page).toHaveURL(offers.url);
        await expect(offers.navUserMenuToggle).toContainText(new RegExp(TEST_USER_2.username, 'i'));
      },
    );

    test.describe('signed in as test_user_2', () => {
      test.use({ persona: 'member' });

      test(
        '[ID: 24] test_user_2 signs out from the user menu and returns to the login card',
        { tag: [idTag(24), LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
        async ({ page }) => {
          const offers = await new OffersPage(page).open();
          await offers.logout();

          const login = await new LoginPage(page).waitForLoaded();
          await expect(page).toHaveURL(login.url);
          await expect(login.form.root).toBeVisible();
        },
      );
    });
  },
);
