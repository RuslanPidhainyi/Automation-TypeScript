import { Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';
import {
  MemberSidebarWidget,
  OfferCardWidget,
  TabsetWidget,
  memberSidebar,
  offerCard,
  tabset,
} from '../widgets';

/**
 * Route `/member/profile` - the signed-in user's own profile.
 * Guard: `authGuard`.
 *
 * Layout: a `.left-side` summary panel and a `.right-side` tabset with
 * `{knownAs}'s Posts` and `About {knownAs}`. The cards are
 * `app-member-profile-offer-card`, i.e. they carry edit and delete icons
 * instead of a heart.
 */
export class ProfilePage extends BasePage {
  readonly path = 'member/profile';

  // ---------------------------------------------------------------- locators
  readonly root: Locator;
  readonly sidebar: MemberSidebarWidget;
  readonly tabs: TabsetWidget;

  // Posts tab.
  readonly addPostPrompt: Locator;
  readonly addPostButton: Locator;
  readonly emptyState: Locator;
  readonly cards: Locator;

  // About tab.
  readonly gallery: Locator;
  readonly description: Locator;
  readonly interests: Locator;

  readonly uniqueElement: Locator;

  constructor(page: Page) {
    super(page);

    this.root = page.locator('app-member-profile');
    this.sidebar = memberSidebar(this.root.locator('.left-side'));
    this.tabs = tabset(this.root.locator('tabset.member-tabset'));

    this.addPostPrompt = this.root.locator('.add-post-container');
    this.addPostButton = this.root.locator('button.add-post-button');
    this.emptyState = this.root.locator('.no-posts-container h3');
    this.cards = this.root.locator(
      '.posts-container .single-offer app-member-profile-offer-card'
    );

    this.gallery = this.root.locator('gallery');
    this.description = this.root.locator('.about-container-row2 p').first();
    this.interests = this.root.locator('.about-container-row2 p').nth(1);

    this.uniqueElement = this.sidebar.root;
  }

  // ----------------------------------------------------------------- widgets

  /** The own post carrying `title`, with its edit and delete icons. */
  card(title: string): OfferCardWidget {
    return offerCard(this.cards.filter({ hasText: title }));
  }

  cardAt(index: number): OfferCardWidget {
    return offerCard(this.cards.nth(index));
  }

  // -------------------------------------------------------------------- tabs
  // Headings are interpolated with `knownAs`, hence the loose matching.

  async openPostsTab(): Promise<void> {
    await this.tabs.open(/'s Posts$/);
  }

  async openAboutTab(): Promise<void> {
    await this.tabs.open(/^About /);
  }

  // ----------------------------------------------------------------- actions

  /** `+` button of the "Want to share your journey?" block. */
  async openAddPost(): Promise<void> {
    await this.addPostButton.click();
  }

  async openEditProfile(): Promise<void> {
    await this.sidebar.editProfileButton.click();
  }

  // ----------------------------------------------------------------- queries

  cardCount(): Promise<number> {
    return this.cards.count();
  }

  titles(): Promise<string[]> {
    return this.cards.locator('.info h6').allInnerTexts();
  }

  hasNoPosts(): Promise<boolean> {
    return this.emptyState.isVisible();
  }
}
