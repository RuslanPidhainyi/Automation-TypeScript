import { Locator, Page } from '@playwright/test';
import { BasePage } from '../../BasePage';

/**
 * Route `/not-found`, also the wildcard target for unknown routes.
 *
 * The "return to home page" button points at `/offers` for a signed-in user and
 * at `/` otherwise.
 */
export class NotFoundPage extends BasePage {
  readonly path = 'not-found';

  // ---------------------------------------------------------------- locators
  readonly root: Locator;
  /** `Sorry, this page isn't available.` */
  readonly heading: Locator;
  /** `The link you followed may be broken.` */
  readonly subheading: Locator;
  readonly homeButton: Locator;

  readonly uniqueElement: Locator;

  constructor(page: Page) {
    super(page);

    this.root = page.locator('app-not-found');
    this.heading = this.root.locator('h1');
    this.subheading = this.root.locator('h2');
    this.homeButton = this.root.locator('button');

    this.uniqueElement = this.heading;
  }

  // ----------------------------------------------------------------- actions

  async goHome(): Promise<void> {
    await this.homeButton.click();
  }
}
