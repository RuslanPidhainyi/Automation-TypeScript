import { Locator, Page } from '@playwright/test';
import { BasePage } from '../../BasePage';

/**
 * Route `/server-error` - reached through `error.interceptor`, which passes the
 * exception via router state. Opening the route directly renders the heading
 * only, because there is no error object to display.
 */
export class ServerErrorPage extends BasePage {
  readonly path = 'server-error';

  // ---------------------------------------------------------------- locators
  readonly root: Locator;
  /** `Internal Server Error` */
  readonly heading: Locator;
  /** `Error: {message}` - present only when the interceptor supplied one. */
  readonly message: Locator;
  /** Stack trace rendered in the `<code>` block. */
  readonly stackTrace: Locator;

  readonly uniqueElement: Locator;

  constructor(page: Page) {
    super(page);

    this.root = page.locator('app-server-error');
    this.heading = this.root.locator('h1');
    this.message = this.root.locator('h2.text-danger');
    this.stackTrace = this.root.locator('code');

    this.uniqueElement = this.heading;
  }

  // ----------------------------------------------------------------- queries

  hasDetails(): Promise<boolean> {
    return this.message.isVisible();
  }
}
