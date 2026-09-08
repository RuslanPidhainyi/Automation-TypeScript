import { Locator, Page } from '@playwright/test';
import { BasePage } from '../../BasePage';

export type ErrorStatus = 400 | 401 | 404 | 500;

/**
 * Route `/errors` - the buttons that make the API return a specific status so
 * `error.interceptor` can be exercised.
 * Guard: `adminGuard` (a non-admin is bounced with the toast
 * `You cannot enter this area`).
 */
export class TestErrorsPage extends BasePage {
  readonly path = 'errors';

  // ---------------------------------------------------------------- locators
  readonly root: Locator;
  readonly buttons: Locator;
  readonly validationErrorButton: Locator;
  /** `.errors-container` - the list returned by the validation endpoint. */
  readonly validationErrors: Locator;

  readonly uniqueElement: Locator;

  constructor(page: Page) {
    super(page);

    this.root = page.locator('app-test-errors');
    this.buttons = this.root.locator('button.btn-test-error');
    this.validationErrorButton = this.buttons.filter({ hasText: 'Test 400 validation error' });
    this.validationErrors = this.root.locator('.errors-container li');

    this.uniqueElement = this.buttons.first();
  }

  // ----------------------------------------------------------------- widgets

  /** `Test {status} error`; the 400 button is distinct from the validation one. */
  button(status: ErrorStatus): Locator {
    return this.buttons.filter({ hasText: `Test ${status} error` });
  }

  // ----------------------------------------------------------------- actions

  async trigger(status: ErrorStatus): Promise<void> {
    await this.button(status).click();
  }

  async triggerValidationError(): Promise<void> {
    await this.validationErrorButton.click();
  }

  // ----------------------------------------------------------------- queries

  validationErrorTexts(): Promise<string[]> {
    return this.validationErrors.allInnerTexts();
  }
}
