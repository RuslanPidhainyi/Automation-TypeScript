import { Locator, Page } from '@playwright/test';
import { BasePage } from '../../BasePage';
import {
  FileUploaderWidget,
  MemberSidebarWidget,
  TabsetWidget,
  fileUploader,
  memberSidebar,
  tabset,
} from '../../widgets';

export interface ProfileData {
  description?: string;
  interests?: string;
  city?: string;
  country?: string;
}

/**
 * Route `/member/edit-profile`.
 * Guards: `authGuard`, `preventUnsavedChangesGuard`.
 *
 * A single `Edit profile` tab holding the photo editor and a template-driven
 * form. `Save changes` lives in the sidebar and stays disabled until the form
 * is dirty; leaving with unsaved changes raises a native `confirm()`.
 */
export class EditProfilePage extends BasePage {
  readonly path = 'member/edit-profile';

  // ---------------------------------------------------------------- locators
  readonly root: Locator;
  readonly heading: Locator;
  /** Warning banner rendered only while `editForm.dirty`. */
  readonly unsavedChangesWarning: Locator;
  readonly sidebar: MemberSidebarWidget;
  readonly tabs: TabsetWidget;
  readonly saveButton: Locator;

  // Photo editor.
  readonly photos: Locator;
  readonly uploader: FileUploaderWidget;

  // Profile form.
  readonly descriptionInput: Locator;
  readonly interestsInput: Locator;
  readonly cityInput: Locator;
  readonly countryInput: Locator;

  readonly uniqueElement: Locator;

  constructor(page: Page) {
    super(page);

    this.root = page.locator('app-member-edit-profile');
    this.heading = this.root.locator('.left-side-top h1');
    this.unsavedChangesWarning = this.root.locator('.right-side-top');
    this.sidebar = memberSidebar(this.root.locator('.left-side'));
    this.tabs = tabset(this.root.locator('tabset.member-tabset'));
    this.saveButton = this.sidebar.saveChangesButton;

    const photoEditor = this.root.locator('app-photo-editor');
    this.photos = photoEditor.getByTestId('photo-editor-photo');
    this.uploader = fileUploader(photoEditor);

    this.descriptionInput = this.root.locator('textarea[name="description"]');
    this.interestsInput = this.root.locator('textarea[name="interests"]');
    this.cityInput = this.root.locator('input[name="city"]');
    this.countryInput = this.root.locator('input[name="country"]');

    this.uniqueElement = this.sidebar.root;
  }

  // ----------------------------------------------------------------- widgets

  /** One already uploaded photo with its `Main` and delete actions. */
  photo(index: number): {
    root: Locator;
    image: Locator;
    mainButton: Locator;
    deleteButton: Locator;
    isMain(): Promise<boolean>;
  } {
    const root = this.photos.nth(index);
    const mainButton = root.getByTestId('photo-editor-set-main');
    return {
      root,
      mainButton,
      image: root.getByTestId('photo-editor-image'),
      deleteButton: root.getByTestId('photo-editor-delete'),
      // The main photo's button is disabled and styled `.btn-active`.
      isMain: () => mainButton.evaluate((el) => el.classList.contains('btn-active')),
    };
  }

  // ----------------------------------------------------------------- actions

  /** Fills only the keys present in `data`. */
  async fill(data: ProfileData): Promise<this> {
    if (data.description !== undefined) await this.descriptionInput.fill(data.description);
    if (data.interests !== undefined) await this.interestsInput.fill(data.interests);
    if (data.city !== undefined) await this.cityInput.fill(data.city);
    if (data.country !== undefined) await this.countryInput.fill(data.country);
    return this;
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  async update(data: ProfileData): Promise<void> {
    await this.fill(data);
    await this.save();
  }

  /**
   * Arms a handler for the native `confirm()` raised by
   * `preventUnsavedChangesGuard` ("Are you sure you want to continue? Any
   * unsaved changes will be lost"). Call it *before* triggering the navigation.
   */
  handleUnsavedChangesDialog(accept: boolean): void {
    this.page.once('dialog', (dialog) => (accept ? dialog.accept() : dialog.dismiss()));
  }

  // ----------------------------------------------------------------- queries

  isDirty(): Promise<boolean> {
    return this.unsavedChangesWarning.isVisible();
  }

  isSaveEnabled(): Promise<boolean> {
    return this.saveButton.isEnabled();
  }

  photoCount(): Promise<number> {
    return this.photos.count();
  }

  /** Index of the photo marked main, or `-1` when none is. */
  async mainPhotoIndex(): Promise<number> {
    const count = await this.photoCount();
    for (let i = 0; i < count; i++) {
      if (await this.photo(i).isMain()) return i;
    }
    return -1;
  }
}
