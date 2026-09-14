import {
  AddOfferPage,
  EditProfilePage,
  ListsPage,
  MemberProfilePage,
  MessagesPage,
  OfferDetailsPage,
  OffersPage,
  ProfilePage,
} from '../../../src/PageObjects';
import { expect, FIXTURES, idTag, issuesOf, LAYER_TAG, MUTATION_TAG, test, TEST_USER_1 } from '../../support';

/**
 * Accessibility layer - the screens of a signed-in member (`test_user_2`), each in
 * the states a member can open: menus, tabs, the price sections of the post form
 * and a queued photo. Queuing a photo uploads nothing, so the whole file only
 * reads. Every check waits for the screen's data first - axe scans what is on the
 * page at that moment.
 */
test.describe(
  'Tests verify the screens of a signed-in member have no accessibility violations',
  { tag: [LAYER_TAG.accessibility, MUTATION_TAG.unmutation] },
  () => {
    test.use({ persona: 'member' });

    test(
      '[ID: 142] /offers has no accessibility violations',
      { tag: [idTag(142), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(142) },
      async ({ page }) => {
        const offers = await new OffersPage(page).open();
        await expect(offers.firstCard().root).toBeVisible();
        await offers.waitForSpinnerToDisappear();

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      '[ID: 143] /offers with the user menu open has no accessibility violations',
      { tag: [idTag(143), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(143) },
      async ({ page }) => {
        const offers = await new OffersPage(page).open();
        await expect(offers.firstCard().root).toBeVisible();
        await offers.openUserMenu();

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      '[ID: 144] a post on /offers/:id has no accessibility violations',
      { tag: [idTag(144), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(144) },
      async ({ page }) => {
        const offers = await new OffersPage(page).open();
        await offers.firstCard().openDetails();
        const details = await new OfferDetailsPage(page).waitForLoaded();
        await expect(details.ownerName).not.toBeEmpty();
        await details.waitForSpinnerToDisappear();

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      "[ID: 145] another member's profile has no accessibility violations on the Posts tab",
      { tag: [idTag(145), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(145) },
      async ({ page }) => {
        const memberProfile = await new MemberProfilePage(page, TEST_USER_1.username).open();
        await memberProfile.waitForSpinnerToDisappear();

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      "[ID: 146] another member's profile has no accessibility violations on the About tab",
      { tag: [idTag(146), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(146) },
      async ({ page }) => {
        const memberProfile = await new MemberProfilePage(page, TEST_USER_1.username).open();
        await memberProfile.openAboutTab();
        await memberProfile.waitForSpinnerToDisappear();

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      "[ID: 147] another member's profile has no accessibility violations on the Messages tab",
      { tag: [idTag(147), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(147) },
      async ({ page }) => {
        const memberProfile = await new MemberProfilePage(page, TEST_USER_1.username).open();
        await memberProfile.startConversation();
        await expect(memberProfile.messageInput).toBeVisible();

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      '[ID: 148] the own profile has no accessibility violations on the Posts tab',
      { tag: [idTag(148), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(148) },
      async ({ page }) => {
        const profile = await new ProfilePage(page).open();
        await expect(profile.addPostButton).toBeVisible();
        await profile.waitForSpinnerToDisappear();

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      '[ID: 149] the own profile has no accessibility violations on the About tab',
      { tag: [idTag(149), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(149) },
      async ({ page }) => {
        const profile = await new ProfilePage(page).open();
        await profile.openAboutTab();
        await profile.waitForSpinnerToDisappear();

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      '[ID: 150] /member/edit-profile with a photo queued for upload has no accessibility violations',
      { tag: [idTag(150), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(150) },
      async ({ page }) => {
        const editProfile = await new EditProfilePage(page).open();
        await editProfile.uploader.dropFiles(FIXTURES.photo);
        await expect(editProfile.uploader.queueRows).toHaveCount(1);

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      '[ID: 151] /lists has no accessibility violations',
      { tag: [idTag(151), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(151) },
      async ({ page }) => {
        const lists = await new ListsPage(page).open();
        await lists.waitForSpinnerToDisappear();

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      '[ID: 152] /messages has no accessibility violations',
      { tag: [idTag(152), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(152) },
      async ({ page }) => {
        const messages = await new MessagesPage(page).open();
        await messages.waitForSpinnerToDisappear();

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      '[ID: 153] /add-offer with every price section open and a photo queued has no accessibility violations',
      { tag: [idTag(153), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(153) },
      async ({ page }) => {
        const addOffer = await new AddOfferPage(page).open();
        for (const toggle of ['localTransport', 'entranceFee', 'placeStay', 'groceryStore', 'guide'] as const) {
          await addOffer.form.setToggle(toggle, true);
        }
        await addOffer.attachPhoto(FIXTURES.photo);
        await expect(addOffer.form.maxPriceGuide.control).toBeVisible();
        await expect(addOffer.uploader.queueRows).toHaveCount(1);

        await expect(page).toHaveNoA11yViolations();
      },
    );
  },
);
