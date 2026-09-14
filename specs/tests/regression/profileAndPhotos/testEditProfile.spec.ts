import { EditProfilePage, ProfilePage } from '../../../../src/PageObjects';
import { API_ERROR, TOAST } from '../../../../src/constants/messages';
import { TIMEOUT } from '../../../../src/constants/timeouts';
import { uniqueName } from '../../../../src/helpers/data/unique.helper';
import { expect, FIXTURES, idTag, issuesOf, LAYER_TAG, MUTATION_TAG, test } from '../../../support';

/**
 * Regression layer - `/member/edit-profile`. Both tests mutate the `member`
 * account's (`test_user_2`'s) own profile rather than freshly created data, so -
 * unlike every other state-changing spec in this suite - the point is not to
 * delete what was made but to put that profile back exactly as it was.
 * `beforeEach` snapshots it through `cleanup.profile`, which restores the text
 * fields, removes added photos and verifies the result after each test,
 * whatever its outcome. The main photo both photo checks rely on is provided by
 * `specs/support/data.setup.ts`.
 *
 * The snapshot/restore covers *all four* text fields, even in `[ID: 60]`, which
 * never touches them - so if the two ran concurrently (the `fullyParallel`
 * default), `[ID: 60]`'s snapshot could catch the profile mid-edit while
 * `[ID: 59]` is running, and its restore would then overwrite `[ID: 59]`'s own
 * correct restore with that stale snapshot. Serial mode is the fix - it also
 * protects `[ID: 60]`'s own multi-step Cloudinary sequence, for the same reason
 * as `testRoles.spec.ts`.
 *
 * A photo is "main" exactly when its Main button is disabled - the template
 * binds both `[disabled]` and the `btn-active` class to `photo.isMain`.
 */
test.describe(
  "Tests verify editing the signed-in member's profile",
  { tag: [LAYER_TAG.regression, MUTATION_TAG.mutation] },
  () => {
    test.use({ persona: 'member' });
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ cleanup }) => {
      await cleanup.profile('member');
    });

    test(
      '[ID: 59] editing description, interests, city and country saves and survives a reload',
      { tag: [idTag(59), LAYER_TAG.regression, MUTATION_TAG.mutation] },
      async ({ page }) => {
        const updated = {
          description: uniqueName('Regression description'),
          interests: 'Regression interests',
          city: 'Regression City',
          country: 'Regression Country',
        };

        await test.step('[Step 1][UI] Save new description, interests, city and country', async () => {
          const editProfile = await new EditProfilePage(page).open();
          await editProfile.update(updated);
          await expect(editProfile.successToast).toContainText(TOAST.profileUpdated);
        });

        await test.step('[Step 2][UI] The About tab shows the new description and interests', async () => {
          const profile = await new ProfilePage(page).open();
          await profile.openAboutTab();
          await expect.soft(profile.description).toHaveText(updated.description);
          await expect.soft(profile.interests).toHaveText(updated.interests);
        });

        await test.step('[Step 3][UI] The description survives a reload', async () => {
          const reloaded = await new ProfilePage(page).reload();
          await reloaded.openAboutTab();
          await expect(reloaded.description).toHaveText(updated.description);
        });
      },
    );

    test(
      '[ID: 60] uploading a photo and setting it main updates the nav avatar; deleting it removes it again',
      { tag: [idTag(60), LAYER_TAG.regression, MUTATION_TAG.mutation] },
      async ({ page }) => {
        // Four Cloudinary/DB round-trips (upload, two set-main, delete) in one
        // test - comfortably over the 30 s default on a slower browser/host,
        // and Cloudinary itself gets measurably slower under heavy local
        // parallelism (four browser workers hitting it at once).
        test.setTimeout(TIMEOUT.cloudinaryTest);

        // Each of these round-trips through Cloudinary and the DB, which can
        // occasionally run past the default 5 s window under load - give them
        // more headroom rather than treating a slow save as a failure.
        const ROUND_TRIP = { timeout: TIMEOUT.cloudinaryRoundTrip };
        const editProfile = new EditProfilePage(page);

        const { before, mainIndex, originalMainUrl } = await test.step(
          '[Step 1][UI] Open /member/edit-profile and find the main photo',
          async () => {
            await editProfile.open();
            const index = await editProfile.mainPhotoIndex();
            expect(index, 'test_user_2 has a main photo (specs/support/data.setup.ts)').toBeGreaterThanOrEqual(0);

            return {
              before: await editProfile.photoCount(),
              mainIndex: index,
              originalMainUrl: String(await editProfile.photo(index).image.getAttribute('src')),
            };
          },
        );

        // ng2-file-upload appends to the end of the list.
        const uploaded = editProfile.photo(before);

        await test.step('[Step 2][UI] Upload a photo - it is added, but not as the main one', async () => {
          await editProfile.uploader.dropFiles(FIXTURES.photo);
          await editProfile.uploader.uploadAllButton.click();
          await expect(editProfile.photos).toHaveCount(before + 1, ROUND_TRIP);
          await expect(uploaded.mainButton).toBeEnabled();
        });

        await test.step('[Step 3][UI] Setting it main updates the nav avatar', async () => {
          await uploaded.mainButton.click();
          await expect(uploaded.mainButton).toBeDisabled(ROUND_TRIP);

          const newMainUrl = String(await uploaded.image.getAttribute('src'));
          await expect(editProfile.navAvatar).toHaveAttribute('src', newMainUrl, ROUND_TRIP);
        });

        await test.step('[Step 4][UI] Restore the original main photo', async () => {
          await editProfile.photo(mainIndex).mainButton.click();
          await expect(editProfile.photo(mainIndex).mainButton).toBeDisabled(ROUND_TRIP);
          await expect(editProfile.navAvatar).toHaveAttribute('src', originalMainUrl, ROUND_TRIP);
        });

        await test.step('[Step 5][UI] Delete the uploaded photo', async () => {
          await uploaded.deleteButton.click();
          await expect(editProfile.photos).toHaveCount(before, ROUND_TRIP);
        });
      },
    );
  },
);

