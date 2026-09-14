import type { APIResponse } from '@playwright/test';
import type { TravelApi } from '../../src/api/TravelApi';
import { ENDPOINTS } from '../../src/constants/endpoints';
import { firstSeededPost } from '../../src/helpers/data/posts.helper';
import { PERSONAS, type Caller } from './personas';

/** What a probe aims at, besides the caller sending it. */
export interface ProbeTarget {
  /** A post that exists. */
  postId: number;
  /** The account `edit-roles` is aimed at. */
  username: string;
}

/** One request of the authorization matrix (`specs/tests/api/testAuthorizationMatrix.spec.ts`). */
export interface Probe {
  label: string;
  send: (caller: TravelApi, target: ProbeTarget) => Promise<APIResponse>;
}

const probes = {
  listPosts: { label: 'GET posts', send: (caller) => caller.posts.listRaw() },
  getPost: { label: 'GET posts/{id}', send: (caller, { postId }) => caller.posts.getRaw(postId) },
  listUsers: { label: 'GET users', send: (caller) => caller.users.listRaw() },
  inbox: { label: 'GET messages?container=Inbox', send: (caller) => caller.messages.containerRaw('Inbox') },
  likedPostIds: { label: 'GET likes/list', send: (caller) => caller.likes.idsRaw() },
  toggleLike: { label: 'POST likes/{id}', send: (caller, { postId }) => caller.likes.toggleRaw(postId) },
  usersWithRoles: { label: 'GET admin/users-with-roles', send: (caller) => caller.admin.usersWithRolesRaw() },
  contentsToModerate: {
    label: 'GET admin/contents-to-moderate',
    send: (caller) => caller.admin.contentsToModerateRaw(),
  },
  editRoles: {
    label: 'POST admin/edit-roles/{username}?roles=Member',
    send: (caller, { username }) => caller.admin.editRolesRaw(username, PERSONAS.member.roles),
  },
  buggyAuth: { label: 'GET buggy/auth', send: (caller) => caller.buggy.getRaw(ENDPOINTS.buggy.auth) },
} satisfies Record<string, Probe>;

/**
 * The requests the matrix sends, each as its raw call - the status is what the
 * matrix checks.
 */
export const PROBES: { readonly [Name in keyof typeof probes]: Probe } = probes;

/**
 * What every probe aims at: a post a seeded member published, read through
 * `member`, and `member`'s own account - `edit-roles?roles=Member` would leave
 * test_user_2's roles exactly as they are, so even a refusal that stopped
 * working changes nothing.
 */
export async function probeTarget(apiAs: (caller: Caller) => Promise<TravelApi>): Promise<ProbeTarget> {
  const post = firstSeededPost(await (await apiAs('member')).posts.list());
  if (!post) {
    throw new Error('GET posts holds no post of a seeded member - did the seed run?');
  }
  return { postId: post.id, username: PERSONAS.member.credentials.username };
}
