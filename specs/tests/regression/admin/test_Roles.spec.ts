import { AdminPage, OffersPage } from '../../../../src/PageObjects';
import { TIMEOUT } from '../../../../src/constants/timeouts';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test, TEST_USER_2 } from '../../../support';

/**
 * Regression layer - the roles modal (`RolesModalComponent`) and its effect
 * on `adminGuard`/the nav bar. `test_user_2` (`Member` only) is promoted and
 * demoted through the UI, signed in as `test_user_5`; `beforeEach` registers a
 * `cleanup` that puts its original roles back regardless of which test ran or
 * how it ended - "cleanup restores every role change" from TestCoveragePlan.md §6.3.
 */
test.describe(
  'Tests verify promoting and demoting a member through the roles modal',
  { tag: [LAYER_TAG.regression, MUTATION_TAG.mutation] },
  () => {
    test.use({ persona: 'adminModerator' });
    // Both tests mutate the same shared `test_user_2` account; `fullyParallel`
    // would otherwise let them race each other's role changes.
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ cleanup }) => {
      await cleanup.roles('member');
    });

    test(
      '[ID: 69] promoting test_user_2 to Moderator lets them open /admin with only Post management',
      { tag: [idTag(69), LAYER_TAG.regression, MUTATION_TAG.mutation] },
      async ({ page, pageAs }) => {
        // Two full page loads plus a second sign-in, on top of the modal
        // round trips below - webkit in particular needs more than the
        // 30 s default here.
        test.setTimeout(TIMEOUT.slowTest);
        const admin = new AdminPage(page);

        await test.step('[Step 1][UI] test_user_5 adds Moderator to test_user_2 in the roles modal', async () => {
          await admin.open();
          await admin.openUserManagement();
          await admin.openRolesModal(TEST_USER_2.username);
          await admin.setRole('Moderator', true);
          await admin.submitRoles();
        });

        await test.step('[Step 2][UI] The user table lists Member and Moderator for test_user_2', async () => {
          const row = admin.userRow(TEST_USER_2.username);
          await expect(row.roles).toContainText('Moderator');
          await expect(row.roles).toContainText('Member');
        });

        await test.step('[Step 3][UI] Signed in as test_user_2, /admin shows only Post management', async () => {
          const moderatorPage = await pageAs('member');
          const moderatorAdmin = await new AdminPage(moderatorPage).open();
          await expect(moderatorAdmin.tabs.headers).toHaveText(['Post management']);
        });
      },
    );

    test(
      '[ID: 71] demoting test_user_2 back to Member removes the Admin nav entry',
      { tag: [idTag(71), LAYER_TAG.regression, MUTATION_TAG.mutation] },
      async ({ page, apiAs, pageAs }) => {
        test.setTimeout(TIMEOUT.slowTest);
        const admin = new AdminPage(page);

        await test.step('[Step 1][API] Give test_user_2 the Admin role on top of Member', async () => {
          const adminApi = await apiAs('adminModerator');
          await adminApi.admin.editRoles(TEST_USER_2.username, ['Member', 'Admin']);
        });

        await test.step('[Step 2][UI] test_user_5 removes Admin from test_user_2 in the roles modal', async () => {
          await admin.open();
          await admin.openUserManagement();
          await admin.openRolesModal(TEST_USER_2.username);
          await admin.setRole('Admin', false);
          await admin.submitRoles();
          // The table re-populates from `admin/users-with-roles` once the change is saved.
          await expect(admin.userRow(TEST_USER_2.username).roles).not.toContainText('Admin');
        });

        await test.step('[Step 3][UI] Signed in as test_user_2, the nav bar has no Admin entry', async () => {
          const memberPage = await pageAs('member');
          const offers = await new OffersPage(memberPage).open();
          await expect(offers.navLink('Admin')).toHaveCount(0);
        });
      },
    );
  },
);

test.describe(
  'Tests verify the roles modal submit button state',
  { tag: [LAYER_TAG.regression, MUTATION_TAG.unmutation] },
  () => {
    test.use({ persona: 'adminModerator' });

    test(
      '[ID: 70] the roles modal Submit is enabled as long as at least one role stays checked',
      { tag: [idTag(70), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const admin = new AdminPage(page);

        await test.step('[Step 1][UI] Open the roles modal of test_user_2', async () => {
          await admin.open();
          await admin.openUserManagement();
          await admin.openRolesModal(TEST_USER_2.username);
        });

        await test.step('[Step 2][UI] Unchecking every role disables Submit, checking Member enables it', async () => {
          // Real behaviour: `RolesModalComponent`'s Submit is disabled only when
          // every role checkbox is unchecked (`[disabled]="selectedRoles.length
          // === 0"`) - not "unchanged from the roles the user already had", which
          // `isSubmitRolesEnabled()`'s name might suggest.
          await admin.selectOnlyRoles();
          await expect(admin.rolesModalSubmit).toBeDisabled();

          await admin.setRole('Member', true);
          await expect(admin.rolesModalSubmit).toBeEnabled();
        });

        await test.step('[Step 3][UI] Close the modal without submitting', async () => {
          // Closed via the header X, not Submit - `rolesUpdated` stays false, so
          // no `admin/edit-roles` call is made and nothing needs to be undone.
          await admin.closeRolesModal();
        });
      },
    );
  },
);
