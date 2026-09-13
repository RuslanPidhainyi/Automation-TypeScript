import { API_ERROR } from '../../../src/constants/messages';
import { MISSING_ID } from '../../../src/constants/testData';
import { uniqueName, unknownUsername } from '../../../src/helpers/data/unique.helper';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test, TEST_USER_3, TEST_USER_4 } from '../../support';

/**
 * API layer - `MessagesController`: whom a message may go to, and who may
 * delete one.
 *
 * The test that needs a real message sends it from test_user_3 (`moderator`)
 * to test_user_4 (`admin`) - a conversation no UI test opens, so no Inbox or
 * thread check elsewhere ever sees it - and `cleanup` deletes it from both sides
 * afterwards. test_user_2 (`member`) is the stranger.
 */
test.describe(
  'Tests verify messages refuses a message it cannot send or delete',
  { tag: [LAYER_TAG.api, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 122] test_user_3 messaging itself answers 400 "You cannot message yourself"',
      { tag: [idTag(122), LAYER_TAG.api, MUTATION_TAG.unmutation] },
      async ({ apiAs }) => {
        const sender = await apiAs('moderator');

        const response = await sender.messages.sendRaw(TEST_USER_3.username, uniqueName('API message'));

        expect(response.status()).toBe(400);
        expect(await response.text()).toBe(API_ERROR.cannotMessageYourself);
      },
    );

    test(
      '[ID: 123] test_user_3 messaging a username nobody has answers 400 "Cannot send message at this time"',
      { tag: [idTag(123), LAYER_TAG.api, MUTATION_TAG.unmutation] },
      async ({ apiAs }) => {
        const sender = await apiAs('moderator');

        const response = await sender.messages.sendRaw(unknownUsername(), uniqueName('API message'));

        expect(response.status()).toBe(400);
        expect(await response.text()).toBe(API_ERROR.cannotSendMessage);
      },
    );

    test(
      '[ID: 124] test_user_3 deleting a message that does not exist answers 400 "Cannot delete this message!"',
      { tag: [idTag(124), LAYER_TAG.api, MUTATION_TAG.unmutation] },
      async ({ apiAs }) => {
        const caller = await apiAs('moderator');

        const response = await caller.messages.removeRaw(MISSING_ID);

        expect(response.status()).toBe(400);
        expect(await response.text()).toBe(API_ERROR.cannotDeleteMessage);
      },
    );
  },
);

test.describe(
  'Tests verify only the sender or the recipient may delete a message',
  { tag: [LAYER_TAG.api, MUTATION_TAG.mutation] },
  () => {
    test(
      '[ID: 125] test_user_2 deleting a message from test_user_3 to test_user_4 answers 403 and the message stays',
      { tag: [idTag(125), LAYER_TAG.api, MUTATION_TAG.mutation] },
      async ({ apiAs, cleanup }) => {
        const content = uniqueName('API message');
        cleanup.messages('moderator', 'admin', [content]);
        const sender = await apiAs('moderator');
        const stranger = await apiAs('member');

        const messageId = await test.step(
          '[Step 1][API] test_user_3 sends test_user_4 a message',
          async () => (await sender.messages.send(TEST_USER_4.username, content)).id,
        );

        await test.step('[Step 2][API] test_user_2 tries to delete it', async () => {
          const response = await stranger.messages.removeRaw(messageId);
          expect(response.status()).toBe(403);
        });

        await test.step('[Step 3][API] test_user_3 still has the message in the conversation', async () => {
          const thread = await sender.messages.thread(TEST_USER_4.username);
          expect(thread.map((message) => message.id)).toContain(messageId);
        });
      },
    );
  },
);
