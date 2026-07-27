# Automation-TypeScript

Test automation framework built with [Playwright](https://playwright.dev/) and TypeScript.

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
npm install
npx playwright install
```

## Running tests

```bash
npm test              # run all tests headless
npm run test:headed   # run with a visible browser
npm run test:ui       # run in Playwright's UI mode
npm run test:debug    # run in debug mode (step through)
npm run report        # open the last HTML report
```

Run a single file or test:

```bash
npx playwright test tests/example.spec.ts
npx playwright test tests/example.spec.ts -g "test name"
```

## Project structure

```
tests/                # test specs
playwright.config.ts  # Playwright configuration (browsers, base URL, reporters, etc.)
```

## CI

A GitHub Actions workflow is included at `.github/workflows/playwright.yml` and runs the suite on push/PR.
