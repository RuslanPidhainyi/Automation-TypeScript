import { AddOfferPage, ProfilePage, REQUIRED_POST_FIELDS } from '../../../../src/PageObjects';
import { CURRENCY } from '../../../../src/constants/testData';
import { buildPost } from '../../../../src/helpers/data/post.factory';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, signInThroughUi, test, TEST_USER_1 } from '../../../support';

/**
 * Regression layer - the travel-post form (`postForm` widget), exercised
 * through `/add-offer`. Every check here only reads the form's own state
 * (never submits), so nothing is created and nothing needs cleanup.
 */
test.describe(
  'Tests verify the add-post form validators and toggle-dependent fields',
  { tag: [LAYER_TAG.regression, MUTATION_TAG.unmutation] },
  () => {
    test.use({ persona: 'member' });

    test(
      '[ID: 51] leaving any required field empty keeps Share post disabled',
      { tag: [idTag(51), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const valid = buildPost();
        const addOffer = new AddOfferPage(page);

        for (const [index, omitted] of REQUIRED_POST_FIELDS.entries()) {
          await test.step(`[Step ${index + 1}][UI] Without ${omitted}, Share post stays disabled`, async () => {
            await addOffer.open();
            await addOffer.fillRequired(valid, omitted);

            await expect
              .soft(addOffer.submitButton, `Share post should stay disabled without ${omitted}`)
              .toBeDisabled();
          });
        }
      },
    );

    test(
      '[ID: 52] toggling a price section reveals its fields and keeps the entered values',
      { tag: [idTag(52), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const addOffer = new AddOfferPage(page);
        const { form } = addOffer;

        await test.step('[Step 1][UI] Open /add-offer', async () => {
          await addOffer.open();
        });

        await test.step('[Step 2][UI] Local transport: its fields appear, keep their values and hide again', async () => {
          await expect(form.minPriceLocalTransport.control).toBeHidden();
          await form.setToggle('localTransport', true);
          await expect(form.minPriceLocalTransport.control).toBeVisible();

          await form.minPriceLocalTransport.fill('50');
          await form.maxPriceLocalTransport.fill('100');
          await form.travelTime.fill('4');
          await expect.soft(form.minPriceLocalTransport.control).toHaveValue('50');
          await expect.soft(form.maxPriceLocalTransport.control).toHaveValue('100');

          await form.setToggle('localTransport', false);
          await expect.soft(form.minPriceLocalTransport.control).toBeHidden();
        });

        await test.step('[Step 3][UI] Entrance fee: its fields appear, keep their values and hide again', async () => {
          await expect(form.minPriceEntranceFee.control).toBeHidden();
          await form.setToggle('entranceFee', true);
          await expect(form.minPriceEntranceFee.control).toBeVisible();

          await form.minPriceEntranceFee.fill('10');
          await form.maxPriceEntranceFee.fill('50');
          await expect.soft(form.maxPriceEntranceFee.control).toHaveValue('50');

          await form.setToggle('entranceFee', false);
          await expect.soft(form.minPriceEntranceFee.control).toBeHidden();
        });

        await test.step('[Step 4][UI] Grocery store: its fields appear, keep their values and hide again', async () => {
          await expect(form.minPriceGroceryStore.control).toBeHidden();
          await form.setToggle('groceryStore', true);
          await expect(form.minPriceGroceryStore.control).toBeVisible();

          await form.minPriceGroceryStore.fill('5');
          await expect.soft(form.minPriceGroceryStore.control).toHaveValue('5');

          await form.setToggle('groceryStore', false);
          await expect.soft(form.minPriceGroceryStore.control).toBeHidden();
        });

        await test.step('[Step 5][UI] Guide: its fields appear, keep their values and hide again', async () => {
          await expect(form.minPriceGuide.control).toBeHidden();
          await form.setToggle('guide', true);
          await expect(form.minPriceGuide.control).toBeVisible();

          await form.minPriceGuide.fill('20');
          await expect.soft(form.minPriceGuide.control).toHaveValue('20');

          await form.setToggle('guide', false);
          await expect.soft(form.minPriceGuide.control).toBeHidden();
        });
      },
    );

    test(
      '[ID: 53] the accommodation type select offers Camping/Hotel/Hostel and currency is a free-text field',
      { tag: [idTag(53), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const addOffer = new AddOfferPage(page);
        const { form } = addOffer;

        await test.step('[Step 1][UI] The place-stay toggle reveals the accommodation select', async () => {
          await addOffer.open();
          await expect(form.accommodationTypeSelect).toBeHidden();
          await form.setToggle('placeStay', true);
          await expect(form.accommodationTypeSelect).toBeVisible();
        });

        await test.step('[Step 2][UI] The select accepts Camping, Hotel and Hostel', async () => {
          for (const type of ['Camping', 'Hotel', 'Hostel'] as const) {
            await form.accommodationTypeSelect.selectOption(type);
            await expect.soft(form.accommodationTypeSelect).toHaveValue(type);
          }
        });

        await test.step('[Step 3][UI] Currency takes free text', async () => {
          await form.currency.fill(CURRENCY.eur);
          await expect(form.currency.control).toHaveValue(CURRENCY.eur);
        });
      },
    );
  },
);

/**
 * Kept out of the block above: it needs to sign in as `TEST_USER_1` itself, so
 * it must not inherit that block's `persona: 'member'` (a page already signed
 * in as test_user_2 would never see the login form `signInThroughUi` needs -
 * `redirectAuthenticatedGuard` would bounce it straight to `/offers`).
 */
test.describe(
  "Tests verify a postless member's empty profile state",
  { tag: [LAYER_TAG.regression, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 54] a member with no posts sees the empty state on their own profile',
      { tag: [idTag(54), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        await test.step('[Step 1][UI] test_user_1 signs in through the login form', async () => {
          await signInThroughUi(page, TEST_USER_1);
        });

        await test.step('[Step 2][UI] The Posts tab of the own profile shows the empty state', async () => {
          const profile = await new ProfilePage(page).open();
          await profile.openPostsTab();

          await expect(profile.emptyState).toBeVisible();
          await expect(profile.cards).toHaveCount(0);
        });
      },
    );
  },
);
