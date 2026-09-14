import AxeBuilder from '@axe-core/playwright';
import { expect as baseExpect, test, type APIResponse, type Page } from '@playwright/test';
import { z } from 'zod';

/**
 * Playwright's `expect` with the suite's own matchers. Specs get it, like `test`,
 * from `specs/support` (`RulesForWritingTests.md` §11).
 */
export const expect = baseExpect.extend({
  /**
   * The JSON body of `response` satisfies `schema`. The typed controller calls
   * validate a 2xx body already (`HttpClient.parse`); this is for the body of a
   * refused request, whose shape is part of the contract too:
   *
   *   await expect(response).toMatchSchema(ValidationProblemSchema);
   */
  async toMatchSchema(response: APIResponse, schema: z.ZodType) {
    const name = 'toMatchSchema';
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { name, pass: false, message: () => `${response.url()} did not answer with JSON` };
    }

    const result = schema.safeParse(body);
    return {
      name,
      pass: result.success,
      message: () =>
        result.success
          ? `${response.url()} was expected not to match the schema`
          : `${response.url()} broke its contract:\n${z.prettifyError(result.error)}`,
    };
  },

  /**
   * axe-core finds no violation on the page as it is at this moment - every rule
   * axe enables by default: WCAG 2.x A and AA plus best practices. On failure the
   * full axe results are attached to the test, next to a readable list here.
   *
   *   await expect(page).toHaveNoA11yViolations();
   */
  async toHaveNoA11yViolations(page: Page) {
    const name = 'toHaveNoA11yViolations';
    const { violations } = await new AxeBuilder({ page }).analyze();
    const pass = violations.length === 0;

    if (!pass && !this.isNot) {
      await test.info().attach('axe-violations', {
        body: JSON.stringify(violations, null, 2),
        contentType: 'application/json',
      });
    }

    return {
      name,
      pass,
      message: () =>
        pass
          ? `${page.url()} was expected to have accessibility violations`
          : `${page.url()} has ${violations.length} accessibility violation(s):\n` +
            violations
              .map(
                (violation) =>
                  `  [${violation.impact}] ${violation.id} - ${violation.help}\n` +
                  violation.nodes.map((node) => `      ${node.target.join(' ')}`).join('\n'),
              )
              .join('\n'),
    };
  },
});
