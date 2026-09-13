import { Locator, Page } from '@playwright/test';
import { BasePage } from '../../BasePage';
import { FieldWidget, fieldByPlaceholder } from '../../widgets';

export interface RegisterData {
  gender: 'male' | 'female';
  username: string;
  knownAs: string;
  /** Format accepted by the ngx-bootstrap datepicker, e.g. `01.01.2000`. */
  dateOfBirth: string;
  city: string;
  country: string;
  password: string;
  /** Defaults to `password` when omitted. */
  confirmPassword?: string;
}

/**
 * Text fields `register.component.ts` marks `Validators.required`, apart from
 * the two password fields (which carry validators of their own), in render order.
 */
export const REQUIRED_REGISTER_FIELDS = ['username', 'knownAs', 'dateOfBirth', 'city', 'country'] as const;

export type RequiredRegisterField = (typeof REQUIRED_REGISTER_FIELDS)[number];

/**
 * Registration - `app-register`, rendered inside the login page once the
 * "Register" button is pressed. It has no route of its own, so `open()` loads
 * `/` and performs that click.
 *
 * All text controls come from the shared `app-text-input` wrapper, which puts
 * `[label]` into `placeholder`; that placeholder is the only thing that tells
 * them apart in the DOM.
 */
export class RegistrationPage extends BasePage {
  readonly path = '';

  // ---------------------------------------------------------------- locators
  readonly root: Locator;
  readonly heading: Locator;

  readonly genderMaleRadio: Locator;
  readonly genderFemaleRadio: Locator;

  readonly username: FieldWidget;
  readonly knownAs: FieldWidget;
  readonly dateOfBirth: FieldWidget;
  readonly city: FieldWidget;
  readonly country: FieldWidget;
  readonly password: FieldWidget;
  readonly confirmPassword: FieldWidget;

  /** `.register-errors-container` - API validation errors, one `<li>` each. */
  readonly serverErrors: Locator;
  readonly registerButton: Locator;
  readonly cancelButton: Locator;

  /**
   * ngx-bootstrap's `bsDatepicker` popup for `dateOfBirth`. It is appended to
   * `document.body` rather than into this form, hence a page-level locator
   * instead of one scoped to `root`.
   */
  readonly dateOfBirthCalendar: Locator;

  readonly uniqueElement: Locator;

  constructor(page: Page) {
    super(page);

    this.root = page.locator('form.register-form');
    this.heading = this.root.locator('h2');

    this.genderMaleRadio = this.root.locator('input[type="radio"][value="male"]');
    this.genderFemaleRadio = this.root.locator('input[type="radio"][value="female"]');

    this.username = fieldByPlaceholder(this.root, 'Username');
    this.knownAs = fieldByPlaceholder(this.root, 'Known As');
    this.dateOfBirth = fieldByPlaceholder(this.root, 'Date of birth');
    this.city = fieldByPlaceholder(this.root, 'City');
    this.country = fieldByPlaceholder(this.root, 'Country');
    this.password = fieldByPlaceholder(this.root, 'Password');
    this.confirmPassword = fieldByPlaceholder(this.root, 'Confirm Password');

    this.serverErrors = this.root.locator('.register-errors-container li');
    this.registerButton = this.root.locator('button.register-btn');
    this.cancelButton = this.root.locator('button.cancel-btn');

    this.dateOfBirthCalendar = page.locator('bs-datepicker-container');

    this.uniqueElement = this.root;
  }

  /** Loads `/` and switches the login component into registration mode. */
  override async open(): Promise<this> {
    await this.page.goto(this.url);
    await this.page.locator('app-login button.register-btn').click();
    return this.waitForLoaded();
  }

  // ----------------------------------------------------------------- widgets

  genderRadio(gender: 'male' | 'female'): Locator {
    return gender === 'male' ? this.genderMaleRadio : this.genderFemaleRadio;
  }

  /** Every control, in render order - e.g. to assert the tab order. */
  get fields(): FieldWidget[] {
    return [
      this.username,
      this.knownAs,
      this.dateOfBirth,
      this.city,
      this.country,
      this.password,
      this.confirmPassword,
    ];
  }

  // ----------------------------------------------------------------- actions

  async fill(data: RegisterData): Promise<this> {
    await this.genderRadio(data.gender).check();
    await this.username.fill(data.username);
    await this.knownAs.fill(data.knownAs);
    await this.dateOfBirth.fill(data.dateOfBirth);
    // The datepicker popup overlays the fields below until it is dismissed.
    await this.page.keyboard.press('Escape');
    await this.city.fill(data.city);
    await this.country.fill(data.country);
    await this.password.fill(data.password);
    await this.confirmPassword.fill(data.confirmPassword ?? data.password);
    return this;
  }

  /**
   * Fills the form from `data` but leaves `omitted` empty - for checking one
   * required validator at a time. Unlike `fill()`, the datepicker popup is not
   * dismissed after the date of birth.
   */
  async fillAllExcept(data: RegisterData, omitted: RequiredRegisterField): Promise<this> {
    await this.genderRadio(data.gender).check();
    for (const name of REQUIRED_REGISTER_FIELDS) {
      if (name !== omitted) await this[name].fill(data[name]);
    }
    await this.password.fill(data.password);
    await this.confirmPassword.fill(data.confirmPassword ?? data.password);
    return this;
  }

  async submit(): Promise<void> {
    await this.registerButton.click();
  }

  async register(data: RegisterData): Promise<void> {
    await this.fill(data);
    await this.submit();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  /** The submit button stays disabled while the form group is invalid. */
  isSubmitEnabled(): Promise<boolean> {
    return this.registerButton.isEnabled();
  }

  serverErrorTexts(): Promise<string[]> {
    return this.serverErrors.allInnerTexts();
  }

  // ------------------------------------------------------------- date picker

  /** Opens the `dateOfBirth` calendar popup. */
  async openDateOfBirthCalendar(): Promise<void> {
    await this.dateOfBirth.control.click();
    await this.dateOfBirthCalendar.waitFor({ state: 'visible' });
  }

  /**
   * Clicks a day cell (by its number) in the currently displayed month of the
   * `dateOfBirth` calendar. A disabled day (outside `[minDate, maxDate]`)
   * ignores the click, so this is also how a disabled day is asserted - via
   * the input staying unchanged rather than a CSS class.
   */
  async clickCalendarDay(day: number): Promise<void> {
    await this.dateOfBirthCalendar.getByText(`${day}`, { exact: true }).first().click();
  }
}
