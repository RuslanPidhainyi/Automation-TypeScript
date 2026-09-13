import { LIKE_COLOR, ListsPage, OffersPage } from '../../../src/PageObjects';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test, TEST_USER_2 } from '../../support';

/**
 * Smoke layer - the like round-trip.
 *
 * `LikesController.ToggleLike` refuses to like your own post ("You cannot like
 * your own post"), so the first card not owned by test_user_2 is picked instead
 * of always the first one. The test likes, verifies `/lists`, then unlikes again
 * so nothing outlives the test - same "leaves no trace" contract as a sign-in,
 * hence @unmutation rather than @mutation.
 */
test.describe(
  'Tests verify liking a post',
  { tag: [LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
  () => {
    test.use({ persona: 'member' });

    test(
      "[ID: 30] test_user_2 likes another member's post, sees it on Lists, then unlikes it",
      { tag: [idTag(30), LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const offers = await new OffersPage(page).open();
        await offers.cards.first().waitFor();

        const likable = await offers.firstCardNotOwnedBy(TEST_USER_2.username);
        expect(likable, 'No likable post found - every post belongs to test_user_2').toBeDefined();
        const { card, title } = likable!;

        await card.toggleLike();
        await expect(card.likeIcon).toHaveCSS('color', LIKE_COLOR.liked);

        const lists = await new ListsPage(page).open();
        await expect(lists.card(title).root).toBeVisible();

        const offersAgain = await new OffersPage(page).open();
        const sameCard = offersAgain.card(title);
        await sameCard.toggleLike();
        await expect(sameCard.likeIcon).toHaveCSS('color', LIKE_COLOR.notLiked);
      },
    );
  },
);
