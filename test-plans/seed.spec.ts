import { OffersPage } from '../src/PageObjects';
import { expect, test } from '../specs/support';

/**
 * Seed for the Playwright Test Agents (`.claude/agents/`, `.mcp.json`): the
 * planner and the generator start every session from the state this test
 * leaves - `test_user_2` signed in from the saved `member` session, on /offers.
 *
 * It belongs to the `agents` project, which exists only while `PW_AGENTS=1`
 * (set in `.mcp.json`), so no ordinary run picks it up.
 */
test.use({ persona: 'member' });

test('seed', async ({ page }) => {
  const offers = await new OffersPage(page).open();
  await expect(offers.heading).toBeVisible();
});
