import { Locator, Page } from '@playwright/test';
import { BasePage } from '../../BasePage';
import { PostFormData, PostFormWidget, postForm } from '../../widgets';

/**
 * Route `/edit-offer/:id` - the same form as "Add Post", pre-filled from the
 * post being edited and submitted with `Edit post`. There is no uploader here;
 * the photo cannot be replaced from this screen.
 * Guard: `authGuard`.
 */
export class EditOfferPage extends BasePage {
  readonly path: string;

  // ---------------------------------------------------------------- locators
  readonly root: Locator;
  readonly form: PostFormWidget;
  readonly submitButton: Locator;

  readonly uniqueElement: Locator;

  constructor(
    page: Page,
    /** Post id; omit when the page is reached from a card. */
    id?: number | string
  ) {
    super(page);

    this.path = `edit-offer/${id ?? ''}`;
    this.root = page.locator('app-edit-offer');
    this.form = postForm(this.root.getByTestId('post-form'));
    this.submitButton = this.form.submitButton;

    this.uniqueElement = this.submitButton;
  }

  // ----------------------------------------------------------------- actions

  /** Applies `data` on top of the pre-filled values and saves. */
  async update(data: PostFormData): Promise<void> {
    await this.form.fill(data);
    await this.form.submit();
  }

  isSubmitEnabled(): Promise<boolean> {
    return this.submitButton.isEnabled();
  }
}
