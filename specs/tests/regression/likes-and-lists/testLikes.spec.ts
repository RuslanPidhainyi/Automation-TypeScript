import { LIKE_COLOR, ListsPage, OffersPage } from '../../../../src/PageObjects';
import {
  expect,
  idTag,
  LAYER_TAG,
  MUTATION_TAG,
  signInThroughUi,
  test,
  TEST_USER_1,
  TEST_USER_2,
} from '../../../support';

/**
 * Regression layer - the like round trip and its persistence across a
 * reload. Likes and unlikes the same post inside the test (same "leaves no
 * trace" contract as a sign-in), so `@unmutation` rather than `@mutation` -
 * matching the reasoning already used for the smoke-layer likes check.
 */
test.describe(
  'Tests verify the like round trip and that it persists across a reload',
  { tag: [LAYER_TAG.regression, MUTATION_TAG.unmutation] },
  () => {
    test.use({ persona: 'member' });

    test(
      "[ID: 62] liking another member's post shows it on /lists and /offers even after a reload, unliking clears it",
      { tag: [idTag(62), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const title = await test.step('[Step 1][UI] Like the first post test_user_2 does not own', async () => {
          const offers = await new OffersPage(page).open();
          await offers.cards.first().waitFor();

          const likable = await offers.firstCardNotOwnedBy(TEST_USER_2.username);
          expect(likable, 'No likable post found - every post belongs to test_user_2').toBeDefined();
          const { card, title: likedTitle } = likable!;
          await card.toggleLike();

          await expect(offers.card(likedTitle).likeIcon).toHaveCSS('color', LIKE_COLOR.liked);
          return likedTitle;
        });

        await test.step('[Step 2][UI] The post is on /lists, also after a reload', async () => {
          const lists = await new ListsPage(page).open();
          await expect(lists.card(title).root).toBeVisible();

          // Persists across a reload - backed by `likes/list`, refetched on load.
          const reloaded = await lists.reload();
          await expect(reloaded.card(title).root).toBeVisible();
          await expect.soft(reloaded.card(title).likeIcon).toHaveCSS('color', LIKE_COLOR.liked);
        });

        await test.step('[Step 3][UI] /offers still shows the post liked', async () => {
          const offers = await new OffersPage(page).open();
          await expect(offers.card(title).likeIcon).toHaveCSS('color', LIKE_COLOR.liked);
        });

        await test.step('[Step 4][UI] Unliking clears it on /offers and removes it from /lists', async () => {
          const offers = new OffersPage(page);
          await offers.card(title).toggleLike();
          await expect(offers.card(title).likeIcon).toHaveCSS('color', LIKE_COLOR.notLiked);

          const lists = await new ListsPage(page).open();
          await expect(lists.card(title).root).toHaveCount(0);
        });
      },
    );
  },
);

test.describe(
  'Tests verify the empty Lists state',
  { tag: [LAYER_TAG.regression, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 63] a member who has liked nothing sees the empty state on /lists',
      { tag: [idTag(63), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        await test.step('[Step 1][UI] test_user_1 signs in through the login form', async () => {
          await signInThroughUi(page, TEST_USER_1);
        });

        await test.step('[Step 2][UI] /lists shows the empty state and no cards', async () => {
          const lists = await new ListsPage(page).open();
          await expect(lists.emptyState).toBeVisible();
          await expect(lists.cards).toHaveCount(0);
        });
      },
    );
  },
);
