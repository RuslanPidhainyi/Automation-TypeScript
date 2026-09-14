import { AddOfferPage, LoginPage, NotFoundPage, RegistrationPage } from '../../../src/PageObjects';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test } from '../../support';

/**
 * Visual layer - the screens whose content does not depend on data, compared
 * pixel by pixel with the baselines in `testScreens.spec.ts-snapshots/`. Local
 * only: the baselines are rendered on Windows, so CI never lists the `visual`
 * project. After an intended change to one of these screens, refresh them with
 * `npm run test:visual -- --update-snapshots` and review the new images before
 * committing them.
 */
test.describe(
  'Tests verify the screens a signed-out visitor sees still look the same',
  { tag: [LAYER_TAG.visual, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 159] the login page matches its baseline',
      { tag: [idTag(159), LAYER_TAG.visual, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const login = await new LoginPage(page).open();
        await login.waitForSpinnerToDisappear();

        await expect(page).toHaveScreenshot('login.png', { fullPage: true });
      },
    );

    test(
      '[ID: 160] the registration form matches its baseline',
      { tag: [idTag(160), LAYER_TAG.visual, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const registration = await new RegistrationPage(page).open();
        await registration.waitForSpinnerToDisappear();

        await expect(page).toHaveScreenshot('registration.png', { fullPage: true });
      },
    );

    test(
      '[ID: 161] the not-found page matches its baseline',
      { tag: [idTag(161), LAYER_TAG.visual, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const notFound = await new NotFoundPage(page).open();
        await notFound.waitForSpinnerToDisappear();

        await expect(page).toHaveScreenshot('not-found.png', { fullPage: true });
      },
    );
  },
);

test.describe(
  'Tests verify the screens of a signed-in member still look the same',
  { tag: [LAYER_TAG.visual, MUTATION_TAG.unmutation] },
  () => {
    test.use({ persona: 'member' });

    test(
      '[ID: 162] the empty add-post form matches its baseline, the account photo masked',
      { tag: [idTag(162), LAYER_TAG.visual, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const addOffer = await new AddOfferPage(page).open();
        await addOffer.waitForSpinnerToDisappear();

        // The avatar is the account's Cloudinary photo - data, not layout.
        await expect(page).toHaveScreenshot('add-offer.png', { fullPage: true, mask: [addOffer.navAvatar] });
      },
    );
  },
);
