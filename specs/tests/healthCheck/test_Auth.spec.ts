import { test } from '@playwright/test';
import {
  idTag,
  LAYER_TAG,
  MUTATION_TAG,
  signInThroughUi,
  signInWithToken,
  TEST_USER_1,
  TEST_USER_2,
  TEST_USER_3,
  TEST_USER_4,
  TEST_USER_5,
} from '../../support';

/**
 * Health layer - sign-in itself.
 *
 * `auth.setup.ts` offers two ways for a spec to end up signed in without
 * touching the login form itself; both are exercised here, directly, against
 * both credentials this suite knows about (`TEST_USER_2`, `TEST_USER_1`, `TEST_USER_3`, `TEST_USER_4`, and `TEST_USER_5`). A
 * broken login belongs at the gate, not surfacing later as a wall of
 * unrelated smoke failures that all trace back to the same root cause.
 *
 *   UI    - clicks through the login form, exactly like a real visitor.
 *   token - calls `account/login` directly and plants the response into
 *           `localStorage['user']`, the way `AccountService.setCurrentUser`
 *           does, then reloads so `AppComponent.ngOnInit` picks the session
 *           back up and `redirectAuthenticatedGuard` sends `/` to `/offers`.
 */
test.describe('Tests verify sign-in', { tag: [LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] }, () => {
  test(
    '[ID: 0] test_user_1 without role can sign in through the login form',
    { tag: [idTag(0), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
    async ({ page }) => {
      await signInThroughUi(page, TEST_USER_1);
    },
  );

  test(
    '[ID: 1] test_user_2 like Member role can sign in through the login form',
    { tag: [idTag(1), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
    async ({ page }) => {
      await signInThroughUi(page, TEST_USER_2);
    },
  );

  test(
    '[ID: 2] test_user_3 like Moderator role can sign in through the login form',
    { tag: [idTag(2), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
    async ({ page }) => {
      await signInThroughUi(page, TEST_USER_3);
    },
  );

  test(
    '[ID: 3] test_user_4 like Admin role can sign in through the login form',
    { tag: [idTag(3), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
    async ({ page }) => {
      await signInThroughUi(page, TEST_USER_4);
    },
  );

  test(
    '[ID: 4] test_user_5 like Admin and Moderator role can sign in through the login form',
    { tag: [idTag(4), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
    async ({ page }) => {
      await signInThroughUi(page, TEST_USER_5);
    },
  );

  test(
    '[ID: 5] test_user_1 without role can sign in with a token planted into localStorage',
    { tag: [idTag(5), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
    async ({ page, request }) => {
      await signInWithToken(page, request, TEST_USER_1);
    },
  );

  test(
    '[ID: 6] test_user_2 like Member role can sign in with a token planted into localStorage',
    { tag: [idTag(6), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
    async ({ page, request }) => {
      await signInWithToken(page, request, TEST_USER_2);
    },
  );

  test(
    '[ID: 7] test_user_3 like Moderator role can sign in with a token planted into localStorage',
    { tag: [idTag(7), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
    async ({ page, request }) => {
      await signInWithToken(page, request, TEST_USER_3);
    },
  );

  test(
    '[ID: 8] test_user_4 like Admin role can sign in with a token planted into localStorage',
    { tag: [idTag(8), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
    async ({ page, request }) => {
      await signInWithToken(page, request, TEST_USER_4);
    },
  );

  test(
    '[ID: 9] test_user_5 like Admin and Moderator role can sign in with a token planted into localStorage',
    { tag: [idTag(9), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
    async ({ page, request }) => {
      await signInWithToken(page, request, TEST_USER_5);
    },
  );
});
