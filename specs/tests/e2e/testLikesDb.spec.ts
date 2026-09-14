import { LIKE_COLOR, OffersPage } from '../../../src/PageObjects';
import { LikesQueries } from '../../../src/constants/queries/mssql/likes.queries';
import { firstLikablePostWithUniqueTitle } from '../../../src/helpers/data/posts.helper';
import { type CountRow, totalOf } from '../../../src/models';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, signInThroughUi, test, TEST_USER_4 } from '../../support';

/**
 * e2e layer - `dbo.Likes` has a composite primary key `(AppUserId, PostId)`,
 * no surrogate `Id` at all (`AppDbContext.OnModelCreating`). No API response
 * exposes that row shape directly - `regression/likesAndLists/testLikes.spec.ts`
 * `[ID: 62]` already proves the UI round trip; this file proves the exact row
 * the UI action is supposed to produce actually exists (and is actually gone
 * again) in the table itself.
 *
 * Likes and unlikes the same post inside the test, leaving no trace, so
 * `@unmutation` - same reasoning `testLikes.spec.ts` already documents for
 * the identical pattern.
 *
 *   [Step 1][API] pick a post test_user_4 may like, with a unique title
 *   [Step 2][DB]  test_user_4 has no like on it yet
 *   [Step 3][UI]  test_user_4 likes it on /offers
 *   [Step 4][DB]  dbo.Likes holds exactly one row for it
 *   [Step 5][UI]  test_user_4 unlikes it
 *   [Step 6][DB]  the row is gone again
 */
test.describe(
  'Tests verify liking/unliking a post inserts and removes the matching row in dbo.Likes',
  { tag: [LAYER_TAG.e2e, MUTATION_TAG.unmutation] },
  () => {
    test(
      "[ID: 74] liking another member's post inserts a (AppUserId, PostId) row in dbo.Likes; unliking removes it",
      { tag: [idTag(74), LAYER_TAG.e2e, MUTATION_TAG.unmutation] },
      async ({ page, apiAs, db }) => {
        const { postId, title } = await test.step(
          '[Step 1][API] Pick a post test_user_4 may like, with a unique title',
          async () => {
            const api = await apiAs('admin');
            const target = firstLikablePostWithUniqueTitle(await api.posts.list(), TEST_USER_4.username);
            expect(target, 'No likable post with a unique title found').toBeDefined();
            return { postId: target!.id, title: target!.title };
          },
        );

        const likeKey = { username: TEST_USER_4.username, postId };
        const offers = new OffersPage(page);

        await test.step('[Step 2][DB] test_user_4 has no like on the post yet', async () => {
          expect(totalOf(await db.query<CountRow>(LikesQueries.countForUserAndPost, likeKey))).toBe(0);
        });

        await test.step('[Step 3][UI] test_user_4 likes the post on /offers', async () => {
          await signInThroughUi(page, TEST_USER_4);
          await offers.open();
          await offers.card(title).toggleLike();
          await expect(offers.card(title).likeIcon).toHaveCSS('color', LIKE_COLOR.liked);
        });

        await test.step('[Step 4][DB] dbo.Likes holds exactly one row for it', async () => {
          expect(totalOf(await db.query<CountRow>(LikesQueries.countForUserAndPost, likeKey))).toBe(1);
        });

        await test.step('[Step 5][UI] test_user_4 unlikes the post', async () => {
          await offers.card(title).toggleLike();
          await expect(offers.card(title).likeIcon).toHaveCSS('color', LIKE_COLOR.notLiked);
        });

        await test.step('[Step 6][DB] The row is gone again', async () => {
          expect(totalOf(await db.query<CountRow>(LikesQueries.countForUserAndPost, likeKey))).toBe(0);
        });
      },
    );
  },
);
