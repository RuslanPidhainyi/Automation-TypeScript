import { AddOfferPage, EditOfferPage, OfferDetailsPage, OffersPage, ProfilePage } from '../../../../src/PageObjects';
import { TOAST } from '../../../../src/constants/messages';
import { TIMEOUT } from '../../../../src/constants/timeouts';
import { buildPost } from '../../../../src/helpers/data/post.factory';
import { uniqueName } from '../../../../src/helpers/data/unique.helper';
import { expect, FIXTURES, idTag, LAYER_TAG, MUTATION_TAG, test } from '../../../support';

/**
 * Regression layer - full create/edit/delete CRUD on a post, plus the
 * optional price sections on `/offers/:id`. Each test creates its own post and
 * registers its removal with the `cleanup` fixture before publishing, per the
 * test-data strategy in TestCoveragePlan.md §1.
 *
 * Publishing uploads the photo to Cloudinary and deleting a post removes it
 * from there, so the toasts those two actions end with wait
 * `TIMEOUT.cloudinaryRoundTrip`, and every test gets `TIMEOUT.cloudinaryTest`:
 * under a full local run, with the other browsers publishing at the same time,
 * both round trips have run past the defaults.
 */
test.describe(
  'Tests verify creating, editing and deleting a post',
  { tag: [LAYER_TAG.regression, MUTATION_TAG.mutation] },
  () => {
    test.use({ persona: 'member' });

    test.beforeEach(() => {
      test.setTimeout(TIMEOUT.cloudinaryTest);
    });

    const CLOUDINARY_ROUND_TRIP = { timeout: TIMEOUT.cloudinaryRoundTrip };

    test(
      '[ID: 55] creating a post with a price section appears on /offers and /member/profile',
      { tag: [idTag(55), LAYER_TAG.regression, MUTATION_TAG.mutation] },
      async ({ page, cleanup }) => {
        const title = uniqueName('Regression Offer');
        cleanup.post('member', title);

        await test.step('[Step 1][UI] Publish a post with an entrance fee', async () => {
          const addOffer = await new AddOfferPage(page).open();
          await addOffer.attachPhoto(FIXTURES.photo);
          await addOffer.publish(
            buildPost({
              title,
              entranceFee: { minPrice: '10', maxPrice: '30' },
              description: 'Created by the regression suite.',
            }),
          );
          await expect(addOffer.successToast).toContainText(TOAST.postAdded, CLOUDINARY_ROUND_TRIP);
        });

        await test.step('[Step 2][UI] The post is listed on /offers', async () => {
          const offers = await new OffersPage(page).open();
          await expect(offers.card(title).root).toBeVisible();
        });

        await test.step('[Step 3][UI] The post is listed on the own profile', async () => {
          const profile = await new ProfilePage(page).open();
          await profile.openPostsTab();
          await expect(profile.card(title).root).toBeVisible();
        });
      },
    );

    test(
      '[ID: 56] editing a post pre-fills the existing values, saves, and the change survives a reload',
      { tag: [idTag(56), LAYER_TAG.regression, MUTATION_TAG.mutation] },
      async ({ page, cleanup }) => {
        const post = buildPost({ title: uniqueName('Regression Offer'), description: 'Original description.' });
        const editedTitle = `${post.title} (edited)`;
        cleanup.post('member', post.title);
        cleanup.post('member', editedTitle);

        await test.step('[Step 1][UI] Publish a post', async () => {
          const addOffer = await new AddOfferPage(page).open();
          await addOffer.attachPhoto(FIXTURES.photo);
          await addOffer.publish(post);
          await expect(addOffer.successToast).toBeVisible(CLOUDINARY_ROUND_TRIP);
        });

        const editOffer = new EditOfferPage(page);

        await test.step('[Step 2][UI] The edit form opens pre-filled with the post', async () => {
          const profile = await new ProfilePage(page).open();
          await profile.openPostsTab();
          await profile.card(post.title).editIcon.click();

          await editOffer.waitForLoaded();
          // `waitForLoaded()` only proves the (always-rendered) submit button
          // exists - `loadPost()` still has to resolve its own GET before
          // `patchValue` fills the form; the title is the retrying precondition.
          await expect(editOffer.form.title.control).toHaveValue(post.title);
          await expect.soft(editOffer.form.locationCountry.control).toHaveValue(post.locationCountry);
          await expect.soft(editOffer.form.currency.control).toHaveValue(post.currency);
        });

        await test.step('[Step 3][UI] Save a new title and description', async () => {
          await editOffer.update({ title: editedTitle, description: 'Edited by the regression suite.' });
          await expect(editOffer.successToast).toContainText(TOAST.postUpdated);
        });

        await test.step('[Step 4][UI] The profile lists the edited title, also after a reload', async () => {
          const profile = await new ProfilePage(page).waitForLoaded();
          await profile.openPostsTab();
          await expect(profile.card(editedTitle).root).toBeVisible();

          const reloaded = await profile.reload();
          await reloaded.openPostsTab();
          await expect(reloaded.card(editedTitle).root).toBeVisible();
        });
      },
    );

    test(
      '[ID: 57] deleting a post removes it from /offers and from the profile',
      { tag: [idTag(57), LAYER_TAG.regression, MUTATION_TAG.mutation] },
      async ({ page, cleanup }) => {
        const title = uniqueName('Regression Offer');
        cleanup.post('member', title);

        await test.step('[Step 1][UI] Publish a post', async () => {
          const addOffer = await new AddOfferPage(page).open();
          await addOffer.attachPhoto(FIXTURES.photo);
          await addOffer.publish(buildPost({ title }));
          await expect(addOffer.successToast).toBeVisible(CLOUDINARY_ROUND_TRIP);
        });

        await test.step('[Step 2][UI] Delete it from the own profile', async () => {
          const profile = await new ProfilePage(page).open();
          await profile.openPostsTab();
          await profile.card(title).deleteIcon.click();

          await expect(profile.successToast).toContainText(TOAST.postDeleted, CLOUDINARY_ROUND_TRIP);
          await expect.soft(profile.card(title).root).toHaveCount(0);
        });

        await test.step('[Step 3][UI] /offers no longer lists it', async () => {
          const offers = await new OffersPage(page).open();
          await expect(offers.card(title).root).toHaveCount(0);
        });
      },
    );

    test(
      '[ID: 58] /offers/:id renders only the optional sections that were actually filled',
      { tag: [idTag(58), LAYER_TAG.regression, MUTATION_TAG.mutation] },
      async ({ page, cleanup }) => {
        const title = uniqueName('Regression Offer');
        cleanup.post('member', title);

        await test.step('[Step 1][UI] Publish a post with only the entrance fee filled', async () => {
          const addOffer = await new AddOfferPage(page).open();
          await addOffer.attachPhoto(FIXTURES.photo);
          await addOffer.publish(buildPost({ title, entranceFee: { minPrice: '5', maxPrice: '15' } }));
          await expect(addOffer.successToast).toBeVisible(CLOUDINARY_ROUND_TRIP);
        });

        await test.step('[Step 2][UI] /offers/:id shows the entrance fee and no other optional section', async () => {
          const offers = await new OffersPage(page).open();
          await offers.card(title).openDetails();

          const details = await new OfferDetailsPage(page).waitForLoaded();
          // `.offer-container` renders before `getPost` resolves, so every optional
          // section starts out hidden regardless of the data - the visible entrance
          // fee is the retrying precondition that the post has loaded.
          await expect(details.section('entranceFee')).toBeVisible();
          await expect.soft(details.section('localTransport')).toBeHidden();
          await expect.soft(details.section('placeStay')).toBeHidden();
          await expect.soft(details.section('groceryStore')).toBeHidden();
          await expect.soft(details.section('guide')).toBeHidden();
        });
      },
    );
  },
);
