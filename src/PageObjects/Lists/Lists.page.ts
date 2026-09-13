import { Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';
import { OfferCardWidget, offerCard } from '../widgets';

/**
 * Route `/lists` - the posts the signed-in user has liked.
 * Guard: `authGuard`.
 *
 * The grid is the same markup as `/offers` (heading, empty state and
 * `app-offer-card`s); only the copy differs - heading `Posts you like`, empty
 * state `You have not liked any posts yet`. The card internals live in the
 * shared `offerCard` widget, so only the three container locators are restated
 * here, which keeps this file readable on its own.
 */
export class ListsPage extends BasePage {
  readonly path = 'lists';

  // ---------------------------------------------------------------- locators
  readonly root: Locator;
  readonly heading: Locator;
  readonly emptyState: Locator;
  readonly cards: Locator;

  readonly uniqueElement: Locator;

  constructor(page: Page) {
    super(page);

    this.root = page.locator('app-lists');
    this.heading = this.root.locator('.title-section h1');
    this.emptyState = this.root.locator('.no-posts-container h3');
    this.cards = this.root.getByTestId('offer-card');

    this.uniqueElement = this.heading;
  }

  // ----------------------------------------------------------------- widgets

  card(title: string): OfferCardWidget {
    return offerCard(this.cards.filter({ hasText: title }));
  }

  cardAt(index: number): OfferCardWidget {
    return offerCard(this.cards.nth(index));
  }

  // ----------------------------------------------------------------- queries

  cardCount(): Promise<number> {
    return this.cards.count();
  }

  titles(): Promise<string[]> {
    return this.cards.getByTestId('offer-card-title').allInnerTexts();
  }

  isEmpty(): Promise<boolean> {
    return this.emptyState.isVisible();
  }
}
