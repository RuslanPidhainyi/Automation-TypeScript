import { AdminPage } from '../../../src/PageObjects';
import { RolesQueries } from '../../../src/constants/queries/mssql/roles.queries';
import { type RoleNameRow, roleNamesOf } from '../../../src/models';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test, TEST_USER_3 } from '../../support';

/**
 * e2e layer - closes the UI ⇒ API ⇒ DB triangle for the roles modal
 * (`regression/admin/test_Roles.spec.ts` already proves the UI side by
 * reading the roles cell of the user table, i.e. the same table the modal's
 * own `admin/users-with-roles` call re-populates). This file instead joins
 * `dbo.AspNetUserRoles` -> `dbo.AspNetRoles` directly, so a bug where the
 * endpoint's response drifted from what was actually written to the
 * Identity join table would still be caught.
 *
 * Targets `test_user_3` (persona `moderator`, `Moderator` only), not
 * `test_user_2`: `test_user_2` is already a shared resource the regression file
 * itself serialises with `mode: 'serial'`, but that only protects against a race
 * *within that file's own Playwright project* - this file is a separate project
 * (`e2e`) with no ordering relative to `regression-*`. `cleanup.roles` puts the
 * original roles back after the test.
 *
 *   [Step 1][DB] read test_user_3's current roles
 *   [Step 2][UI] test_user_5 adds Admin to test_user_3 in the roles modal
 *   [Step 3][DB] dbo.AspNetUserRoles holds the original roles plus Admin
 */
test.describe(
  "Tests verify the roles modal's submit is committed to dbo.AspNetUserRoles",
  { tag: [LAYER_TAG.e2e, MUTATION_TAG.mutation] },
  () => {
    test.use({ persona: 'adminModerator' });

    test(
      '[ID: 76] adding Admin to test_user_3 through the roles modal inserts the matching row in dbo.AspNetUserRoles',
      { tag: [idTag(76), LAYER_TAG.e2e, MUTATION_TAG.mutation] },
      async ({ page, db, cleanup }) => {
        const byUsername = { username: TEST_USER_3.username };
        await cleanup.roles('moderator');

        const originalRoles = await test.step("[Step 1][DB] Read test_user_3's current roles", async () => {
          return roleNamesOf(await db.query<RoleNameRow>(RolesQueries.getRoleNamesByUsername, byUsername));
        });

        await test.step('[Step 2][UI] test_user_5 adds Admin to test_user_3 in the roles modal', async () => {
          const admin = await new AdminPage(page).open();
          await admin.openUserManagement();
          await admin.openRolesModal(TEST_USER_3.username);
          await admin.setRole('Admin', true);
          await admin.submitRoles();
        });

        await test.step('[Step 3][DB] dbo.AspNetUserRoles holds the original roles plus Admin', async () => {
          await expect
            .poll(async () => roleNamesOf(await db.query<RoleNameRow>(RolesQueries.getRoleNamesByUsername, byUsername)))
            .toEqual([...originalRoles, 'Admin'].sort());
        });
      },
    );
  },
);
