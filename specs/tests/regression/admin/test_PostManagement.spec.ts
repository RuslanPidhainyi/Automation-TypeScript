import { AdminPage } from '../../../../src/PageObjects';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test } from '../../../support';

/**
 * Regression layer - the admin panel's Post management tab.
 *
 * `PostManagementComponent` is still the project's scaffolded placeholder
 * (`<p>post-management works!</p>`) - it never calls `admin/contents-to-moderate`.
 * Per the project's own rule for a nav/guard mismatch (TestCoveragePlan.md
 * §2), this asserts the real current behaviour instead of the moderation-list
 * behaviour the coverage plan originally sketched, and links back here so a
 * future implementation of the tab is expected to update this test.
 */
test.describe(
  'Tests verify the admin Post management tab',
  { tag: [LAYER_TAG.regression, MUTATION_TAG.unmutation] },
  () => {
    test.use({ persona: 'adminModerator' });

    test(
      '[ID: 72] the Post management tab currently renders only its placeholder, not moderation content',
      { tag: [idTag(72), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const admin = new AdminPage(page);

        await test.step('[Step 1][UI] Open /admin on the Post management tab', async () => {
          await admin.open();
          await admin.openPostManagement();
        });

        await test.step('[Step 2][UI] The tab renders only the scaffolded placeholder', async () => {
          await expect(admin.postManagement).toContainText('post-management works!');
        });
      },
    );
  },
);
