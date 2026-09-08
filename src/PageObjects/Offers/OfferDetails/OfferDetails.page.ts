import { Locator, Page } from '@playwright/test';
import { BasePage } from '../../BasePage';

/** Optional sections of a post, each rendered only when its flag is set. */
export type OfferSection =
  | 'localTransport'
  | 'entranceFee'
  | 'placeStay'
  | 'groceryStore'
  | 'guide';

/**
 * The template has no ids and no test hooks, so the optional blocks are
 * addressed through the positional `info-row-N-left` class the component emits.
 */
const SECTION_SELECTORS: Record<OfferSection, string> = {
  localTransport: '.info-row-4-left',
  entranceFee: '.info-row-5-left',
  placeStay: '.info-row-6-left',
  groceryStore: '.info-row-7-left',
  guide: '.info-row-8-left',
};

/**
 * Route `/offers/:id` - a single post.
 * Guard: `authGuard`.
 */
export class OfferDetailsPage extends BasePage {
  readonly path: string;

  // ---------------------------------------------------------------- locators
  readonly root: Locator;

  // Header.
  readonly photo: Locator;
  /** `Country, City` badge drawn over the photo. */
  readonly locationOverlay: Locator;
  readonly owner: Locator;
  readonly ownerName: Locator;
  readonly ownerAvatar: Locator;
  readonly onlineBadge: Locator;
  readonly likeIcon: Locator;

  // Body.
  /** `Country, City` вЂ“ `Title`. */
  readonly placeInfo: Locator;
  readonly lastVisitedPlace: Locator;
  readonly description: Locator;

  readonly uniqueElement: Locator;

  constructor(
    page: Page,
    /** Post id; omit when the page is reached by clicking a card. */
    id?: number | string
  ) {
    super(page);

    this.path = `offers/${id ?? ''}`;
    this.root = page.locator('app-offer-detail .offer-container');

    this.photo = this.root.locator('.photo-container img');
    this.locationOverlay = this.root.locator('.location-overlay');
    this.owner = this.root.locator('.user-info');
    this.ownerName = this.root.locator('.user-info h4');
    this.ownerAvatar = this.root.locator('.user-info img.users-profile-image');
    this.onlineBadge = this.root.locator('.user-info .is-online');
    this.likeIcon = this.root.locator('.icon-buttons i.fa-heart');

    this.placeInfo = this.root.locator('.place-info');
    this.lastVisitedPlace = this.root.locator('.last-location-info');
    this.description = this.root.locator('.desc-info');

    this.uniqueElement = this.root;
  }

  // ----------------------------------------------------------------- widgets

  /** Container of one optional block, present only when the flag is set. */
  section(section: OfferSection): Locator {
    return this.root.locator(SECTION_SELECTORS[section]);
  }

  hasSection(section: OfferSection): Promise<boolean> {
    return this.section(section).isVisible();
  }

  /** The `Low price: вЂ¦` / `High price: вЂ¦` lines inside an optional block. */
  sectionPrices(section: OfferSection): Promise<string[]> {
    return this.section(section).locator('h6').allInnerTexts();
  }

  // ----------------------------------------------------------------- actions

  async toggleLike(): Promise<void> {
    await this.likeIcon.click();
  }

  /** The template binds `[style.color]="hasLiked() ? 'red' : 'black'"`. */
  async isLiked(): Promise<boolean> {
    const color = await this.likeIcon.evaluate((el) => getComputedStyle(el).color);
    return color === 'rgb(255, 0, 0)';
  }

  /** Navigates to `/members/{username}`. */
  async openOwnerProfile(): Promise<void> {
    await this.owner.click();
  }
}