test.describe(
  "Tests verify the signed-in member's main photo",
  { tag: [LAYER_TAG.regression, MUTATION_TAG.unmutation] },
  () => {
    test.use({ persona: 'member' });

    test(
      '[ID: 61] the main photo cannot be deleted',
      { tag: [idTag(61), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const editProfile = new EditProfilePage(page);

        const mainIndex = await test.step('[Step 1][UI] Open /member/edit-profile and find the main photo', async () => {
          await editProfile.open();
          const index = await editProfile.mainPhotoIndex();
          expect(index, 'test_user_2 has a main photo (specs/support/data.setup.ts)').toBeGreaterThanOrEqual(0);
          return index;
        });

        await test.step('[Step 2][UI] Both its Main and delete buttons are disabled', async () => {
          await expect.soft(editProfile.photo(mainIndex).mainButton).toBeDisabled();
          await expect.soft(editProfile.photo(mainIndex).deleteButton).toBeDisabled();
        });
      },
    );
  },
);

/**
 * Against the `apiStub` fixture: `users/add-photo` refused the way the API
 * refuses a photo Cloudinary rejects. Nothing is uploaded or stored, so the
 * block needs no snapshot. The photo editor shows the reason the API gave in an
 * error toast (`onErrorItem`), empties the upload queue and adds no photo.
 */
test.describe(
  'Tests verify the photo editor when the upload is refused, against a stubbed API',
  { tag: [LAYER_TAG.regression, MUTATION_TAG.unmutation] },
  () => {
    test.use({ persona: 'member' });

    test(
      '[ID: 136] a photo Cloudinary rejects shows the reason, is not added to the profile and leaves the upload queue',
      { tag: [idTag(136), LAYER_TAG.regression, MUTATION_TAG.unmutation], annotation: issuesOf(136) },
      async ({ page, apiStub }) => {
        await apiStub.addPhotoRejectsPhoto();
        const editProfile = new EditProfilePage(page);

        const before = await test.step('[Step 1][UI] Open /member/edit-profile and count the photos', async () => {
          await editProfile.open();
          return editProfile.photoCount();
        });

        await test.step('[Step 2][UI] Upload a photo the API refuses - the reason is shown, the queue empties, the photos stay', async () => {
          await editProfile.uploader.dropFiles(FIXTURES.photo);
          await expect(editProfile.uploader.queueRows).toHaveCount(1);

          await editProfile.uploader.uploadAllButton.click();
          await expect(editProfile.toast(API_ERROR.photoRejected)).toBeVisible();
          await expect(editProfile.uploader.queueRows).toHaveCount(0);
          await expect(editProfile.photos).toHaveCount(before);
        });
      },
    );
  },
);
