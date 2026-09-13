import { OfferDetailsPage, OffersPage } from '../../../src/PageObjects';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test } from '../../support';

/**
 * Smoke layer - browsing the offers grid.
 *
 * `/offers` is seeded with data (`API/Data/UserSeedData.json`), so both checks
 * are read-only against the seed - no post is created or removed here.
 */
test.describe(
  'Tests verify browsing the offers grid',
  { tag: [LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
  () => {
    test.use({ persona: 'member' });

    test(
      '[ID: 27] the offers grid lists at least one seeded post',
      { tag: [idTag(27), LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const offers = await new OffersPage(page).open();

        // `uniqueElement` is the heading, painted before `posts` resolves - the
        // retrying count waits for the cards (TestCoveragePlan.md, Failed attempts #11).
        await expect(offers.cards).not.toHaveCount(0);
        await expect(offers.emptyState).toBeHidden();
      },
    );

    test(
      '[ID: 28] opening the first card navigates to its offer details with a matching title',
      { tag: [idTag(28), LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const offers = await new OffersPage(page).open();
        await offers.cards.first().waitFor();

        const title = (await offers.firstCard().title.innerText()).trim();
        await offers.firstCard().openDetails();

        const details = await new OfferDetailsPage(page).waitForLoaded();
        await expect(details.placeInfo).toContainText(title);
      },
    );
  },
);
