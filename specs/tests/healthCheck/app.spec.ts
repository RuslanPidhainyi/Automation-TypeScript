import { ConsoleMessage, Request, Response, expect, test } from '@playwright/test';
import { LoginPage } from '../../../src/PageObjects';
import { apiUrl, CLIENT_URL } from '../../support';

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

/**
 * Noise that says nothing about the health of the application. The Angular dev
 * server injects its own live-reload client, and Chromium reports the missing
 * source maps of third-party packages as console errors. Extend the list rather
 * than loosening the assertions.
 */
const IGNORED_NOISE = [/ng-cli-ws/, /sockjs/, /source ?map/i, /Download the Angular DevTools/i];

function isNoise(text: string): boolean {
  return IGNORED_NOISE.some((pattern) => pattern.test(text));
}

/** Requests to the client's own origin - anything else is out of our hands. */
function isOwnOrigin(url: string): boolean {
  return url.startsWith(CLIENT_URL);
}

test.describe('Client health', () => {
  test('the dev server answers on / and the login card renders', async ({ page }) => {
    const login = new LoginPage(page);

    const response = await login.navigate();

    expect(response?.status(), 'the client did not answer on /').toBe(200);
    await expect(page).toHaveTitle('TravelApp');

    // The shell booted *and* the router drew the login component into it.
    await expect(login.root).toBeVisible();
    await expect(login.uniqueElement).toBeVisible();
    await expect(login.loginButton).toBeEnabled();
  });

  test('loading the client logs no console errors and no failed requests', async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (message: ConsoleMessage) => {
      if (message.type() === 'error' && !isNoise(message.text())) {
        consoleErrors.push(message.text());
      }
    });

    page.on('pageerror', (error: Error) => {
      if (!isNoise(error.message)) consoleErrors.push(`uncaught: ${error.message}`);
    });

    page.on('requestfailed', (request: Request) => {
      const description = `${request.method()} ${request.url()} - ${request.failure()?.errorText}`;
      if (isOwnOrigin(request.url()) && !isNoise(description)) failedRequests.push(description);
    });

    page.on('response', (response: Response) => {
      if (isOwnOrigin(response.url()) && response.status() >= 400) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });

    const login = new LoginPage(page);
    await login.open();
    // The bundle keeps loading after the first paint; give the late requests a
    // moment to fail before the listeners are dropped.
    await page.waitForLoadState('networkidle');

    expect(consoleErrors, 'the client logged errors while loading').toEqual([]);
    expect(failedRequests, 'requests to the client failed while loading').toEqual([]);
  });

  test('the API answers the browser, so CORS admits the client origin', async ({ page }) => {
    await new LoginPage(page).open();

    // Runs inside the page, i.e. from origin https://localhost:4200 with an
    // `Origin` header - exactly what the Angular services do. `buggy/not-found`
    // needs no token and reaches the database, so a 404 means the whole chain
    // browser -> CORS -> API -> DB is intact. A blocked request rejects the
    // fetch, which is why the failure is reported as text, not as an exception.
    const probe = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url);
        return { status: response.status, error: null as string | null };
      } catch (error) {
        return { status: 0, error: String(error) };
      }
    }, apiUrl('buggy/not-found'));

    expect(probe.error, `the browser could not reach ${apiUrl('buggy/not-found')}`).toBeNull();
    expect(probe.status).toBe(404);
  });
});
