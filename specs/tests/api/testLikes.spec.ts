import { API_ERROR } from '../../../src/constants/messages';
import { MISSING_ID } from '../../../src/constants/testData';
import { buildPostDto } from '../../../src/helpers/data/post.factory';
import { firstSeededPost } from '../../../src/helpers/data/posts.helper';
import { expect, FIXTURES, idTag, LAYER_TAG, MUTATION_TAG, test } from '../../support';

/**
 * API layer - `LikesController`: which posts a like may not go to, and that a
 * second toggle takes the like back.
 *
 * test_user_3 (`moderator`) likes a post of a seeded member - no test changes
 * those - and `cleanup` takes the like back if the test stops half-way.
 * test_user_4 (`admin`) publishes a post of its own through the API to try
 * liking it; `cleanup` deletes that post.
 */
test.describe(
  'Tests verify likes/{id} refuses a post that does not exist and toggles a like on and off',
  { tag: [LAYER_TAG.api, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 119] test_user_3 liking a post that does not exist answers 404 "Post not found"',
      { tag: [idTag(119), LAYER_TAG.api, MUTATION_TAG.unmutation] },
      async ({ apiAs }) => {
        const liker = await apiAs('moderator');

        const response = await liker.likes.toggleRaw(MISSING_ID);

        expect(response.status()).toBe(404);
        expect(await response.text()).toBe(API_ERROR.postNotFound);
      },
    );

    test(
      '[ID: 120] test_user_3 toggling a like twice adds the post to likes/list and takes it out again',
      { tag: [idTag(120), LAYER_TAG.api, MUTATION_TAG.unmutation] },
      async ({ apiAs, cleanup }) => {
        const liker = await apiAs('moderator');

        const postId = await test.step('[Step 1][API] Pick a seeded post test_user_3 does not like yet', async () => {
          const post = firstSeededPost(await liker.posts.list());
          expect(post, 'no post of a seeded member').toBeDefined();
          expect(await liker.likes.ids()).not.toContain(post!.id);
          return post!.id;
        });

        cleanup.like('moderator', postId);

        await test.step('[Step 2][API] The first toggle adds the post to likes/list', async () => {
          await liker.likes.toggle(postId);
          expect(await liker.likes.ids()).toContain(postId);
        });

        await test.step('[Step 3][API] The second toggle takes it out again', async () => {
          await liker.likes.toggle(postId);
          expect(await liker.likes.ids()).not.toContain(postId);
        });
      },
    );
  },
);

test.describe(
  'Tests verify a member cannot like their own post',
  { tag: [LAYER_TAG.api, MUTATION_TAG.mutation] },
  () => {
    test(
      '[ID: 121] test_user_4 liking its own post answers 400 "You cannot like your own post"',
      { tag: [idTag(121), LAYER_TAG.api, MUTATION_TAG.mutation] },
      async ({ apiAs, cleanup }) => {
        const post = buildPostDto();
        cleanup.post('admin', post.title);
        const owner = await apiAs('admin');

        const postId = await test.step(
          '[Step 1][API] test_user_4 publishes a post',
          async () => (await owner.posts.add(post, FIXTURES.photo)).id,
        );

        await test.step('[Step 2][API] test_user_4 tries to like it', async () => {
          const response = await owner.likes.toggleRaw(postId);
          expect(response.status()).toBe(400);
          expect(await response.text()).toBe(API_ERROR.cannotLikeOwnPost);
        });
      },
    );
  },
);
