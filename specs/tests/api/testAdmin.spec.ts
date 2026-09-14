import { API_ERROR } from '../../../src/constants/messages';
import { unknownUsername } from '../../../src/helpers/data/unique.helper';
import { ValidationProblemSchema } from '../../../src/models';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, PERSONAS, test, TEST_USER_2 } from '../../support';

/**
 * API layer - `AdminController.EditRoles`: what an admin's role change is
 * refused for. test_user_4 (`admin`) passes the `RequireAdminRole` policy, so
 * neither refusal is about who calls, and neither changes a role.
 */
test.describe(
  'Tests verify admin/edit-roles refuses an incomplete role change',
  { tag: [LAYER_TAG.api, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 126] test_user_4 saving no role for test_user_2 answers 400 naming the roles parameter',
      { tag: [idTag(126), LAYER_TAG.api, MUTATION_TAG.unmutation] },
      async ({ apiAs }) => {
        const api = await apiAs('admin');

        const response = await api.admin.editRolesRaw(TEST_USER_2.username, []);

        // `roles` is a non-nullable `string`, so `[ApiController]` refuses an empty one before `EditRoles`
        // runs - the action's own "you must select at least one role" is never reached.
        expect(response.status()).toBe(400);
        await expect(response).toMatchSchema(ValidationProblemSchema);
        expect((await response.json()).errors).toHaveProperty('roles');
      },
    );

    test(
      '[ID: 127] test_user_4 editing the roles of a username nobody has answers 400 "User not found"',
      { tag: [idTag(127), LAYER_TAG.api, MUTATION_TAG.unmutation] },
      async ({ apiAs }) => {
        const api = await apiAs('admin');

        const response = await api.admin.editRolesRaw(unknownUsername(), PERSONAS.member.roles);

        expect(response.status()).toBe(400);
        expect(await response.text()).toBe(API_ERROR.userNotFound);
      },
    );
  },
);
