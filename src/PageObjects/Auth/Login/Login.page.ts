import { Locator, Page } from '@playwright/test';
import { BasePage } from '../../BasePage';
import { LoginFormWidget, loginForm } from '../../widgets';

/**
 * Route `/` - the landing page for anonymous visitors.
 * Guard: `redirectAuthenticatedGuard` sends a signed-in user to `/offers`.
 *
 * The component has two mutually exclusive modes driven by `registerMode`; only
 * one of them exists in the DOM at a time. This page object describes the login
 * mode - the registration form has its own page object, `RegistrationPage`.
 *
 * Careful: the navigation bar renders its own `form.login-form` for signed-out
 * visitors, so a page-wide `input[name="username"]` is ambiguous here. Use
 * `this.form` for the card and the `nav*` locators from `BasePage` for the bar.
 */
export class LoginPage extends BasePage {
  readonly path = '';

  // ---------------------------------------------------------------- locators
  readonly root: Locator;
  readonly card: Locator;

  // Left half - the marketing panel.
  readonly greeting: Locator;
  readonly benefits: Locator;
  readonly registerToggleButton: Locator;

  // Right half - the login card.
  readonly heading: Locator;
  readonly form: LoginFormWidget;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly togglePasswordButton: Locator;
  readonly loginButton: Locator;

  readonly uniqueElement: Locator;

  constructor(page: Page) {
    super(page);

    this.root = page.locator('app-login');
    this.card = this.root.locator('.login-page .common-card');

    this.greeting = this.card.locator('.greeting-img');
    this.benefits = this.card.locator('.list li');
    this.registerToggleButton = this.card.locator('button.register-btn');

    this.heading = this.card.locator('.right-side h1');
    this.form = loginForm(this.card.locator('.right-side form.login-form'));
    this.usernameInput = this.form.usernameInput;
    this.passwordInput = this.form.passwordInput;
    this.togglePasswordButton = this.form.togglePasswordButton;
    this.loginButton = this.form.submitButton;

    this.uniqueElement = this.heading;
  }

  // ----------------------------------------------------------------- widgets

  /** One of the three bullet points under "What can you do on EW?". */
  benefit(index: number): Locator {
    return this.benefits.nth(index);
  }

  // ----------------------------------------------------------------- actions

  async login(username: string, password: string): Promise<void> {
    await this.form.login(username, password);
  }

  /** Switches the component into registration mode. */
  async openRegistration(): Promise<void> {
    await this.registerToggleButton.click();
    await this.page.locator('form.register-form').waitFor({ state: 'visible' });
  }

  async togglePasswordVisibility(): Promise<void> {
    await this.togglePasswordButton.click();
  }

  /** `password` while masked, `text` once the eye button has been pressed. */
  passwordInputType(): Promise<string | null> {
    return this.passwordInput.getAttribute('type');
  }
}
