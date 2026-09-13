import {
  AdminPage,
  ListsPage,
  MessagesPage,
  OffersPage,
  TestErrorsPage,
} from '../../../src/PageObjects';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test } from '../../support';

/**
 * Smoke layer - the primary navigation bar.
 *
 * The bar is role-gated (`*appHasRole`): a member sees Offers/Lists/Messages,
 * an admin additionally sees Admin and Errors. Each visible link must both
 * render and actually route to a page whose `uniqueElement` shows up - see
 * TestCoveragePlan.md §6.2.
 */
test.describe(
  'Tests verify primary navigation',
  { tag: [LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
  () => {
    test.describe('as a member', () => {
      test.use({ persona: 'member' });

      test(
        '[ID: 25] a member sees Offers, Lists and Messages in the nav bar and can reach each one',
        { tag: [idTag(25), LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
        async ({ page }) => {
          const offers = await new OffersPage(page).open();
          await expect(offers.navLinks).toHaveText(['Offers', 'Lists', 'Messages']);

          await offers.goTo('Lists');
          await new ListsPage(page).waitForLoaded();

          const lists = new ListsPage(page);
          await lists.goTo('Messages');
          await new MessagesPage(page).waitForLoaded();

          const messages = new MessagesPage(page);
          await messages.goTo('Offers');
          await offers.waitForLoaded();
        },
      );
    });

    test.describe('as an admin', () => {
      test.use({ persona: 'adminModerator' });

      test(
        '[ID: 26] an admin additionally sees Admin and Errors and can reach both',
        { tag: [idTag(26), LAYER_TAG.smoke, MUTATION_TAG.unmutation] },
        async ({ page }) => {
          const offers = await new OffersPage(page).open();
          await expect(offers.navLinks).toHaveText(['Offers', 'Lists', 'Messages', 'Admin', 'Errors']);

          await offers.goTo('Admin');
          await new AdminPage(page).waitForLoaded();

          const admin = new AdminPage(page);
          await admin.goTo('Errors');
          await new TestErrorsPage(page).waitForLoaded();
        },
      );
    });
  },
);
