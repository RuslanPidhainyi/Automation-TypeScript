import { EditProfilePage } from '../../../src/PageObjects';
import { TOAST } from '../../../src/constants/messages';
import { UsersQueries } from '../../../src/constants/queries/mssql/users.queries';
import { uniqueName } from '../../../src/helpers/data/unique.helper';
import { type ProfileFields, type ProfileFieldsRow, profileFieldsOfRow } from '../../../src/models';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, signInThroughUi, test, TEST_USER_4 } from '../../support';

/**
 * e2e layer - closes the UI ⇒ API ⇒ DB triangle `TestCoveragePlan.md` §7
 * describes for the member profile. `regression/profile-and-photos/test_EditProfile.spec.ts`
 * `[ID: 59]` already proves UI ⇒ API (it re-`GET`s `users/{username}` and
 * compares); this file adds the missing link by reading `dbo.AspNetUsers`
 * directly, so a bug where the API echoes a value it never actually
 * persisted would still be caught.
 *
 * Runs against `test_user_4` (persona `admin`), not the `member` account
 * (`test_user_2`): that profile is already snapshot/restored by the regression
 * layer under `mode: 'serial'` (`[ID: 59]`/`[ID: 60]`), which only protects
 * against a race *within that file's own project*. This file is its own
 * Playwright project (`e2e`) with no ordering guarantee relative to
 * `regression-*`, so touching the same account here would reintroduce the exact
 * class of bug `TestCoveragePlan.md` §4 (entry 17) already had to fix once.
 * `test_user_4`'s Admin role plays no part in editing a profile.
 *
 * `cleanup.profile` snapshots the raw values, `null` included, and puts exactly
 * those back after the test - normalising `null` to `''` happens only for the
 * comparison below.
 *
 *   [Step 1][UI] test_user_4 saves new description, interests, city and country
 *   [Step 2][DB] the dbo.AspNetUsers row holds each new value
 */
test.describe(
  "Tests verify editing the profile through the UI is committed to dbo.AspNetUsers",
  { tag: [LAYER_TAG.e2e, MUTATION_TAG.mutation] },
  () => {
    test.beforeEach(async ({ cleanup }) => {
      await cleanup.profile('admin');
    });

    test(
      '[ID: 73] editing description, interests, city and country through /member/edit-profile is reflected in dbo.AspNetUsers, not just echoed by the API',
      { tag: [idTag(73), LAYER_TAG.e2e, MUTATION_TAG.mutation] },
      async ({ page, db }) => {
        const updated: ProfileFields = {
          description: uniqueName('e2e DB description'),
          interests: 'e2e DB interests',
          city: 'e2e DB City',
          country: 'e2e DB Country',
        };

        await test.step('[Step 1][UI] test_user_4 saves new description, interests, city and country', async () => {
          await signInThroughUi(page, TEST_USER_4);
          const editProfile = await new EditProfilePage(page).open();
          await editProfile.update(updated);
          await expect(editProfile.successToast).toContainText(TOAST.profileUpdated);
        });

        await test.step('[Step 2][DB] The dbo.AspNetUsers row holds each new value', async () => {
          const [row] = await db.query<ProfileFieldsRow>(UsersQueries.getProfileByUsername, {
            username: TEST_USER_4.username,
          });
          expect(row, 'a matching dbo.AspNetUsers row exists').toBeTruthy();

          const stored = profileFieldsOfRow(row);
          expect.soft(stored.description, 'Description').toBe(updated.description);
          expect.soft(stored.interests, 'Interests').toBe(updated.interests);
          expect.soft(stored.city, 'City').toBe(updated.city);
          expect.soft(stored.country, 'Country').toBe(updated.country);
        });
      },
    );
  },
);
