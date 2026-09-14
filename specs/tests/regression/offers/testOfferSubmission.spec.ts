import path from 'path';
import { AddOfferPage, ProfilePage } from '../../../../src/PageObjects';
import { API_ERROR, TOAST } from '../../../../src/constants/messages';
import { buildPost } from '../../../../src/helpers/data/post.factory';
import { readMultipart } from '../../../../src/helpers/network/apiStub.helper';
import { expect, FIXTURES, idTag, LAYER_TAG, MUTATION_TAG, test } from '../../../support';

/**
 * Regression layer - what `/add-offer` sends when a post is published and what
 * it does with the API's answer, against the `apiStub` fixture instead of the
 * real `posts/add-post`. Nothing reaches Cloudinary and nothing is stored, so
 * nothing needs cleanup. That the post really is created stays with
 * `testOfferLifecycle.spec.ts`, smoke `[ID: 29]` and e2e `[ID: 75]`.
 *
 * `[ID: 135]` is a refusal the real stack cannot produce on demand: Cloudinary
 * rejecting the photo.
 */
test.describe(
  'Tests verify how the add-post form publishes, against a stubbed API',
  { tag: [LAYER_TAG.regression, MUTATION_TAG.unmutation] },
  () => {
    test.use({ persona: 'member' });

    test(
      '[ID: 134] publishing sends the form fields and the photo in one request, then opens /member/profile',
      { tag: [idTag(134), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page, apiStub }) => {
        const entranceFee = { minPrice: '10', maxPrice: '30' };
        const post = buildPost({ entranceFee, description: 'Sent to a stubbed API.' });
        const addPost = await apiStub.addPostSucceeds();

        await test.step('[Step 1][UI] Publish a post with a photo and an entrance fee', async () => {
          const addOffer = await new AddOfferPage(page).open();
          await addOffer.attachPhoto(FIXTURES.photo);
          await addOffer.publish(post);
          await expect(addOffer.successToast).toContainText(TOAST.postAdded);
        });

        await test.step('[Step 2][UI] The client opens the own profile', async () => {
          const profile = await new ProfilePage(page).waitForLoaded();
          await expect(page).toHaveURL(profile.url);
        });

        await test.step('[Step 3][API] The request carried every filled field and the photo', async () => {
          const { fields, fileNames } = await readMultipart(await addPost.request);
          expect.soft(fileNames, 'the uploaded file').toEqual({ file: path.basename(FIXTURES.photo) });
          expect.soft(fields, 'the form fields').toMatchObject({
            title: post.title,
            locationCountry: post.locationCountry,
            locationCity: post.locationCity,
            lastCountry: post.lastCountry,
            lastRegion: post.lastRegion,
            currency: post.currency,
            description: post.description,
            localTransport: 'false',
            entranceFee: 'true',
            minPriceEntrFee: entranceFee.minPrice,
            maxPriceEntrFee: entranceFee.maxPrice,
          });
        });
      },
    );

    test(
      '[ID: 135] a photo Cloudinary rejects shows the reason and keeps the form and the queued photo',
      { tag: [idTag(135), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page, apiStub }) => {
        const post = buildPost();
        await apiStub.addPostRejectsPhoto();
        const addOffer = new AddOfferPage(page);

        await test.step('[Step 1][UI] Publish a post whose photo the API refuses', async () => {
          await addOffer.open();
          await addOffer.attachPhoto(FIXTURES.photo);
          await addOffer.publish(post);
          await expect(addOffer.toast(TOAST.postAddFailed)).toBeVisible();
        });

        await test.step('[Step 2][UI] The reason is shown and nothing the member entered is lost', async () => {
          await expect.soft(addOffer.toast(API_ERROR.photoRejected)).toBeVisible();
          await expect.soft(page).toHaveURL(addOffer.url);
          await expect.soft(addOffer.form.title.control).toHaveValue(post.title);
          await expect.soft(addOffer.uploader.queueRows).toHaveCount(1);
        });
      },
    );
  },
);
