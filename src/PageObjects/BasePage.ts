import { Locator, Page, Response } from '@playwright/test';

/**
 * Address of the application under test.
 *
 * The Angular dev server runs over HTTPS with a self-signed certificate
 * (Client/angular.json -> architect.serve.options.ssl), so `ignoreHTTPSErrors`
 * must be enabled in playwright.config.ts.
 *
 *   BASE_URL=https://staging.ew-travel.app npx playwright test
 */
export const DEFAULT_BASE_URL = 'https://localhost:4200';

export function baseUrl(): string {
  return (process.env.BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
}

/** Builds an absolute URL from an application route, e.g. `offers/12`. */
export function appUrl(path: string): string {
  const route = path.replace(/^\/+/, '');
  return route ? `${baseUrl()}/${route}` : `${baseUrl()}/`;
}

/** Primary navigation entries; `Admin` and `Errors` are role-gated. */
export type NavLink = 'Offers' | 'Lists' | 'Messages' | 'Admin' | 'Errors';

/** Entries of the avatar dropdown. */
export type NavMenuItem = 'Profile' | 'Share post' | 'Settings' | 'Logout';

/**
 * Base of every page object.
 *
 * A concrete page declares only two things - the route it lives on (`path`) and
 * the element that proves it finished rendering (`uniqueElement`); navigation,
 * waiting and the chrome that Angular draws around the router outlet (the
 * navigation bar, the ngx-spinner overlay and the ngx-toastr container) are
 * implemented here once, because they are identical on all screens.
 */
export abstract class BasePage {
  protected readonly page: Page;

  /** Route without a leading slash, e.g. `offers` or `offers/12`. */
  abstract readonly path: string;

  /** Element whose visibility means "this page is on screen". */
  abstract readonly uniqueElement: Locator;

  // ---------------------------------------------------------------- locators
  // Navigation bar - present on every screen.
  readonly navBar: Locator;
  readonly navBrand: Locator;
  readonly navLinks: Locator;
  readonly navAvatar: Locator;
  readonly navUserMenuToggle: Locator;
  readonly navUserMenu: Locator;

  // Quick login form inside the bar (visible only when signed out).
  readonly navUsernameInput: Locator;
  readonly navPasswordInput: Locator;
  readonly navLoginButton: Locator;

  // Global overlays.
  readonly spinner: Locator;
  readonly toastContainer: Locator;
  /** Every toast currently on screen, whatever its severity. */
  readonly toasts: Locator;
  readonly successToast: Locator;
  readonly errorToast: Locator;
  readonly infoToast: Locator;
  readonly toastMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    this.navBar = page.getByTestId('nav');
    this.navBrand = this.navBar.getByTestId('nav-brand');
    this.navLinks = this.navBar.getByTestId('nav-link');
    this.navAvatar = this.navBar.getByTestId('nav-avatar');
    this.navUserMenuToggle = this.navBar.getByTestId('nav-user-menu-toggle');
    this.navUserMenu = this.navBar.getByTestId('nav-user-menu');

    const navForm = this.navBar.getByTestId('nav-login-form');
    this.navUsernameInput = navForm.getByTestId('nav-login-username');
    this.navPasswordInput = navForm.getByTestId('nav-login-password');
    this.navLoginButton = navForm.getByTestId('nav-login-submit');

    this.spinner = page.locator('ngx-spinner .la-ball-clip-rotate');
    this.toastContainer = page.locator('#toast-container');
    this.toasts = this.toastContainer.locator('.ngx-toastr');
    this.successToast = this.toastContainer.locator('.toast-success');
    this.errorToast = this.toastContainer.locator('.toast-error');
    this.infoToast = this.toastContainer.locator('.toast-info');
    this.toastMessage = this.toastContainer.locator('.toast-message');
  }

  // -------------------------------------------------------------- navigation

  get url(): string {
    return appUrl(this.path);
  }

  /** Opens the route and waits until the page is rendered. */
  async open(): Promise<this> {
    await this.page.goto(this.url);
    return this.waitForLoaded();
  }

  /** Navigates without waiting - for negative cases such as guard redirects. */
  navigate(): Promise<Response | null> {
    return this.page.goto(this.url);
  }

  async waitForLoaded(timeout?: number): Promise<this> {
    await this.uniqueElement.waitFor({ state: 'visible', timeout });
    return this;
  }

  async reload(): Promise<this> {
    await this.page.reload();
    return this.waitForLoaded();
  }

  isOpen(): Promise<boolean> {
    return this.uniqueElement.isVisible();
  }

  currentUrl(): string {
    return this.page.url();
  }

  async waitForSpinnerToDisappear(timeout?: number): Promise<this> {
    await this.spinner.waitFor({ state: 'hidden', timeout }).catch(() => undefined);
    return this;
  }

  // ----------------------------------------------------- navigation bar
  // Widgets of the bar. `Admin` is rendered for Admin/Moderator only and
  // `Errors` for Admin only, so assert on visibleNavLinks() before using them.

  navLink(name: NavLink): Locator {
    return this.navBar.getByRole('link', { name, exact: true });
  }

  navMenuItem(name: NavMenuItem): Locator {
    return this.navUserMenu.getByText(name, { exact: true });
  }

  async goTo(name: NavLink): Promise<void> {
    await this.navLink(name).click();
  }

  async openUserMenu(): Promise<this> {
    if (!(await this.navUserMenu.isVisible())) {
      await this.navUserMenuToggle.click();
      await this.navUserMenu.waitFor({ state: 'visible' });
    }
    return this;
  }

  async selectUserMenuItem(name: NavMenuItem): Promise<void> {
    await this.openUserMenu();
    await this.navMenuItem(name).click();
  }

  async logout(): Promise<void> {
    await this.selectUserMenuItem('Logout');
  }

  /** Signs in through the bar; available on any page while signed out. */
  async signInFromNavBar(username: string, password: string): Promise<void> {
    await this.navUsernameInput.fill(username);
    await this.navPasswordInput.fill(password);
    await this.navLoginButton.click();
  }

  isSignedIn(): Promise<boolean> {
    return this.navUserMenuToggle.isVisible();
  }

  /** Username as displayed, i.e. title-cased by the `titlecase` pipe. */
  async displayedUsername(): Promise<string> {
    const text = await this.navUserMenuToggle.innerText();
    return text.trim().replace(/^Welcome\s+/, '');
  }

  visibleNavLinks(): Promise<string[]> {
    return this.navLinks.allInnerTexts();
  }

  // ------------------------------------------------------------------ toasts
  // Messages produced by the client (the ones the specs assert on are named in
  // `TOAST`, src/constants/messages.ts):
  //   success - `User {Name} logged in successfully`, `User {Name} registered successfully`,
  //             `User is logged out!`, `Profile updated successfully`,
  //             `Post added successfully`, `Post updated successfully`, `Post deleted successfully`
  //   error   - `Failed to login`, `Failed to register`, `Failed to load post`,
  //             `Failed to added post`, `Failed to updated post`, `Failed to deleted post`,
  //             `You cannot enter this area`, `Unauthorised`, `Something unexpected went wrong`

  /** Any toast carrying `text`, regardless of severity. */
  toast(text: string | RegExp): Locator {
    return this.toasts.filter({ hasText: text });
  }

  /** Clicking a toast dismisses it - useful when it covers the element under test. */
  async dismissToasts(): Promise<void> {
    for (const toast of await this.toasts.all()) {
      await toast.click().catch(() => undefined);
    }
  }
}
