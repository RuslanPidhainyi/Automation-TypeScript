// @ts-check
import { defineConfig } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

/**
 * Quality gate - `npm run lint`, `npm run check` and the pre-commit hook
 * (`.husky/pre-commit`). What each block enforces, and why, is described in
 * `.github/Skills/RulesForWritingTests.md` §10.
 */
const NUMERIC_TIMEOUT = 'Use a named constant from src/constants/timeouts.ts (RulesForWritingTests.md §8).';

export default defineConfig(
  { ignores: ['node_modules/', 'playwright-report/', 'test-results/', 'blob-report/', 'playwright/'] },

  // Every TypeScript file: the recommended set, the type-aware rules that catch a
  // forgotten `await`, and no numeric timeout outside src/constants/timeouts.ts.
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommended],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: "Property[key.name='timeout'] > Literal", message: NUMERIC_TIMEOUT },
        { selector: "CallExpression[callee.property.name='setTimeout'] > Literal", message: NUMERIC_TIMEOUT },
      ],
    },
  },

  // Specs: Playwright's recommended rules, with the ones RulesForWritingTests.md
  // depends on raised to errors.
  {
    files: ['specs/tests/**/*.spec.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      'playwright/no-raw-locators': 'error',
      'playwright/no-conditional-in-test': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/no-wait-for-timeout': 'error',
      'playwright/missing-playwright-await': 'error',
      'playwright/no-force-option': 'error',
      // The sign-in flows assert inside the helper itself (specs/support/signIn.ts).
      'playwright/expect-expect': ['error', { assertFunctionNames: ['signInThroughUi', 'signInWithToken'] }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@playwright/test',
              importNames: ['test', 'expect'],
              message: 'Import test and expect from specs/support - they carry the suite fixtures (RulesForWritingTests.md §1).',
            },
          ],
        },
      ],
    },
  },
);
