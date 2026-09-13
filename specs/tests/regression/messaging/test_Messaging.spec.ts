import { MemberProfilePage, MessagesPage } from '../../../../src/PageObjects';
import { TIMEOUT } from '../../../../src/constants/timeouts';
import { uniqueName } from '../../../../src/helpers/data/unique.helper';
import {
  expect,
  idTag,
  LAYER_TAG,
  MUTATION_TAG,
  signInThroughUi,
  test,
  TEST_USER_1,
  TEST_USER_2,
} from '../../../support';

/**
 * Regression layer - messaging (containers, thread ordering, delete, and
 * SignalR live delivery/read receipts), on the conversation between
 * `test_user_2` (persona `member`) and `test_user_1` (persona `noRole`).
 *
 * Every test here shares that one conversation - `MessageHub` groups by
 * username pair, not by browser/test, so two of these tests running at once
 * would both join the same SignalR group and corrupt each other's read/unread
 * state. The whole file is therefore one serial group: Playwright runs every
 * test below on a single worker, in order, which `fullyParallel: true` would
 * otherwise not guarantee across files (each file already runs serially within
 * itself, but a sibling regression file could still race this one).
 */
test.describe('Tests verify messaging on the test_user_2/test_user_1 conversation', () => {
  test.describe.configure({ mode: 'serial' });

  test.describe(
    'Tests verify the Inbox/Outbox/Unread containers and message history',
    { tag: [LAYER_TAG.regression, MUTATION_TAG.mutation] },
    () => {
      test.use({ persona: 'member' });

      let inboundContent: string;
      let outboundContent: string;

      test.beforeEach(({ cleanup }) => {
        inboundContent = uniqueName('Regression inbound');
        outboundContent = uniqueName('Regression outbound');
        cleanup.messages('member', 'noRole', [
          inboundContent,
          outboundContent,
          `${outboundContent} - first`,
          `${outboundContent} - second`,
        ]);
      });

      test(
        '[ID: 64] Inbox, Outbox and Unread each list only the messages that belong there',
        { tag: [idTag(64), LAYER_TAG.regression, MUTATION_TAG.mutation] },
        async ({ page, apiAs }) => {
          await test.step('[Step 1][API] test_user_1 writes to test_user_2, test_user_2 writes back', async () => {
            const partner = await apiAs('noRole');
            const member = await apiAs('member');
            await partner.messages.send(TEST_USER_2.username, inboundContent);
            await member.messages.send(TEST_USER_1.username, outboundContent);
          });

          const messages = new MessagesPage(page);

          await test.step('[Step 2][UI] Inbox lists the inbound message only', async () => {
            await messages.open();
            await messages.selectContainer('Inbox');
            await expect(messages.row(inboundContent).content).toBeVisible();
            await expect.soft(messages.row(outboundContent).content).toHaveCount(0);
          });

          await test.step('[Step 3][UI] Unread lists the inbound message', async () => {
            await messages.selectContainer('Unread');
            await expect(messages.row(inboundContent).content).toBeVisible();
          });

          await test.step('[Step 4][UI] Outbox lists the outbound message only', async () => {
            await messages.selectContainer('Outbox');
            await expect(messages.row(outboundContent).content).toBeVisible();
            await expect.soft(messages.row(inboundContent).content).toHaveCount(0);
          });
        },
      );

      test(
        '[ID: 65] the conversation thread on a member profile lists messages oldest first',
        { tag: [idTag(65), LAYER_TAG.regression, MUTATION_TAG.mutation] },
        async ({ page, apiAs }) => {
          const first = `${outboundContent} - first`;
          const second = `${outboundContent} - second`;

          await test.step('[Step 1][API] test_user_2 sends two messages to test_user_1', async () => {
            const member = await apiAs('member');
            await member.messages.send(TEST_USER_1.username, first);
            await member.messages.send(TEST_USER_1.username, second);
          });

          await test.step('[Step 2][UI] The thread on the profile of test_user_1 shows them oldest first', async () => {
            const memberProfile = await new MemberProfilePage(page, TEST_USER_1.username).open();
            await memberProfile.openMessagesTab();

            // The panel renders before the hub's `ReceiveMessageThread` history
            // arrives; an array `toContainText` retries until bubbles containing
            // both texts exist, in this order.
            await expect(memberProfile.messageBubbles).toContainText([first, second]);
          });
        },
      );

      test(
        '[ID: 66] deleting a message removes it from its container',
        { tag: [idTag(66), LAYER_TAG.regression, MUTATION_TAG.mutation] },
        async ({ page, apiAs }) => {
          await test.step('[Step 1][API] test_user_1 sends test_user_2 a message', async () => {
            const partner = await apiAs('noRole');
            await partner.messages.send(TEST_USER_2.username, inboundContent);
          });

          const messages = new MessagesPage(page);

          await test.step('[Step 2][UI] The message is in the Inbox', async () => {
            await messages.open();
            await messages.selectContainer('Inbox');
            await expect(messages.row(inboundContent).content).toBeVisible();
          });

          await test.step('[Step 3][UI] Deleting it removes it from the Inbox', async () => {
            await messages.row(inboundContent).delete();
            await expect(messages.row(inboundContent).content).toHaveCount(0);
          });
        },
      );
    },
  );

  /**
   * The UI sends through the SignalR hub, not the REST `messages` endpoint
   * (`member-messages.component.ts` -> `MessageService.sendMessage` -> hub
   * method `SendMessage`), so these two need to actually open two live
   * conversations rather than seed data through the API. This block sets no
   * `persona`: the sender signs in through the login form on the test's own
   * page, and the recipient gets a second session from `pageAs`.
   */
  test.describe(
    'Tests verify live message delivery and read receipts over SignalR',
    { tag: [LAYER_TAG.regression, MUTATION_TAG.mutation] },
    () => {
      test(
        '[ID: 67] a message sent while both members have the conversation open arrives live on the other side',
        { tag: [idTag(67), LAYER_TAG.regression, MUTATION_TAG.mutation] },
        async ({ page, pageAs, cleanup }) => {
          const content = uniqueName('Realtime message');
          cleanup.messages('member', 'noRole', [content]);
          const senderThread = new MemberProfilePage(page, TEST_USER_1.username);

          await test.step('[Step 1][UI] test_user_2 opens the conversation with test_user_1', async () => {
            await signInThroughUi(page, TEST_USER_2);
            await senderThread.open();
            await senderThread.startConversation();
          });

          const recipientThread = await test.step(
            '[Step 2][UI] test_user_1 opens the same conversation in a second session',
            async () => {
              const recipientPage = await pageAs('noRole');
              const thread = await new MemberProfilePage(recipientPage, TEST_USER_2.username).open();
              await thread.startConversation();
              return thread;
            },
          );

          await test.step('[Step 3][UI] A message sent by test_user_2 arrives live for test_user_1', async () => {
            await senderThread.sendMessage(content);

            // `MessageHub.SendMessage` broadcasts `NewMessage` to both connections in
            // the group - the recipient's thread updates without a reload.
            await expect(recipientThread.messageWithText(content)).toBeVisible();
          });
        },
      );

      test(
        '[ID: 68] a sent message shows unread until the recipient opens the conversation, then updates live to read',
        { tag: [idTag(68), LAYER_TAG.regression, MUTATION_TAG.mutation] },
        async ({ page, pageAs, cleanup }) => {
          const content = uniqueName('Read receipt');
          cleanup.messages('member', 'noRole', [content]);
          const senderThread = new MemberProfilePage(page, TEST_USER_1.username);

          const ownIndex = await test.step('[Step 1][UI] test_user_2 sends a message while test_user_1 is away', async () => {
            await signInThroughUi(page, TEST_USER_2);
            await senderThread.open();
            await senderThread.startConversation();
            await senderThread.sendMessage(content);

            // `sendMessage()` has already waited for the hub to echo the message into
            // the thread, so the index is read from the synced list.
            return (await senderThread.messageTexts()).indexOf(content);
          });

          await test.step('[Step 2][UI] The sent message is marked unread', async () => {
            // The recipient is not connected to the group yet, so `MessageHub.SendMessage`
            // never sets `DateRead`.
            await expect(senderThread.message(ownIndex).unreadMarker).toBeVisible();
          });

          await test.step('[Step 3][UI] test_user_1 opens the conversation in a second session', async () => {
            const recipientPage = await pageAs('noRole');
            const recipientThread = await new MemberProfilePage(recipientPage, TEST_USER_2.username).open();
            await recipientThread.startConversation();
          });

          await test.step('[Step 4][UI] The marker flips to read live, without a reload', async () => {
            // The recipient joining the group broadcasts `UpdatedGroup`, which the
            // sender's already-open connection uses to flip the marker. The default
            // 5 s assertion timeout is too tight: most of the wait is the recipient's
            // own sign-in-and-navigate sequence, not the SignalR round trip itself.
            await expect(senderThread.message(ownIndex).readMarker).toBeVisible({ timeout: TIMEOUT.signalR });
          });
        },
      );
    },
  );
});
