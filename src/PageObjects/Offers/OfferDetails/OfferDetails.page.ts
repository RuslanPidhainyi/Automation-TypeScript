import { Locator, Page } from '@playwright/test';
import { BasePage } from '../../BasePage';
import { LIKE_COLOR } from '../../widgets';

/** Optional sections of a post, each rendered only when its flag is set. */
export type OfferSection =
  | 'localTransport'
  | 'entranceFee'
  | 'placeStay'
  | 'groceryStore'
  | 'guide';

/** The test id of each optional block in `offer-detail.component.html`. */
const SECTION_TEST_IDS: Record<OfferSection, string> = {
  localTransport: 'offer-detail-local-transport',
  entranceFee: 'offer-detail-entrance-fee',
  placeStay: 'offer-detail-place-stay',
  groceryStore: 'offer-detail-grocery-store',
  guide: 'offer-detail-guide',
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
  /** `Country, City` – `Title`. */
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
    this.root = page.getByTestId('offer-detail');

    this.photo = this.root.getByTestId('offer-detail-photo');
    this.locationOverlay = this.root.getByTestId('offer-detail-location');
    this.owner = this.root.getByTestId('offer-detail-owner');
    this.ownerName = this.root.getByTestId('offer-detail-owner-name');
    this.ownerAvatar = this.root.getByTestId('offer-detail-owner-avatar');
    // A state rather than an element: the template toggles the class on the avatar's wrapper.
    this.onlineBadge = this.owner.locator('.is-online');
    this.likeIcon = this.root.getByTestId('offer-detail-like');

    this.placeInfo = this.root.getByTestId('offer-detail-place');
    this.lastVisitedPlace = this.root.getByTestId('offer-detail-last-visited');
    this.description = this.root.getByTestId('offer-detail-description');

    this.uniqueElement = this.root;
  }

  // ----------------------------------------------------------------- widgets

  /** Container of one optional block, present only when the flag is set. */
  section(section: OfferSection): Locator {
    return this.root.getByTestId(SECTION_TEST_IDS[section]);
  }

  hasSection(section: OfferSection): Promise<boolean> {
    return this.section(section).isVisible();
  }

  /** The `Low price: …` / `High price: …` lines inside an optional block. */
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
    return color === LIKE_COLOR.liked;
  }

  /** Navigates to `/members/{username}`. */
  async openOwnerProfile(): Promise<void> {
    await this.owner.click();
  }
}
