import { AddOfferPage, ProfilePage } from '../../../src/PageObjects';
import { TOAST } from '../../../src/constants/messages';
import { buildPost } from '../../../src/helpers/data/post.factory';
import { uniqueName } from '../../../src/helpers/data/unique.helper';
import { expect, FIXTURES, idTag, LAYER_TAG, MUTATION_TAG, test } from '../../support';

/**
 * Smoke layer - publishing a new post.
 *
 * Creates its own data and registers its removal with the `cleanup` fixture
 * before publishing, per the test-data strategy in TestCoveragePlan.md §1 - a
 * state-changing test must never depend on, or leave behind, seed data.
 */
test.describe(
  'Tests verify publishing a new post',
  { tag: [LAYER_TAG.smoke, MUTATION_TAG.mutation] },
  () => {
    test.use({ persona: 'member' });

    test(
      '[ID: 29] test_user_2 publishes a new post with a photo and it appears on their profile',
      { tag: [idTag(29), LAYER_TAG.smoke, MUTATION_TAG.mutation] },
      async ({ page, cleanup }) => {
        const title = uniqueName('Smoke Offer');
        cleanup.post('member', title);

        const addOffer = await new AddOfferPage(page).open();
        await addOffer.attachPhoto(FIXTURES.photo);
        await addOffer.publish(buildPost({ title, description: 'Published by the smoke suite.' }));

        await expect(addOffer.successToast).toContainText(TOAST.postAdded);

        const profile = await new ProfilePage(page).open();
        await profile.openPostsTab();
        await expect(profile.card(title).root).toBeVisible();
      },
    );
  },
);
