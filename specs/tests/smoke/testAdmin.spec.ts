import { AdminPage } from '../../../src/PageObjects';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test, TEST_USER_5 } from '../../support';

/** Smoke layer - the admin panel's User management tab. */
test.describe(
  'Tests verify the admin panel lists users with their roles',
  { tag: [LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
  () => {
    test.use({ persona: 'adminModerator' });

    test(
      '[ID: 33] test_user_5 opens /admin and the User management tab lists users with their roles',
      { tag: [idTag(33), LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const admin = await new AdminPage(page).open();
        await admin.openUserManagement();

        await expect(admin.userRows).not.toHaveCount(0);

        const adminRow = admin.userRow(TEST_USER_5.username);
        await expect(adminRow.root).toBeVisible();
        await expect(adminRow.roles).toContainText('Admin');
        await expect(adminRow.roles).toContainText('Moderator');
      },
    );
  },
);
