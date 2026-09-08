import { expect, test } from '@playwright/test';
import { ADMIN, ApiClient, decodeJwt, MEMBER, rolesOf, UserDto } from '../../support';

/**
 * Health layer - the .NET API side.
 *
 * Answers one question: *is the stack up and is the contract intact?* No
 * business scenario, no browser - every probe goes straight to
 * `https://localhost:5001/api/` through the `request` fixture, which inherits
 * `ignoreHTTPSErrors` from playwright.config.ts (the API also serves a
 * self-signed certificate).
 *
 * A red spec here means smoke and regression cannot possibly be meaningful, so
 * this layer gates them.
 */
test.describe('API health', () => {
  test('a seeded member receives a JWT from account/login', async ({ request }) => {
    const response = await new ApiClient(request).login(MEMBER);

    expect(response.status()).toBe(200);

    const user = (await response.json()) as UserDto;

    // `Seed.SeedUsers` lower-cases every seeded username before insert.
    expect(user.username.toLowerCase()).toBe(MEMBER.username.toLowerCase());
    expect(user.knownAs).toBeTruthy();
    expect(decodeJwt(user.token), `"${user.token}" is not a JWT`).not.toBeNull();
    expect(decodeJwt(user.token)?.unique_name?.toLowerCase()).toBe(MEMBER.username.toLowerCase());
    expect(rolesOf(user.token)).toContain('Member');
  });

  test('the seeded administrator receives a token carrying Admin and Moderator', async ({
    request,
  }) => {
    // The role claims come from the seed, so this probe also proves the three
    // roles exist - regression promotes members through them.
    const token = await new ApiClient(request).authenticate(ADMIN);

    expect(rolesOf(token)).toEqual(expect.arrayContaining(['Admin', 'Moderator']));
  });

  test('account/login refuses a wrong password with 401', async ({ request }) => {
    const response = await new ApiClient(request).login({
      username: MEMBER.username,
      password: 'definitely-not-the-password',
    });

    expect(response.status()).toBe(401);
  });

  test('posts is closed to anonymous callers', async ({ request }) => {
    const response = await new ApiClient(request).get('posts');

    expect(response.status()).toBe(401);
  });

  test('posts answers a signed-in caller with the seeded data', async ({ request }) => {
    const api = new ApiClient(request);
    const token = await api.authenticate(MEMBER);

    const response = await api.get('posts', token);

    expect(response.status()).toBe(200);

    // Reaches the database through the repository, so an empty list means the
    // seed did not run - every other layer builds on it.
    const posts = (await response.json()) as unknown[];
    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
  });

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
    { endpoint: 'buggy/not-found', status: 404 },
    { endpoint: 'buggy/server-error', status: 500 },
    { endpoint: 'buggy/bad-request', status: 400 },
    { endpoint: 'buggy/auth', status: 401 }, // [Authorize], called without a token
  ];

  for (const { endpoint, status } of probes) {
    test(`GET ${endpoint} answers ${status}`, async ({ request }) => {
      const response = await new ApiClient(request).get(endpoint);

      expect(response.status()).toBe(status);
    });
  }

  test('an unhandled exception is served as the ApiException contract', async ({ request }) => {
    // `ExceptionMiddleware` serialises `ApiException` in camelCase; the client's
    // error interceptor reads `error.message` off exactly this shape.
    const response = await new ApiClient(request).get('buggy/server-error');

    expect(response.status()).toBe(500);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = (await response.json()) as { statusCode: number; message: string };
    expect(body.statusCode).toBe(500);
    expect(body.message).toBeTruthy();
  });
});
