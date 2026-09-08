import { Locator, Page } from '@playwright/test';
import { BasePage } from '../../BasePage';
import {
  FileUploaderWidget,
  PostFormData,
  PostFormWidget,
  fileUploader,
  postForm,
} from '../../widgets';

/**
 * Route `/add-offer` - "Add Post".
 * Guard: `authGuard`.
 *
 * The screen holds two forms: `form.container-photo` with the ng2-file-upload
 * drop zone (the photo is sent together with the post, so its queue offers only
 * "Remove all"), and the reactive post form. The latter is identified by the
 * submit button it owns rather than by position.
 */
export class AddOfferPage extends BasePage {
  readonly path = 'add-offer';

  // ---------------------------------------------------------------- locators
  readonly root: Locator;
  readonly heading: Locator;
  readonly uploader: FileUploaderWidget;
  readonly form: PostFormWidget;
  readonly submitButton: Locator;

  readonly uniqueElement: Locator;

  constructor(page: Page) {
    super(page);

    this.root = page.locator('app-add-offer');
    this.heading = this.root.locator('h3').first();
    this.uploader = fileUploader(this.root.locator('form.container-photo'));
    this.form = postForm(
      this.root.locator('form').filter({ has: page.locator('button.add-post-btn') }),
      'add'
    );
    this.submitButton = this.form.submitButton;

    this.uniqueElement = this.submitButton;
  }

  // ----------------------------------------------------------------- actions

  /** Fills the post form and publishes it. */
  async publish(data: PostFormData): Promise<void> {
    await this.form.fill(data);
    await this.form.submit();
  }

  /** The submit button stays disabled while the form group is invalid. */
  isSubmitEnabled(): Promise<boolean> {
    return this.submitButton.isEnabled();
  }

  async attachPhoto(...files: string[]): Promise<void> {
    await this.uploader.selectFiles(...files);
  }
}
