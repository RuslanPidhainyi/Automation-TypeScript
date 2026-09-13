import { NotFoundPage, ServerErrorPage, TestErrorsPage } from '../../../../src/PageObjects';
import { ENDPOINTS } from '../../../../src/constants/endpoints';
import { TOAST } from '../../../../src/constants/messages';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test } from '../../../support';

/**
 * Regression layer - `/errors` (`TestErrorsComponent`) and the client's
 * `error.interceptor`, which turns each `buggy/*` response into a specific
 * toast or redirect. Admin-only route (`adminGuard`), so this uses the
 * `adminModerator` session. Each error type is its own step with a soft check,
 * so one run reports every button that misbehaves.
 */
test.describe(
  'Tests verify the /errors buttons drive the error interceptor correctly',
  { tag: [LAYER_TAG.regression, MUTATION_TAG.unmutation] },
  () => {
    test.use({ persona: 'adminModerator' });

    test(
      '[ID: 50] each of the five /errors buttons produces its matching toast, redirect or validation list',
      { tag: [idTag(50), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const testErrors = new TestErrorsPage(page);

        await test.step('[Step 1][UI] 400 shows the bad-request toast', async () => {
          // BuggyController returns a plain BadRequest string, so error.interceptor
          // takes its generic branch and shows it as a toast.
          await testErrors.open();
          await testErrors.trigger(400);
          await expect.soft(testErrors.toast(TOAST.badRequest)).toBeVisible();
        });

        await test.step('[Step 2][UI] 401 answers 200 for a signed-in admin and shows no toast', async () => {
          // `buggy/auth` is `[Authorize]`, but `/errors` itself requires
          // adminGuard, so the only way to reach this button is already signed
          // in - the client's own HTTP interceptor attaches that same bearer
          // token to every request, `buggy/auth` happily answers 200 "secret
          // text", and no toast appears at all. Verified against a live run:
          // the coverage plan's assumption of an "Unauthorised" toast does not
          // hold for this button in practice, only for an anonymous caller
          // (already covered directly at the API level by
          // `test_Api.spec.ts`'s `[ID: 18]`).
          const authResponse = page.waitForResponse((r) => r.url().includes(ENDPOINTS.buggy.auth));
          await testErrors.trigger(401);
          expect.soft((await authResponse).status()).toBe(200);
          await expect.soft(testErrors.toast(TOAST.unauthorised)).toHaveCount(0);
        });

        await test.step('[Step 3][UI] 404 redirects to /not-found', async () => {
          await testErrors.trigger(404);
          const notFound = await new NotFoundPage(page).waitForLoaded();
          await expect.soft(notFound.heading).toBeVisible();
        });

        await test.step('[Step 4][UI] 500 redirects to /server-error with the exception details', async () => {
          // The exception reaches /server-error through router state.
          await testErrors.open();
          await testErrors.trigger(500);
          const serverError = await new ServerErrorPage(page).waitForLoaded();
          await expect.soft(serverError.message).toBeVisible();
        });

        await test.step('[Step 5][UI] The validation error renders the validation list', async () => {
          // account/register with an empty body returns a ModelState errors
          // dictionary, rendered as the validation list instead of a toast.
          await testErrors.open();
          await testErrors.triggerValidationError();
          await expect.soft(testErrors.validationErrors).not.toHaveCount(0);
        });
      },
    );
  },
);
