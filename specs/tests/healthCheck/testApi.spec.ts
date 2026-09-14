import { ENDPOINTS } from '../../../src/constants/endpoints';
import { ApiExceptionSchema } from '../../../src/models';
import {
  decodeJwt,
  expect,
  idTag,
  LAYER_TAG,
  MUTATION_TAG,
  rolesOf,
  test,
  TEST_USER_2,
  TEST_USER_5,
} from '../../support';

/**
 * Health layer - the .NET API side.
 *
 * Answers one question: *is the stack up and is the contract intact?* No
 * business scenario, no browser - every probe goes straight to
 * `https://localhost:5001/api/` through the `api` fixture, whose `request`
 * inherits `ignoreHTTPSErrors` from playwright.config.ts (the API also serves a
 * self-signed certificate). Every typed call validates the response body
 * against its zod schema, so a broken contract fails here first.
 *
 * A red spec here means smoke and regression cannot possibly be meaningful, so
 * this layer gates them.
 */
test.describe(
  'Tests verify API health',
  { tag: [LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 10] test_user_2 like Member role receives a JWT from account/login',
      { tag: [idTag(10), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
      async ({ api }) => {
        const user = await api.account.login(TEST_USER_2);

        // The database stores every username lower-cased.
        expect(user.username.toLowerCase()).toBe(TEST_USER_2.username.toLowerCase());
        expect(user.knownAs).toBeTruthy();
        expect(decodeJwt(user.token), `"${user.token}" is not a JWT`).not.toBeNull();
        expect(decodeJwt(user.token)?.unique_name?.toLowerCase()).toBe(TEST_USER_2.username.toLowerCase());
        expect(rolesOf(user.token)).toContain('Member');
      },
    );

    test(
      '[ID: 11] test_user_5 like Admin and Moderator role receives a token carrying both roles',
      { tag: [idTag(11), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
      async ({ api }) => {
        // The roles themselves are created by `Seed.SeedUsers`, so this probe also
        // proves Admin and Moderator exist - regression promotes test users through them.
        const user = await api.account.login(TEST_USER_5);

        expect(rolesOf(user.token)).toEqual(expect.arrayContaining(['Admin', 'Moderator']));
      },
    );

    test(
      '[ID: 12] account/login refuses a wrong password with 401',
      { tag: [idTag(12), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
      async ({ api }) => {
        const response = await api.account.loginRaw({
          username: TEST_USER_2.username,
          password: 'definitely-not-the-password',
        });

        expect(response.status()).toBe(401);
      },
    );

    test(
      '[ID: 13] posts is closed to anonymous callers',
      { tag: [idTag(13), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
      async ({ api }) => {
        const response = await api.posts.listRaw();

        expect(response.status()).toBe(401);
      },
    );

    test(
      '[ID: 14] posts answers a signed-in caller with the seeded data',
      { tag: [idTag(14), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
      async ({ apiAs }) => {
        const api = await apiAs('member');

        // Reaches the database through the repository, so an empty list means the
        // seed did not run - every other layer builds on it.
        const posts = await api.posts.list();
        expect(posts.length).toBeGreaterThan(0);
      },
    );

    /**
     * `BuggyController` returns deterministic status codes - the ideal probe for
     * the error pipeline the client relies on (`_interceptors/error.interceptor.ts`
     * turns 404 into `/not-found` and 500 into `/server-error`).
     *
     * `not-found` and `server-error` both run `context.Users.Find(-1)`, so a 404
     * here is also proof that the database answers; when it does not, the
     * exception middleware turns the failure into a 500 and this probe fails.
     */
    const probes = [
      { id: 15, endpoint: ENDPOINTS.buggy.notFound, status: 404 },
      { id: 16, endpoint: ENDPOINTS.buggy.serverError, status: 500 },
      { id: 17, endpoint: ENDPOINTS.buggy.badRequest, status: 400 },
      { id: 18, endpoint: ENDPOINTS.buggy.auth, status: 401 }, // [Authorize], called without a token
    ];

    for (const { id, endpoint, status } of probes) {
      test(
        `[ID: ${id}] GET ${endpoint} answers ${status}`,
        { tag: [idTag(id), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
        async ({ api }) => {
          const response = await api.buggy.getRaw(endpoint);

          expect(response.status()).toBe(status);
        },
      );
    }

    test(
      '[ID: 19] an unhandled exception is served as the ApiException contract',
      { tag: [idTag(19), LAYER_TAG.healthCheck, MUTATION_TAG.unmutation] },
      async ({ api }) => {
        // `ExceptionMiddleware` serialises `ApiException` in camelCase; the client's
        // error interceptor reads `error.message` off exactly this shape.
        const response = await api.buggy.getRaw(ENDPOINTS.buggy.serverError);

        expect(response.status()).toBe(500);
        expect(response.headers()['content-type']).toContain('application/json');

        await expect(response).toMatchSchema(ApiExceptionSchema);
        const body = await response.json();
        expect(body.statusCode).toBe(500);
        expect(body.message).toBeTruthy();
      },
    );
  },
);
