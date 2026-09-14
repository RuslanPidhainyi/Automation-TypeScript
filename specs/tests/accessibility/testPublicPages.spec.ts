import { LoginPage, NotFoundPage, RegistrationPage, ServerErrorPage } from '../../../src/PageObjects';
import { expect, idTag, issuesOf, LAYER_TAG, MUTATION_TAG, test } from '../../support';

/**
 * Accessibility layer - the screens a signed-out visitor can reach. axe-core
 * runs every rule it enables by default (WCAG 2.x A and AA plus best practices)
 * once the screen has finished rendering; `toHaveNoA11yViolations` lists every
 * violation with its selectors and attaches the full axe results.
 */
test.describe(
  'Tests verify the screens a signed-out visitor sees have no accessibility violations',
  { tag: [LAYER_TAG.accessibility, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 137] the login page has no accessibility violations',
      { tag: [idTag(137), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(137) },
      async ({ page }) => {
        const login = await new LoginPage(page).open();
        await login.waitForSpinnerToDisappear();

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      '[ID: 138] the registration form has no accessibility violations',
      { tag: [idTag(138), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(138) },
      async ({ page }) => {
        const registration = await new RegistrationPage(page).open();
        await registration.waitForSpinnerToDisappear();

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      '[ID: 139] the registration form with the date-of-birth calendar open has no accessibility violations',
      { tag: [idTag(139), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(139) },
      async ({ page }) => {
        const registration = await new RegistrationPage(page).open();
        await registration.openDateOfBirthCalendar();

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      '[ID: 140] the not-found page has no accessibility violations',
      { tag: [idTag(140), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(140) },
      async ({ page }) => {
        const notFound = await new NotFoundPage(page).open();
        await notFound.waitForSpinnerToDisappear();

        await expect(page).toHaveNoA11yViolations();
      },
    );

    test(
      '[ID: 141] the server-error page has no accessibility violations',
      { tag: [idTag(141), LAYER_TAG.accessibility, MUTATION_TAG.unmutation], annotation: issuesOf(141) },
      async ({ page }) => {
        const serverError = await new ServerErrorPage(page).open();
        await serverError.waitForSpinnerToDisappear();

        await expect(page).toHaveNoA11yViolations();
      },
    );
  },
);
