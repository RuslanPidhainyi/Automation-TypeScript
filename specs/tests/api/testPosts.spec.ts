import { API_ERROR } from '../../../src/constants/messages';
import { MISSING_ID } from '../../../src/constants/testData';
import { buildPostDto } from '../../../src/helpers/data/post.factory';
import { expect, FIXTURES, idTag, issuesOf, LAYER_TAG, MUTATION_TAG, test } from '../../support';

/**
 * API layer - `PostsController`: a post can be read only while it exists, and
 * changed only by the member who published it.
 *
 * A refusal is proven on a post a broken check could not harm: test_user_4
 * (`admin`) publishes one of its own through the API, test_user_3 (`moderator`)
 * is the member who does not own it, and `cleanup` deletes the post afterwards.
 * `cleanup` finds the post by its title, so the attempted edit leaves the title
 * alone.
 */
test.describe(
  'Tests verify GET posts/{id} answers only for a post that exists',
  { tag: [LAYER_TAG.api, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 116] GET posts/{id} of a post that does not exist answers 404',
      { tag: [idTag(116), LAYER_TAG.api, MUTATION_TAG.unmutation] },
      async ({ apiAs }) => {
        const api = await apiAs('member');

        const response = await api.posts.getRaw(MISSING_ID);

        expect(response.status()).toBe(404);
      },
    );
  },
);

test.describe(
  'Tests verify only the owner may change a post',
  { tag: [LAYER_TAG.api, MUTATION_TAG.mutation] },
  () => {
    test(
      '[ID: 117] test_user_3 deleting a post of test_user_4 answers 400 "This post cannot be deleted" and the post stays',
      { tag: [idTag(117), LAYER_TAG.api, MUTATION_TAG.mutation] },
      async ({ apiAs, cleanup }) => {
        const post = buildPostDto();
        cleanup.post('admin', post.title);
        const owner = await apiAs('admin');
        const stranger = await apiAs('moderator');

        const postId = await test.step(
          '[Step 1][API] test_user_4 publishes a post',
          async () => (await owner.posts.add(post, FIXTURES.photo)).id,
        );

        await test.step('[Step 2][API] test_user_3 tries to delete it', async () => {
          const response = await stranger.posts.removeRaw(postId);
          expect(response.status()).toBe(400);
          expect(await response.text()).toBe(API_ERROR.postCannotBeDeleted);
        });

        await test.step('[Step 3][API] The post is still there', async () => {
          expect((await owner.posts.get(postId)).title).toBe(post.title);
        });
      },
    );

    test(
      '[ID: 118] test_user_3 editing a post of test_user_4 answers 403 and the post keeps its description',
      { tag: [idTag(118), LAYER_TAG.api, MUTATION_TAG.mutation], annotation: issuesOf(118) },
      async ({ apiAs, cleanup }) => {
        const post = buildPostDto();
        cleanup.post('admin', post.title);
        const owner = await apiAs('admin');
        const stranger = await apiAs('moderator');

        const postId = await test.step(
          '[Step 1][API] test_user_4 publishes a post',
          async () => (await owner.posts.add(post, FIXTURES.photo)).id,
        );

        await test.step('[Step 2][API] test_user_3 tries to rewrite its description', async () => {
          const response = await stranger.posts.editRaw(postId, {
            ...post,
            description: 'Rewritten by a member who does not own the post.',
          });
          expect(response.status()).toBe(403);
        });

        await test.step('[Step 3][API] The post keeps its description', async () => {
          expect((await owner.posts.get(postId)).description).toBe(post.description);
        });
      },
    );
  },
);
