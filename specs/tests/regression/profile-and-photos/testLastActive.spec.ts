import { MemberProfilePage } from '../../../../src/PageObjects';
import { SEED } from '../../../../src/constants/testData';
import { shiftTime } from '../../../../src/helpers/time.helper';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test } from '../../../support';

/**
 * Regression layer - "Last Active" on a member's profile is rendered by the
 * `timeago` pipe, relative to the visitor's own clock. `page.clock` pins that
 * clock a known distance after the member's `lastActive`, so the text is the same
 * on every run and on every day.
 *
 * The member is a seeded one (`SEED.members`): no spec signs in as a seeded
 * account, and `LogUserActivity` only stamps the caller, so nothing the suite
 * does moves their `lastActive` while this test runs.
 */
test.describe(
  "Tests verify a member's Last Active reads relative to the visitor's clock",
  { tag: [LAYER_TAG.regression, MUTATION_TAG.unmutation] },
  () => {
    test.use({ persona: 'member' });

    test(
      '[ID: 158] Last Active of a seeded member reads "5 hours ago", then "3 days ago" once the clock moves on',
      { tag: [idTag(158), LAYER_TAG.regression, MUTATION_TAG.unmutation] },
      async ({ page, apiAs }) => {
        const username = SEED.members[0];
        const profile = new MemberProfilePage(page, username);

        const lastActive = await test.step('[Step 1][API] Read when the seeded member was last active', async () => {
          const member = await (await apiAs('member')).users.get(username);
          return new Date(member.lastActive);
        });

        await test.step('[Step 2][UI] With the clock five hours later, Last Active reads "5 hours ago"', async () => {
          await page.clock.setFixedTime(shiftTime(lastActive, { hours: 5 }));
          await profile.open();
          await expect(profile.sidebar.lastActive).toHaveText('5 hours ago');
        });

        await test.step('[Step 3][UI] With the clock three days later, after a reload, it reads "3 days ago"', async () => {
          await page.clock.setFixedTime(shiftTime(lastActive, { days: 3 }));
          await profile.reload();
          await expect(profile.sidebar.lastActive).toHaveText('3 days ago');
        });
      },
    );
  },
);
