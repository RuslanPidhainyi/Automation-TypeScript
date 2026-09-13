import {
  AddOfferPage,
  AdminPage,
  appUrl,
  BasePage,
  EditOfferPage,
  EditProfilePage,
  ListsPage,
  MemberProfilePage,
  MessagesPage,
  NotFoundPage,
  OfferDetailsPage,
  OffersPage,
  ProfilePage,
  TestErrorsPage,
} from '../../../../src/PageObjects';
import { TOAST } from '../../../../src/constants/messages';
import { uniqueName } from '../../../../src/helpers/data/unique.helper';
import {
  expect,
  idTag,
  LAYER_TAG,
  MUTATION_TAG,
  signInThroughUi,
  test,
  TEST_USER_2,
  TEST_USER_3,
} from '../../../support';

/**
 * Regression layer - `authGuard` and `adminGuard` (`Client/src/app/_guards`).
 *
 * Every route below sits behind `authGuard`'s parent (`app.routes.ts`), which
 * fires the toast `You shall not pass!` and does not redirect on refusal -
 * `BasePage.navigate()` is used instead of `open()` for exactly this case
 * (it does not wait for the target's `uniqueElement`, since the guard is
 * expected to keep it from ever rendering). Each guarded route is its own step
 * with soft checks, so one run reports every route that lets a visitor through.
 */
test.describe(
  'Tests verify route guards',
  { tag: [LAYER_TAG.regression, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 45] signed out, every authGuard-protected route is blocked with the "You shall not pass!" toast',
      { tag: [idTag(45), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const targets: BasePage[] = [
          new OffersPage(page),
          new OfferDetailsPage(page, 1),
          new MemberProfilePage(page, TEST_USER_2.username),
          new ProfilePage(page),
          new EditProfilePage(page),
          new ListsPage(page),
          new MessagesPage(page),
          new AddOfferPage(page),
          new EditOfferPage(page, 1),
          new AdminPage(page),
          new TestErrorsPage(page),
        ];

        for (const [index, target] of targets.entries()) {
          await test.step(`[Step ${index + 1}][UI] /${target.path} is blocked for a signed-out visitor`, async () => {
            await target.navigate();

            await expect.soft(target.toast(TOAST.signInRequired)).toBeVisible();
            await expect.soft(target.uniqueElement).toBeHidden();
          });
        }
      },
    );

    test(
      '[ID: 46] a Moderator sees only Post management on /admin and can still reach /errors by direct URL',
      { tag: [idTag(46), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        await test.step('[Step 1][UI] test_user_3 signs in through the login form', async () => {
          await signInThroughUi(page, TEST_USER_3);
        });

        await test.step('[Step 2][UI] /admin shows only the Post management tab', async () => {
          const admin = await new AdminPage(page).open();
          await expect(admin.tabs.headers).toHaveText(['Post management']);
        });

        await test.step('[Step 3][UI] The nav bar shows Admin but not Errors', async () => {
          const offers = new OffersPage(page);
          await expect.soft(offers.navLink('Admin')).toBeVisible();
          await expect.soft(offers.navLink('Errors')).toHaveCount(0);
        });

        await test.step('[Step 4][UI] /errors still opens by direct URL', async () => {
          // The nav bar hides /errors from a Moderator (`*appHasRole="['Admin']"`),
          // but `adminGuard` admits Admin *or* Moderator - a real mismatch between
          // the nav and the guard, documented in TestCoveragePlan.md §2 rather than
          // silently "fixed" here.
          const errors = await new TestErrorsPage(page).open();
          await expect(errors.uniqueElement).toBeVisible();
        });
      },
    );

    test.describe('signed in as a member', () => {
      test.use({ persona: 'member' });

      test(
        '[ID: 47] a member is blocked from /admin and /errors with the "You cannot enter this area" toast',
        { tag: [idTag(47), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
        async ({ page }) => {
          const targets: BasePage[] = [new AdminPage(page), new TestErrorsPage(page)];

          for (const [index, target] of targets.entries()) {
            await test.step(`[Step ${index + 1}][UI] /${target.path} is blocked for a member`, async () => {
              await target.navigate();

              await expect.soft(target.toast(TOAST.adminAreaForbidden)).toBeVisible();
              await expect.soft(target.uniqueElement).toBeHidden();
            });
          }
        },
      );

      test(
        '[ID: 48] leaving a dirty /member/edit-profile: dismissing the confirm() keeps the user, accepting lets them go',
        { tag: [idTag(48), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
        async ({ page }) => {
          const editProfile = new EditProfilePage(page);

          await test.step('[Step 1][UI] Make /member/edit-profile dirty', async () => {
            await editProfile.open();
            await editProfile.descriptionInput.fill(uniqueName('Dirty change'));
            await expect(editProfile.unsavedChangesWarning).toBeVisible();
          });

          await test.step('[Step 2][UI] Dismissing the confirm() keeps the user on the page', async () => {
            editProfile.handleUnsavedChangesDialog(false);
            await editProfile.goTo('Offers');
            await expect(page).toHaveURL(editProfile.url);
            await expect(editProfile.uniqueElement).toBeVisible();
          });

          await test.step('[Step 3][UI] Accepting it lets the user leave for /offers', async () => {
            editProfile.handleUnsavedChangesDialog(true);
            await editProfile.goTo('Offers');
            const offers = await new OffersPage(page).waitForLoaded();
            await expect(page).toHaveURL(offers.url);
          });
        },
      );
    });

    test(
      '[ID: 49] an unknown URL renders the NotFound page',
      { tag: [idTag(49), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        await test.step('[Step 1][UI] Navigate to a route that does not exist', async () => {
          await page.goto(appUrl('this-route-does-not-exist-1234'));
        });

        await test.step('[Step 2][UI] The NotFound page renders', async () => {
          const notFound = await new NotFoundPage(page).waitForLoaded();
          await expect(notFound.heading).toBeVisible();
        });
      },
    );
  },
);
