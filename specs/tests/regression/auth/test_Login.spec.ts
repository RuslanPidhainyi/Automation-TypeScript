import { LoginPage, OffersPage } from '../../../../src/PageObjects';
import { TOAST } from '../../../../src/constants/messages';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test, TEST_USER_2 } from '../../../support';

/**
 * Regression layer - the login card and its two guards
 * (`redirectAuthenticatedGuard`, and the nav-bar login form it shares markup
 * with). The happy path itself (test_user_2 signs in from the card) is already
 * covered at the smoke layer (`specs/tests/smoke/test_Auth.spec.ts`); this
 * file only adds the negative/edge cases from the coverage plan.
 */
test.describe(
  'Tests verify the login card and its guards',
  { tag: [LAYER_TAG.regression, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 41] the eye button flips the login password field between password and text',
      { tag: [idTag(41), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const login = new LoginPage(page);

        await test.step('[Step 1][UI] Open the login card - the password is masked', async () => {
          await login.open();
          await expect(login.passwordInput).toHaveAttribute('type', 'password');
        });

        await test.step('[Step 2][UI] The eye button reveals the password', async () => {
          await login.togglePasswordVisibility();
          await expect(login.passwordInput).toHaveAttribute('type', 'text');
        });

        await test.step('[Step 3][UI] Pressing it again masks the password', async () => {
          await login.togglePasswordVisibility();
          await expect(login.passwordInput).toHaveAttribute('type', 'password');
        });
      },
    );

    test(
      '[ID: 42] signing in from the nav-bar quick login form redirects to /offers',
      { tag: [idTag(42), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        await test.step('[Step 1][UI] Sign in as test_user_2 from the nav-bar form', async () => {
          const login = await new LoginPage(page).open();
          await login.signInFromNavBar(TEST_USER_2.username, TEST_USER_2.password);
        });

        await test.step('[Step 2][UI] The client lands on /offers', async () => {
          const offers = await new OffersPage(page).waitForLoaded();
          await expect(page).toHaveURL(offers.url);
        });
      },
    );

    test(
      '[ID: 43] wrong credentials on the login card show an error toast and stay on /',
      { tag: [idTag(43), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const login = new LoginPage(page);

        await test.step('[Step 1][UI] Submit test_user_2 with a wrong password', async () => {
          await login.open();
          await login.login(TEST_USER_2.username, 'definitely-not-the-password');
        });

        await test.step('[Step 2][UI] An error toast appears and the login card stays on /', async () => {
          await expect.soft(login.toast(TOAST.loginFailed)).toBeVisible();
          await expect.soft(page).toHaveURL(login.url);
          await expect.soft(login.uniqueElement).toBeVisible();
        });
      },
    );

    test.describe('signed in as test_user_2', () => {
      test.use({ persona: 'member' });

      test(
        '[ID: 44] redirectAuthenticatedGuard bounces a signed-in visitor away from /',
        { tag: [idTag(44), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
        async ({ page }) => {
          await test.step('[Step 1][UI] Navigate to / with a saved session', async () => {
            await new LoginPage(page).navigate();
          });

          await test.step('[Step 2][UI] The guard sends the visitor to /offers', async () => {
            const offers = await new OffersPage(page).waitForLoaded();
            await expect(page).toHaveURL(offers.url);
          });
        },
      );
    });
  },
);
