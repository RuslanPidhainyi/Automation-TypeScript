import { AdminPage, TestErrorsPage } from '../../../src/PageObjects';
import { expect, idTag, issuesOf, LAYER_TAG, MUTATION_TAG, test, TEST_USER_2 } from '../../support';

/**
 * Accessibility layer - the screens behind `adminGuard`, as `test_user_5`
 * (Admin and Moderator), who sees both admin tabs and the error playground.
 * Opening the roles dialog changes nothing until it is submitted, and it never
 * is here.
 */
test.describe(
  'Tests verify the admin screens have no accessibility violations',
  { tag: [LAYER_TAG.accessibility, MUTATION_TAG.unmutation] },
  () => {
    test.use({ persona: 'adminModerator' });

    test(
      '[ID: 154] /admin has no accessibility violations on the User management tab',
      { tag: [idTag(154), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(154) },
      async ({ page }) => {
        const admin = await new AdminPage(page).open();
        await expect(admin.userRows.first()).toBeVisible();
        await admin.waitForSpinnerToDisappear();

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      '[ID: 155] /admin has no accessibility violations on the Post management tab',
      { tag: [idTag(155), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(155) },
      async ({ page }) => {
        const admin = await new AdminPage(page).open();
        await admin.openPostManagement();

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      '[ID: 156] the roles dialog has no accessibility violations',
      { tag: [idTag(156), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(156) },
      async ({ page }) => {
        const admin = await new AdminPage(page).open();
        await admin.openRolesModal(TEST_USER_2.username);

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      '[ID: 157] /errors has no accessibility violations',
      { tag: [idTag(157), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(157) },
      async ({ page }) => {
        const errors = await new TestErrorsPage(page).open();
        await errors.waitForSpinnerToDisappear();

        await expect(page).toHaveNoA11yViolations();
      },
    );
  },
);
