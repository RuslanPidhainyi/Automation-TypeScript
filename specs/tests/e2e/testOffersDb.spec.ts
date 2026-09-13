import { AddOfferPage, ProfilePage } from '../../../src/PageObjects';
import { TOAST } from '../../../src/constants/messages';
import { PostsQueries } from '../../../src/constants/queries/mssql/posts.queries';
import { buildPost } from '../../../src/helpers/data/post.factory';
import { uniqueName } from '../../../src/helpers/data/unique.helper';
import { type CountRow, type PostRow, totalOf } from '../../../src/models';
import { expect, FIXTURES, idTag, LAYER_TAG, MUTATION_TAG, signInThroughUi, test, TEST_USER_4 } from '../../support';

/**
 * e2e layer - closes the UI ⇒ API ⇒ DB triangle for post CRUD
 * (`regression/offers/testOfferLifecycle.spec.ts` already proves the UI
 * side). Also exercises the `dbo.Likes.PostId` `OnDelete(DeleteBehavior.Cascade)`
 * FK declared in `AppDbContext.OnModelCreating` against a real row instead of
 * only inferring it from the UI no longer showing a like: `test_user_3` likes
 * the post through the API before it is deleted, and both the `Posts` row
 * and that `Likes` row are checked afterwards.
 *
 * The post's removal is registered with the `cleanup` fixture *before* it is
 * published, and looked up by title rather than by an id captured mid-test - a
 * DB-side failure between "the post was published" and "its id was read back"
 * would otherwise orphan a real row with no id recorded to delete it by. This is
 * not hypothetical: exactly that happened once while this file was being
 * built, when the DB connection string itself was still broken (see
 * `TestCoveragePlan.md` §5) - the UI step had already succeeded and left a
 * post behind that an id-only cleanup could never have found.
 *
 *   [Step 1][UI]  test_user_4 publishes a post
 *   [Step 2][DB]  the dbo.Posts row matches the form
 *   [Step 3][API] test_user_3 likes the post
 *   [Step 4][DB]  dbo.Likes holds that like
 *   [Step 5][UI]  test_user_4 deletes the post
 *   [Step 6][DB]  the Posts row and, by cascade, the Likes row are gone
 */
test.describe(
  'Tests verify publishing and deleting a post is reflected in dbo.Posts, cascading to dbo.Likes',
  { tag: [LAYER_TAG.e2e, MUTATION_TAG.mutation] },
  () => {
    test(
      '[ID: 75] publishing a post creates a matching dbo.Posts row; deleting it removes that row and any dbo.Likes row referencing it',
      { tag: [idTag(75), LAYER_TAG.e2e, MUTATION_TAG.mutation] },
      async ({ page, apiAs, db, cleanup }) => {
        const post = buildPost({ title: uniqueName('e2e DB Offer'), description: 'Created by the e2e DB-parity suite.' });
        cleanup.post('admin', post.title);

        await test.step('[Step 1][UI] test_user_4 publishes a post', async () => {
          await signInThroughUi(page, TEST_USER_4);
          const addOffer = await new AddOfferPage(page).open();
          await addOffer.attachPhoto(FIXTURES.photo);
          await addOffer.publish(post);
          await expect(addOffer.successToast).toContainText(TOAST.postAdded);
        });

        const postId = await test.step('[Step 2][DB] The dbo.Posts row matches the form', async () => {
          const [row] = await db.query<PostRow>(PostsQueries.getByTitle, { title: post.title });
          expect(row, 'the published post is committed to dbo.Posts').toBeTruthy();
          expect.soft(row.Title, 'Title').toBe(post.title);
          expect.soft(row.LocationCountry, 'LocationCountry').toBe(post.locationCountry);
          expect.soft(row.LocationCity, 'LocationCity').toBe(post.locationCity);
          expect.soft(row.Currency, 'Currency').toBe(post.currency);
          return row.Id;
        });

        await test.step('[Step 3][API] test_user_3 likes the post', async () => {
          const liker = await apiAs('moderator');
          await liker.likes.toggle(postId);
        });

        await test.step('[Step 4][DB] dbo.Likes holds that like', async () => {
          expect(totalOf(await db.query<CountRow>(PostsQueries.countLikesForPost, { postId }))).toBe(1);
        });

        await test.step('[Step 5][UI] test_user_4 deletes the post from the own profile', async () => {
          const profile = await new ProfilePage(page).open();
          await profile.openPostsTab();
          await profile.card(post.title).deleteIcon.click();
          await expect(profile.successToast).toContainText(TOAST.postDeleted);
        });

        await test.step('[Step 6][DB] The Posts row and, by cascade, the Likes row are gone', async () => {
          const [postAfter] = await db.query<PostRow>(PostsQueries.getByTitle, { title: post.title });
          const likesAfter = totalOf(await db.query<CountRow>(PostsQueries.countLikesForPost, { postId }));
          expect.soft(postAfter, 'the dbo.Posts row is gone').toBeUndefined();
          expect.soft(likesAfter, 'the FK cascade removed the dbo.Likes row').toBe(0);
        });
      },
    );
  },
);
