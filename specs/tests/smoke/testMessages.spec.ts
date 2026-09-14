import { MemberProfilePage, MessagesPage } from '../../../src/PageObjects';
import { uniqueName } from '../../../src/helpers/data/unique.helper';
import { expect, idTag, issuesOf, LAYER_TAG, MUTATION_TAG, test, TEST_USER_1 } from '../../support';

/**
 * Smoke layer - sending a message.
 *
 * `messages` is a state-changing endpoint, so the message sent here is
 * registered with the `cleanup` fixture, which removes it from both sides of the
 * conversation after the test - a spec must never leave a message behind for the
 * next run to trip over.
 */
test.describe(
  'Tests verify sending a message',
  { tag: [LAYER_TAG.smoke, MUTATION_TAG.mutation] },
  () => {
    test.use({ persona: 'member' });

    test(
      '[ID: 32] test_user_2 sends a message to test_user_1 and it shows up in the Outbox',
      { tag: [idTag(32), LAYER_TAG.smoke, MUTATION_TAG.mutation], annotation: issuesOf(32) },
      async ({ page, cleanup }) => {
        const content = uniqueName('Smoke message');
        cleanup.messages('member', 'noRole', [content]);

        const memberProfile = await new MemberProfilePage(page, TEST_USER_1.username).open();
        await memberProfile.startConversation();
        await memberProfile.sendMessage(content);

        const messages = await new MessagesPage(page).open();
        await messages.selectContainer('Outbox');
        await expect(messages.row(content).content).toBeVisible();
      },
    );
  },
);
