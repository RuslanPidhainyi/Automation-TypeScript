import { Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';
import { TabsetWidget, tabset } from '../widgets';

export type UserRole = 'Admin' | 'Moderator' | 'Member';

/**
 * Route `/admin` - the admin panel.
 * Guard: `adminGuard`.
 *
 * Two tabs, each gated by `*appHasRole`: `User management` for Admin only and
 * `Post management` for Admin or Moderator, so a Moderator sees a single tab -
 * assert on `tabs.headings()` rather than assuming both exist.
 *
 * The roles dialog is opened through `BsModalService` and appended to the
 * document body, not to this screen's subtree, hence it is anchored on
 * `bs-modal-container`.
 */
export class AdminPage extends BasePage {
  readonly path = 'admin';

  // ---------------------------------------------------------------- locators
  readonly root: Locator;
  readonly heading: Locator;
  readonly tabs: TabsetWidget;

  // User management tab.
  readonly userTable: Locator;
  readonly userTableHeaders: Locator;
  readonly userRows: Locator;

  // Post management tab (a placeholder in the application).
  readonly postManagement: Locator;

  // Roles dialog.
  readonly rolesModal: Locator;
  readonly rolesModalTitle: Locator;
  readonly rolesModalClose: Locator;
  readonly rolesModalRows: Locator;
  readonly rolesModalSubmit: Locator;

  readonly uniqueElement: Locator;

  constructor(page: Page) {
    super(page);

    this.root = page.locator('app-admin-panel');
    this.heading = this.root.locator('h2');
    this.tabs = tabset(this.root.locator('tabset.member-tabset'));

    const userManagement = this.root.locator('app-user-management');
    this.userTable = userManagement.locator('table');
    this.userTableHeaders = this.userTable.locator('thead th');
    this.userRows = this.userTable.locator('tbody tr.single-row');

    this.postManagement = this.root.locator('app-post-management');

    this.rolesModal = page.locator('bs-modal-container .modal-content');
    this.rolesModalTitle = this.rolesModal.locator('.modal-title');
    this.rolesModalClose = this.rolesModal.locator('.modal-header .btn-close');
    this.rolesModalRows = this.rolesModal.locator('.modal-body .form-check');
    this.rolesModalSubmit = this.rolesModal.getByRole('button', { name: 'Submit' });

    this.uniqueElement = this.heading;
  }

  // ----------------------------------------------------------------- widgets

  /**
   * One row of the user table. Matching happens on the username cell and
   * case-insensitively, because the template pipes the name through `titlecase`.
   */
  userRow(username: string): {
    root: Locator;
    username: Locator;
    roles: Locator;
    editRolesButton: Locator;
    roleNames(): Promise<string[]>;
  } {
    const root = this.userRows.filter({
      has: this.page.locator('td', { hasText: new RegExp(`^${escapeRegExp(username)}$`, 'i') }),
    });
    const roles = root.locator('td').nth(1);

    return {
      root,
      roles,
      username: root.locator('td').nth(0),
      editRolesButton: root.locator('button.btn-edit-role'),
      async roleNames() {
        const text = await roles.innerText();
        return text
          .split(',')
          .map((role) => role.trim())
          .filter(Boolean);
      },
    };
  }

  /** Checkbox of one role inside the dialog. Disabled for `Admin` on `admin`. */
  roleCheckbox(role: UserRole): Locator {
    return this.rolesModalRows.filter({ hasText: role }).locator('input.form-check-input');
  }

  // -------------------------------------------------------------------- tabs

  async openUserManagement(): Promise<void> {
    await this.tabs.open('User management');
    await this.userTable.waitFor({ state: 'visible' });
  }

  async openPostManagement(): Promise<void> {
    await this.tabs.open('Post management');
    await this.postManagement.waitFor({ state: 'visible' });
  }

  // ----------------------------------------------------------------- actions

  /** Opens the roles dialog for `username`. */
  async openRolesModal(username: string): Promise<void> {
    await this.userRow(username).editRolesButton.click();
    await this.rolesModal.waitFor({ state: 'visible' });
  }

  async setRole(role: UserRole, selected: boolean): Promise<void> {
    if ((await this.roleCheckbox(role).isChecked()) !== selected) {
      await this.roleCheckbox(role).click();
    }
  }

  /** Selects exactly `roles` and clears every other enabled one. */
  async selectOnlyRoles(...roles: UserRole[]): Promise<void> {
    for (const role of ['Admin', 'Moderator', 'Member'] as UserRole[]) {
      if (await this.roleCheckbox(role).isEnabled()) {
        await this.setRole(role, roles.includes(role));
      }
    }
  }

  async submitRoles(): Promise<void> {
    await this.rolesModalSubmit.click();
    await this.rolesModal.waitFor({ state: 'hidden' });
  }

  async closeRolesModal(): Promise<void> {
    await this.rolesModalClose.click();
    await this.rolesModal.waitFor({ state: 'hidden' });
  }

  // ----------------------------------------------------------------- queries

  userCount(): Promise<number> {
    return this.userRows.count();
  }

  /** Submit stays disabled while no role is selected. */
  isSubmitRolesEnabled(): Promise<boolean> {
    return this.rolesModalSubmit.isEnabled();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
