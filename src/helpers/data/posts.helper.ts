import { SEED } from '../../constants/testData';
import type { PostDto } from '../../models';

/**
 * The first post in `posts` that `username` is allowed to like (it belongs to
 * someone else - `LikesController.ToggleLike` refuses your own post) and whose
 * title appears only once in the list; `undefined` when there is none.
 *
 * The title has to be unique because `OffersPage.card(title)` finds a card by
 * its title text, and the seed data reuses some titles (e.g. "Yosemite National
 * Park" three times) - such a title resolves to several cards and violates
 * Playwright's strict mode.
 */
export function firstLikablePostWithUniqueTitle(posts: PostDto[], username: string): PostDto | undefined {
  const titleCounts = new Map<string, number>();
  for (const post of posts) {
    titleCounts.set(post.title, (titleCounts.get(post.title) ?? 0) + 1);
  }

  return posts.find(
    (post) =>
      post.userName?.toLowerCase() !== username.toLowerCase() && titleCounts.get(post.title) === 1,
  );
}

/**
 * The first post in `posts` a seeded member published; `undefined` when there
 * is none. No test creates, edits or deletes those, so it stays put while a test
 * aims a request at it - and since no spec signs in as a seeded member, every
 * test account may like it.
 */
export function firstSeededPost(posts: PostDto[]): PostDto | undefined {
  return posts.find((post) => SEED.members.some((member) => member === post.userName?.toLowerCase()));
}
