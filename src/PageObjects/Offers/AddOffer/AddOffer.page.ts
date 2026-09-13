import { Locator, Page } from '@playwright/test';
import { BasePage } from '../../BasePage';
import {
  FileUploaderWidget,
  PostFormData,
  PostFormWidget,
  REQUIRED_POST_FIELDS,
  RequiredPostField,
  fileUploader,
  postForm,
} from '../../widgets';

/**
 * Route `/add-offer` - "Add Post".
 * Guard: `authGuard`.
 *
 * The screen holds two forms: `add-offer-photo` with the ng2-file-upload drop
 * zone (the photo is sent together with the post, so its queue offers only
 * "Remove all"), and the reactive `post-form`.
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
    this.uploader = fileUploader(this.root.getByTestId('add-offer-photo'));
    this.form = postForm(this.root.getByTestId('post-form'));
    this.submitButton = this.form.submitButton;

    this.uniqueElement = this.submitButton;
  }

  // ----------------------------------------------------------------- actions

  /** Fills the post form and publishes it. */
  async publish(data: PostFormData): Promise<void> {
    await this.form.fill(data);
    await this.form.submit();
  }

  /**
   * Fills every required field from `data` but leaves `except` empty - for
   * checking one `Validators.required` at a time without submitting.
   */
  async fillRequired(
    data: Required<Pick<PostFormData, RequiredPostField>>,
    except?: RequiredPostField,
  ): Promise<void> {
    for (const key of REQUIRED_POST_FIELDS) {
      if (key !== except) await this.form[key].fill(data[key]);
    }
  }

  /** The submit button stays disabled while the form group is invalid. */
  isSubmitEnabled(): Promise<boolean> {
    return this.submitButton.isEnabled();
  }

  /** The drop zone has no backing `<input>` - the file must be dropped, not selected. */
  async attachPhoto(...files: string[]): Promise<void> {
    await this.uploader.dropFiles(...files);
  }
}
