import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Credentials and URLs live in `.env` (git-ignored); `.env.example` documents
 * the keys. https://github.com/motdotla/dotenv
 */
dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Three independently runnable layers, one project each:
 *
 *   health     - is the stack up and are the contracts intact?  < 30 s, gates the rest
 *   smoke      - does every core happy path still work?         < 5 min, chromium
 *   regression - does the whole behaviour still hold?           nightly, 3 browsers
 *
 *   npm run test:health | test:smoke | test:regression
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './specs/tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: process.env.BASE_URL ?? 'https://localhost:4200',
    /* The Angular dev server serves HTTPS with a self-signed certificate
       (Client/angular.json -> architect.serve.options.ssl), and so does the API
       on https://localhost:5001. Applies to the `request` fixture as well. */
    ignoreHTTPSErrors: true,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Збирати скріншоти лише при падінні тесту */
    screenshot: 'only-on-failure',
    /* Записувати відео при першому повторі тесту */
    video: 'on-first-retry',
  },

  /* One project per layer; `--project=health` runs the gate on its own. */
  projects: [
    {
      name: 'health',
      testDir: './specs/tests/healthCheck',
      /* The whole layer has a 30 s budget, so a single probe may not sit for
         longer than a few seconds before it is called a failure. */
      timeout: 15_000,
      expect: { timeout: 5_000 },
      use: { ...devices['Desktop Chrome'] },
      /* Deliberately without `dependencies`: health is the gate and must be
         able to run when nothing else can, including the login it would need
         for a storageState. */
    },
    {
      /* Signs in once per role and writes playwright/.auth/{member,admin}.json.
         Specs opt in per file - `test.use({ storageState: STORAGE_STATE.member })`
         - so the anonymous specs stay anonymous. See specs/support/auth.ts. */
      name: 'setup',
      testDir: './specs/support',
      testMatch: /.*\.setup\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'smoke',
      testDir: './specs/tests/smoke',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'regression-chromium',
      testDir: './specs/tests/regression',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'regression-firefox',
      testDir: './specs/tests/regression',
      dependencies: ['setup'],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'regression-webkit',
      testDir: './specs/tests/regression',
      dependencies: ['setup'],
      use: { ...devices['Desktop Safari'] },
    },

    /* Налаштування проєктів для різних браузерів: реальні branded-збірки
       (system-installed Chrome/Edge) замість Playwright-івського bundled
       Chromium. Без testDir/dependencies - за замовчуванням підхоплюють весь
       testDir з кореня конфігу. */
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
  ],

  /* The stack is started by hand for now - `dotnet run` in API/ and `npm start`
     in Client/. See README.md. */
});
