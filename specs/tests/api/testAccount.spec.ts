import { API_ERROR } from '../../../src/constants/messages';
import { buildRegisterDto } from '../../../src/helpers/data/registration.factory';
import { unknownUsername } from '../../../src/helpers/data/unique.helper';
import { ValidationProblemSchema } from '../../../src/models';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test, TEST_USER_1 } from '../../support';

/**
 * API layer - `AccountController`: how registering and signing in refuse a bad
 * request.
 *
 * None of these requests may succeed. `account/register` has no counterpart to
 * delete an account with, so no test here registers one for real - and the
 * unique username `buildRegisterDto` picks keeps even a broken refusal from
 * colliding with another run.
 */
test.describe(
  'Tests verify account/register and account/login refuse an invalid request',
  { tag: [LAYER_TAG.api, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 113] registering the username of test_user_1 answers 400 "Username is taken"',
      { tag: [idTag(113), LAYER_TAG.api, MUTATION_TAG.unmutation] },
      async ({ api }) => {
        const response = await api.account.registerRaw(buildRegisterDto({ username: TEST_USER_1.username }));

        expect(response.status()).toBe(400);
        expect(await response.text()).toBe(API_ERROR.usernameTaken);
      },
    );

    test(
      '[ID: 114] registering with an 8-character password answers 400 naming the Password field',
      { tag: [idTag(114), LAYER_TAG.api, MUTATION_TAG.unmutation] },
      async ({ api }) => {
        // `RegisterDto.Password` is `[StringLength(21, MinimumLength = 9)]` - one character short.
        const response = await api.account.registerRaw(buildRegisterDto({ password: 'Short8pw' }));

        expect(response.status()).toBe(400);
        await expect(response).toMatchSchema(ValidationProblemSchema);
        expect((await response.json()).errors).toHaveProperty('Password');
      },
    );

    test(
      '[ID: 115] signing in with a username nobody has answers 401 "Invalid username"',
      { tag: [idTag(115), LAYER_TAG.api, MUTATION_TAG.unmutation] },
      async ({ api }) => {
        const response = await api.account.loginRaw({ username: unknownUsername(), password: TEST_USER_1.password });

        expect(response.status()).toBe(401);
        expect(await response.text()).toBe(API_ERROR.invalidUsername);
      },
    );
  },
);
