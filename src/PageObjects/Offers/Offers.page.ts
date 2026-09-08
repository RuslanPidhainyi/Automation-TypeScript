import { Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';
import { OfferCardWidget, offerCard } from '../widgets';

/**
 * Route `/offers` - the grid of every published post, newest first.
 * Guard: `authGuard`.
 *
 * Heading `Posts`, empty state `No posts yet`. The cards are
 * `app-offer-card`, the only flavour that shows the post owner.
 */
export class OffersPage extends BasePage {
  readonly path = 'offers';

  // ---------------------------------------------------------------- locators
  readonly root: Locator;
  readonly heading: Locator;
  readonly emptyState: Locator;
  readonly cards: Locator;

  readonly uniqueElement: Locator;

  constructor(page: Page) {
    super(page);

    this.root = page.locator('app-offers-list');
    this.heading = this.root.locator('.title-section h1');
    this.emptyState = this.root.locator('.no-posts-container h3');
    this.cards = this.root.locator('.offers-container .single-offer app-offer-card');

    this.uniqueElement = this.heading;
  }

  // ----------------------------------------------------------------- widgets

  /** The card carrying `title`. */
  card(title: string): OfferCardWidget {
    return offerCard(this.cards.filter({ hasText: title }));
  }

  /** The card at position `index` in the grid. */
  cardAt(index: number): OfferCardWidget {
    return offerCard(this.cards.nth(index));
  }

  firstCard(): OfferCardWidget {
    return this.cardAt(0);
  }

  // ----------------------------------------------------------------- queries

  cardCount(): Promise<number> {
    return this.cards.count();
  }

  /** Titles in render order - the template reverses the service array. */
  titles(): Promise<string[]> {
    return this.cards.locator('.info h6').allInnerTexts();
  }

  isEmpty(): Promise<boolean> {
    return this.emptyState.isVisible();
  }
}
