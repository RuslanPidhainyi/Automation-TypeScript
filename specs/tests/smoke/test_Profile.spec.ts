import { ProfilePage } from '../../../src/PageObjects';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test } from '../../support';

/** Smoke layer - the signed-in member's own profile renders its two halves. */
test.describe(
  "Tests verify the signed-in member's own profile",
  { tag: [LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
  () => {
    test.use({ persona: 'member' });

    test(
      "[ID: 31] test_user_2's own profile renders the sidebar and the Posts/About tabs",
      { tag: [idTag(31), LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const profile = await new ProfilePage(page).open();

        await expect(profile.sidebar.root).toBeVisible();

        const headings = await profile.tabs.headings();
        expect(headings.some((heading) => /'s Posts$/.test(heading))).toBe(true);
        expect(headings.some((heading) => /^About /.test(heading))).toBe(true);
      },
    );
  },
);
