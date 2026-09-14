import { LoginPage } from '../../../src/PageObjects';
import { ENDPOINTS } from '../../../src/constants/endpoints';
import { collectLoadProblems } from '../../../src/helpers/browserHealth.helper';
import { apiUrl, CLIENT_URL, expect, idTag, LAYER_TAG, MUTATION_TAG, test } from '../../support';

/**
 * Health layer - the Angular client side.
 *
 * Availability only: the dev server answers, the shell boots, the bundle is
 * clean and the API can be reached *from the browser*, which is the one thing
 * the API specs cannot prove because CORS (`API/Program.cs`) only ever applies
 * to a request that carries an `Origin` header.
 *
 * No business scenario lives here - `LoginPage` is used purely as the proof
 * that Angular finished rendering.
 */
test.describe(
  'Tests verify client health',
  { tag: [LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 20] the dev server answers on / and the login card renders',
      { tag: [idTag(20), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const login = new LoginPage(page);

        const response = await login.navigate();

        expect(response?.status(), 'the client did not answer on /').toBe(200);
        await expect(page).toHaveTitle('TravelApp');

        // The shell booted *and* the router drew the login component into it.
        await expect(login.root).toBeVisible();
        await expect(login.uniqueElement).toBeVisible();
        await expect(login.loginButton).toBeEnabled();
      },
    );

    test(
      '[ID: 21] loading the client logs no console errors and no failed requests',
      { tag: [idTag(21), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        const problems = collectLoadProblems(page, CLIENT_URL);

        const login = new LoginPage(page);
        await login.open();
        // The bundle keeps loading after the first paint; give the late requests a
        // moment to fail before the collected problems are read.
        // eslint-disable-next-line playwright/no-networkidle -- no single element or response marks "the bundle finished loading"
        await page.waitForLoadState('networkidle');

        expect(problems.consoleErrors, 'the client logged errors while loading').toEqual([]);
        expect(problems.failedRequests, 'requests to the client failed while loading').toEqual([]);
      },
    );

    test(
      '[ID: 22] the API answers the browser, so CORS admits the client origin',
      { tag: [idTag(22), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
      async ({ page }) => {
        await new LoginPage(page).open();

        // Runs inside the page, i.e. from origin https://localhost:4200 with an
        // `Origin` header - exactly what the Angular services do. `buggy/not-found`
        // needs no token and reaches the database, so a 404 means the whole chain
        // browser -> CORS -> API -> DB is intact. A blocked request rejects the
        // fetch, which is why the failure is reported as text, not as an exception.
        const probeUrl = apiUrl(ENDPOINTS.buggy.notFound);
        const probe = await page.evaluate(async (url) => {
          try {
            const response = await fetch(url);
            return { status: response.status, error: null as string | null };
          } catch (error) {
            return { status: 0, error: String(error) };
          }
        }, probeUrl);

        expect(probe.error, `the browser could not reach ${probeUrl}`).toBeNull();
        expect(probe.status).toBe(404);
      },
    );
  },
);
