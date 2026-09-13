import { expect, idTag, LAYER_TAG, MUTATION_TAG, PROBES, probeTarget, test } from '../../support';

/**
 * API layer - who may call what.
 *
 * Every cell of the matrix is its own test: one caller sends one request, and
 * the status must be the one the route's `[Authorize]` attribute or policy
 * promises (`API/Controllers/*.cs`, `IdentetiServiceExtensions`):
 *
 *   401 - no token, and the route needs a signed-in caller
 *   403 - signed in, but without the role the policy requires
 *   200 - let through
 *
 * `anonymous` sends no token; `member` (test_user_2, Member), `moderator`
 * (test_user_3, Moderator) and `admin` (test_user_4, Admin) sign in through
 * `apiAs`. A request that would change data once let through - `POST likes/{id}`,
 * `edit-roles` - is only sent by the callers it must refuse, so the whole file
 * is `@unmutation`.
 *
 * A signed-in caller's roles travel in the token issued at sign-in. A test that
 * changes those accounts' roles while this file runs
 * (`regression/admin/test_Roles.spec.ts`, `e2e/test_RolesDb.spec.ts`) would turn
 * a 403 here into a 200 - run the `api` project on its own.
 */
test.describe(
  'Tests verify which callers each API route lets through',
  { tag: [LAYER_TAG.api, MUTATION_TAG.unmutation] },
  () => {
    const matrix = [
      { id: 77, probe: PROBES.listPosts, caller: 'anonymous', status: 401 },
      { id: 78, probe: PROBES.listPosts, caller: 'member', status: 200 },
      { id: 79, probe: PROBES.listPosts, caller: 'moderator', status: 200 },
      { id: 80, probe: PROBES.listPosts, caller: 'admin', status: 200 },

      { id: 81, probe: PROBES.getPost, caller: 'anonymous', status: 401 },
      { id: 82, probe: PROBES.getPost, caller: 'member', status: 200 },
      { id: 83, probe: PROBES.getPost, caller: 'moderator', status: 200 },
      { id: 84, probe: PROBES.getPost, caller: 'admin', status: 200 },

      { id: 85, probe: PROBES.listUsers, caller: 'anonymous', status: 401 },
      { id: 86, probe: PROBES.listUsers, caller: 'member', status: 200 },
      { id: 87, probe: PROBES.listUsers, caller: 'moderator', status: 200 },
      { id: 88, probe: PROBES.listUsers, caller: 'admin', status: 200 },

      { id: 89, probe: PROBES.inbox, caller: 'anonymous', status: 401 },
      { id: 90, probe: PROBES.inbox, caller: 'member', status: 200 },
      { id: 91, probe: PROBES.inbox, caller: 'moderator', status: 200 },
      { id: 92, probe: PROBES.inbox, caller: 'admin', status: 200 },

      { id: 93, probe: PROBES.likedPostIds, caller: 'anonymous', status: 401 },
      { id: 94, probe: PROBES.likedPostIds, caller: 'member', status: 200 },
      { id: 95, probe: PROBES.likedPostIds, caller: 'moderator', status: 200 },
      { id: 96, probe: PROBES.likedPostIds, caller: 'admin', status: 200 },

      { id: 97, probe: PROBES.toggleLike, caller: 'anonymous', status: 401 },

      { id: 98, probe: PROBES.usersWithRoles, caller: 'anonymous', status: 401 },
      { id: 99, probe: PROBES.usersWithRoles, caller: 'member', status: 403 },
      { id: 100, probe: PROBES.usersWithRoles, caller: 'moderator', status: 403 },
      { id: 101, probe: PROBES.usersWithRoles, caller: 'admin', status: 200 },

      { id: 102, probe: PROBES.contentsToModerate, caller: 'anonymous', status: 401 },
      { id: 103, probe: PROBES.contentsToModerate, caller: 'member', status: 403 },
      { id: 104, probe: PROBES.contentsToModerate, caller: 'moderator', status: 200 },
      { id: 105, probe: PROBES.contentsToModerate, caller: 'admin', status: 200 },

      { id: 106, probe: PROBES.editRoles, caller: 'anonymous', status: 401 },
      { id: 107, probe: PROBES.editRoles, caller: 'member', status: 403 },
      { id: 108, probe: PROBES.editRoles, caller: 'moderator', status: 403 },

      { id: 109, probe: PROBES.buggyAuth, caller: 'anonymous', status: 401 },
      { id: 110, probe: PROBES.buggyAuth, caller: 'member', status: 200 },
      { id: 111, probe: PROBES.buggyAuth, caller: 'moderator', status: 200 },
      { id: 112, probe: PROBES.buggyAuth, caller: 'admin', status: 200 },
    ] as const;

    for (const { id, probe, caller, status } of matrix) {
      test(
        `[ID: ${id}] ${probe.label} answers ${status} to ${caller}`,
        { tag: [idTag(id), LAYER_TAG.api, MUTATION_TAG.unmutation] },
        async ({ apiAs }) => {
          const target = await probeTarget(apiAs);

          const response = await probe.send(await apiAs(caller), target);

          expect(response.status()).toBe(status);
        },
      );
    }
  },
);
