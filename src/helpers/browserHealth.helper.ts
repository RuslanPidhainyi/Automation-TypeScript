import { ConsoleMessage, Page, Request, Response } from '@playwright/test';

/**
 * Browser console/network checks for the client health probe
 * (`test_App.spec.ts`). No notion of "a test" or "a scenario" - called directly
 * by the spec, since no support-level wrapper exists for this yet
 * (`RulesForWritingTests.md` §3).
 */

/**
 * Noise that says nothing about the health of the application. The Angular dev
 * server injects its own live-reload client, and Chromium reports the missing
 * source maps of third-party packages as console errors. Extend the list rather
 * than loosening the assertions.
 */
const IGNORED_NOISE = [/ng-cli-ws/, /sockjs/, /source ?map/i, /Download the Angular DevTools/i];

export function isNoise(text: string): boolean {
  return IGNORED_NOISE.some((pattern) => pattern.test(text));
}

/** Whether `url` was requested from `origin` - anything else is out of our hands. */
export function isOwnOrigin(url: string, origin: string): boolean {
  return url.startsWith(origin);
}

/** What went wrong while a page loaded, as collected by `collectLoadProblems`. */
export interface LoadProblems {
  /** Console errors and uncaught exceptions, noise filtered out. */
  consoleErrors: string[];
  /** Failed requests and >= 400 responses from `origin`, noise filtered out. */
  failedRequests: string[];
}

/**
 * Starts listening on `page` and returns arrays that fill up as problems occur:
 * call it before navigating, and read the arrays once the page has settled.
 * Requests to anything other than `origin` are ignored.
 */
export function collectLoadProblems(page: Page, origin: string): LoadProblems {
  const problems: LoadProblems = { consoleErrors: [], failedRequests: [] };

  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error' && !isNoise(message.text())) {
      problems.consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error: Error) => {
    if (!isNoise(error.message)) problems.consoleErrors.push(`uncaught: ${error.message}`);
  });

  page.on('requestfailed', (request: Request) => {
    const description = `${request.method()} ${request.url()} - ${request.failure()?.errorText}`;
    if (isOwnOrigin(request.url(), origin) && !isNoise(description)) {
      problems.failedRequests.push(description);
    }
  });

  page.on('response', (response: Response) => {
    if (isOwnOrigin(response.url(), origin) && response.status() >= 400) {
      problems.failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  return problems;
}
