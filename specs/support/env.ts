import path from 'path';
import type { Credentials } from '../../src/models';
import { baseUrl } from '../../src/PageObjects';

export type { Credentials } from '../../src/models';
export { apiUrl } from '../../src/api/HttpClient';

/**
 * Everything the specs need to know about *where* the application lives and
 * *who* they may sign in as. Values come from `.env` in the project root - the
 * only env file - loaded by `src/helpers/loadEnv.helper.ts`.
 *
 * Specs sign in only as the test accounts `TEST_USER_1`..`TEST_USER_5` below
 * (also available by role as `PERSONAS`, `personas.ts`). The seeded accounts
 * `.env` also lists (Lisa, Bob, admin - `API/Data/Seed.cs`) are kept for manual
 * runs; no spec signs in as them, so the suite never leaves data behind on the
 * accounts a real visitor sees.
 */

/** How the `setup` project signs in - see `auth.setup.ts`. */
export type AuthStrategy = 'ui' | 'token';

/**
 * `ui` clicks through the login form; `token` calls `account/login` directly
 * and plants the response into `localStorage`, skipping the browser for the
 * sign-in itself. Defaults to `ui` - the state it produces is exactly what
 * the client itself writes, `token` trades that guarantee for speed.
 */
export const AUTH_STRATEGY: AuthStrategy = process.env.AUTH_STRATEGY === 'token' ? 'token' : 'ui';

/** `https://localhost:4200` - resolved by the page-object layer from `BASE_URL`. */
export const CLIENT_URL = baseUrl();

/**
 * Reads a key that must be set in `.env`. Fails as soon as the specs load,
 * naming the missing key, instead of falling back to a hard-coded default that
 * may not exist in the target database.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not set - add it to .env in the project root`);
  }
  return value;
}

function credentialsFromEnv(usernameKey: string, passwordKey: string): Credentials {
  return { username: requireEnv(usernameKey), password: requireEnv(passwordKey) };
}

/*
 * The test accounts, one per role combination. They are not part of
 * `UserSeedData.json` and must already exist in the target database, which
 * stores usernames lower-cased - compare them case-insensitively.
 */

/** No role. Also the account the empty-state checks rely on: it never likes or publishes anything. */
export const TEST_USER_1 = credentialsFromEnv('TEST_USER_1', 'TEST_PASSWORD_1');

/** `Member` role - persona `member`, with a saved session. */
export const TEST_USER_2 = credentialsFromEnv('TEST_USER_2', 'TEST_PASSWORD_2');

/** `Moderator` role - persona `moderator`. */
export const TEST_USER_3 = credentialsFromEnv('TEST_USER_3', 'TEST_PASSWORD_3');

/** `Admin` role - persona `admin`. */
export const TEST_USER_4 = credentialsFromEnv('TEST_USER_4', 'TEST_PASSWORD_4');

/** `Moderator` and `Admin` roles - persona `adminModerator`, with a saved session. */
export const TEST_USER_5 = credentialsFromEnv('TEST_USER_5', 'TEST_PASSWORD_5');

/**
 * The seeded `admin` account (`API/Data/Seed.cs`). No spec signs in as it - only
 * `users.seed.ts` does, to grant the test accounts their roles on a database
 * that has none. Read on demand, so a run that never needs it needs neither key.
 */
export function seededAdminCredentials(): Credentials {
  return credentialsFromEnv('ADMIN_USER', 'ADMIN_PASSWORD');
}

/**
 * Files under `specs/fixtures/`, as absolute paths - `setInputFiles` resolves
 * a relative path against the process working directory, which is not the same
 * thing as the spec's directory.
 *
 * `photo` feeds both uploaders (`add-offer` and the profile photo editor); both
 * are configured with `allowedFileType: ['image']` and a 10 MB cap.
 */
export const FIXTURES = {
  photo: path.resolve(__dirname, '../fixtures/travel-photo.jpg'),
} as const;
