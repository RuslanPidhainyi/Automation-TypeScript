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
    this.cards = this.root.getByTestId('offer-card');

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

  /**
   * The first card whose owner is not `username`, with its title - e.g. a post
   * that member is allowed to like (`LikesController.ToggleLike` refuses your
   * own post). `undefined` when every card belongs to `username`.
   */
  async firstCardNotOwnedBy(username: string): Promise<{ card: OfferCardWidget; title: string } | undefined> {
    const total = await this.cardCount();
    for (let i = 0; i < total; i++) {
      const card = this.cardAt(i);
      const owner = (await card.ownerName.innerText()).trim();
      if (owner.toLowerCase() !== username.toLowerCase()) {
        return { card, title: (await card.title.innerText()).trim() };
      }
    }
    return undefined;
  }

  /** Titles in render order - the template reverses the service array. */
  titles(): Promise<string[]> {
    return this.cards.getByTestId('offer-card-title').allInnerTexts();
  }

  isEmpty(): Promise<boolean> {
    return this.emptyState.isVisible();
  }
}
