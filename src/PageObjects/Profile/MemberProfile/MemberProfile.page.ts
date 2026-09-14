import { Locator, Page } from '@playwright/test';
import { BasePage } from '../../BasePage';
import {
  MemberSidebarWidget,
  OfferCardWidget,
  TabsetWidget,
  memberSidebar,
  offerCard,
  tabset,
} from '../../widgets';

/**
 * Route `/members/:username` - somebody else's profile.
 * Guard: `authGuard`.
 *
 * Same two halves as the own profile, but with three tabs
 * (`{knownAs}'s Posts`, `About {knownAs}`, `Messages`), `app-member-offer-card`
 * cards that carry a heart, and a presence indicator in the sidebar.
 */
export class MemberProfilePage extends BasePage {
  readonly path: string;

  // ---------------------------------------------------------------- locators
  readonly root: Locator;
  readonly sidebar: MemberSidebarWidget;
  readonly tabs: TabsetWidget;

  // Posts tab.
  readonly emptyState: Locator;
  readonly cards: Locator;

  // About tab.
  readonly gallery: Locator;
  readonly description: Locator;
  readonly interests: Locator;

  // Messages tab - `app-member-messages`.
  readonly messagePanel: Locator;
  readonly noMessages: Locator;
  readonly messageBubbles: Locator;
  readonly messageInput: Locator;
  readonly sendButton: Locator;

  readonly uniqueElement: Locator;

  constructor(
    page: Page,
    /** Username; omit when the page is reached by clicking a card. */
    username?: string
  ) {
    super(page);

    this.path = `members/${username ?? ''}`;
    this.root = page.locator('app-member-detail');
    this.sidebar = memberSidebar(this.root.locator('.left-side'));
    this.tabs = tabset(this.root.locator('tabset.member-tabset'));

    this.emptyState = this.root.locator('.no-posts-container h2');
    this.cards = this.root.getByTestId('offer-card');

    this.gallery = this.root.locator('gallery');
    this.description = this.root.locator('.about-container-row2 p').first();
    this.interests = this.root.locator('.about-container-row2 p').nth(1);

    this.messagePanel = this.root.locator('app-member-messages');
    this.noMessages = this.messagePanel.locator('.no-messages-container');
    this.messageBubbles = this.messagePanel.locator('.messages-section ul li');
    this.messageInput = this.messagePanel.locator('input[name="messageContent"]');
    this.sendButton = this.messagePanel.getByRole('button', { name: 'Send' });

    this.uniqueElement = this.sidebar.root;
  }

  // ----------------------------------------------------------------- widgets

  /** The member's post carrying `title`. */
  card(title: string): OfferCardWidget {
    return offerCard(this.cards.filter({ hasText: title }));
  }

  cardAt(index: number): OfferCardWidget {
    return offerCard(this.cards.nth(index));
  }

  /** One bubble of the conversation thread. */
  message(index: number): {
    root: Locator;
    avatar: Locator;
    text: Locator;
    sentAt: Locator;
    unreadMarker: Locator;
    readMarker: Locator;
  } {
    const root = this.messageBubbles.nth(index);
    return {
      root,
      avatar: root.locator('.message-content img'),
      text: root.locator('.message-content > p'),
      sentAt: root.locator('.message-info small span').first(),
      unreadMarker: root.getByText('(unread)'),
      // Not anchored to the start: the template renders `(read {{...}})`
      // with a leading space (" (read 5 minutes ago) "), and unlike string
      // matching, Playwright tests a RegExp against the raw text content
      // without trimming it first - `/^\(read/` never matches here.
      readMarker: root.getByText(/\(read/),
    };
  }

  /** The bubbles whose text contains `text` - e.g. the message a test just sent. */
  messageWithText(text: string): Locator {
    return this.messageBubbles.filter({ hasText: text });
  }

  // -------------------------------------------------------------------- tabs

  async openPostsTab(): Promise<void> {
    await this.tabs.open(/'s Posts$/);
  }

  async openAboutTab(): Promise<void> {
    await this.tabs.open(/^About /);
  }

  async openMessagesTab(): Promise<void> {
    await this.tabs.open('Messages');
    await this.messagePanel.waitFor({ state: 'visible' });
  }

  // ----------------------------------------------------------------- actions

  /** The sidebar button also activates the Messages tab. */
  async startConversation(): Promise<void> {
    await this.sidebar.messageButton.click();
    await this.messagePanel.waitFor({ state: 'visible' });
  }

  /**
   * Sends through the SignalR hub and waits until the hub echoes the message
   * back into the thread (`MessageHub.SendMessage` -> `NewMessage`). Leaving the
   * page any earlier destroys `member-detail.component`, whose `ngOnDestroy`
   * stops the hub connection - together with an invocation the server may not
   * have processed yet, so the message is silently never saved.
   */
  async sendMessage(text: string): Promise<void> {
    await this.messageInput.fill(text);
    await this.sendButton.click();
    await this.messageWithText(text).last().waitFor({ state: 'visible' });
  }

  // ----------------------------------------------------------------- queries

  cardCount(): Promise<number> {
    return this.cards.count();
  }

  messageTexts(): Promise<string[]> {
    return this.messageBubbles.locator('.message-content > p').allInnerTexts();
  }

  isOnline(): Promise<boolean> {
    return this.sidebar.onlineIndicator.isVisible();
  }
}
