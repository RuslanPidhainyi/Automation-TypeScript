import { FIXTURES } from './env';
import { expect, test as setup } from './fixtures';
import { PERSONAS } from './personas';

/**
 * Part of the `setup` project, next to `auth.setup.ts`: makes sure the test
 * accounts hold the data the specs take for granted. Idempotent - once the data
 * is there, every later run only reads.
 */

/**
 * `testEditProfile.spec.ts` swaps the member account's main photo and restores
 * it (`[ID: 60]`), and checks that it cannot be deleted (`[ID: 61]`). A test
 * account starts with no photo at all; `UsersController.AddPhoto` marks a user's
 * first photo as main, so a single upload is enough. It goes through Cloudinary,
 * like every photo upload in the suite.
 */
setup('the member test account has a main photo', async ({ apiAs }) => {
  const api = await apiAs('member');
  const { username } = PERSONAS.member.credentials;

  const photos = (await api.users.get(username)).generalPhotos ?? [];
  if (photos.some((photo) => photo.isMain)) return;

  if (photos.length > 0) {
    await api.users.setMainPhoto(photos[0].id);
    return;
  }

  const photo = await api.users.addPhoto(FIXTURES.photo);
  expect(photo.isMain, `the first photo of ${username} became the main one`).toBe(true);
});
