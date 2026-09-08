import { Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';

/** The three ngx-bootstrap radio buttons above the table. */
export type MessageContainer = 'Unread' | 'Inbox' | 'Outbox';

/**
 * Route `/messages` - the message table with an Unread / Inbox / Outbox filter.
 * Guard: `authGuard`.
 *
 * Rows are `routerLink`s to `/members/{username}?tab=Messages`; the Delete
 * button stops the click from bubbling, so deleting does not navigate.
 */
export class MessagesPage extends BasePage {
  readonly path = 'messages';

  // ---------------------------------------------------------------- locators
  readonly root: Locator;
  readonly containerButtons: Locator;
  readonly emptyState: Locator;
  readonly table: Locator;
  readonly headers: Locator;
  readonly rows: Locator;

  readonly uniqueElement: Locator;

  constructor(page: Page) {
    super(page);

    this.root = page.locator('app-messages');
    this.containerButtons = this.root.locator('.buttons-container');
    this.emptyState = this.root.locator('.no-messages-container h3');
    this.table = this.root.locator('.users-messages-container table');
    this.headers = this.table.locator('thead th');
    this.rows = this.table.locator('tbody tr.message-row');

    this.uniqueElement = this.containerButtons;
  }

  // ----------------------------------------------------------------- widgets

  containerButton(container: MessageContainer): Locator {
    return this.containerButtons.getByRole('button', { name: container, exact: true });
  }

  /** One row of the table, addressed by position. */
  rowAt(index: number): MessageRow {
    return this.describeRow(this.rows.nth(index));
  }

  /** The row whose message column contains `text`. */
  row(text: string): MessageRow {
    return this.describeRow(
      this.rows.filter({ has: this.page.locator('.table-messages', { hasText: text }) })
    );
  }

  /** All rows exchanged with `username`. */
  rowsWith(username: string): Locator {
    return this.rows.filter({
      has: this.page.locator('.table-from-to strong', {
        hasText: new RegExp(`^${username}$`, 'i'),
      }),
    });
  }

  // ----------------------------------------------------------------- actions

  async selectContainer(container: MessageContainer): Promise<void> {
    await this.containerButton(container).click();
  }

  // ----------------------------------------------------------------- queries

  /** ngx-bootstrap marks the selected radio button with `.active`. */
  async activeContainer(): Promise<string | null> {
    const active = this.containerButtons.locator('button.active');
    return (await active.count()) ? (await active.innerText()).trim() : null;
  }

  rowCount(): Promise<number> {
    return this.rows.count();
  }

  messageTexts(): Promise<string[]> {
    return this.rows.locator('.table-messages').allInnerTexts();
  }

  isEmpty(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  private describeRow(root: Locator): MessageRow {
    return {
      root,
      content: root.locator('.table-messages'),
      counterpart: root.locator('.table-from-to strong'),
      counterpartAvatar: root.locator('.table-from-to img'),
      sentAt: root.locator('.table-sent'),
      deleteButton: root.locator('button.btn-delete'),
      open: () => root.locator('.table-messages').click(),
      delete: () => root.locator('button.btn-delete').click(),
    };
  }
}

/** One row of the message table. */
export interface MessageRow {
  root: Locator;
  content: Locator;
  /** Sender in Unread/Inbox, recipient in Outbox. */
  counterpart: Locator;
  counterpartAvatar: Locator;
  /** Relative timestamp rendered by the `timeago` pipe. */
  sentAt: Locator;
  deleteButton: Locator;
  /** Navigates to the counterpart's profile. */
  open(): Promise<void>;
  delete(): Promise<void>;
}
