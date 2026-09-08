import path from 'path';
import { baseUrl } from '../../src/PageObjects';

/**
 * Everything the specs need to know about *where* the application lives and
 * *who* they may sign in as. Values come from `.env` (loaded by
 * playwright.config.ts); the defaults describe a stock local run, so the suite
 * still works on a machine without a `.env` file.
 */

export interface Credentials {
  username: string;
  password: string;
}

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
 * `https://localhost:5001/api/` - the same value the client compiles in
 * (`Client/src/environments/environment.development.ts` -> `apiUrl`), kept with
 * a trailing slash so `apiUrl('account/login')` reads like the Angular services.
 */
export const API_URL = (process.env.API_URL ?? 'https://localhost:5001/api/').replace(/\/*$/, '/');

/** Builds an absolute API URL from an endpoint, e.g. `posts` or `buggy/auth`. */
export function apiUrl(endpoint: string): string {
  return `${API_URL}${endpoint.replace(/^\/+/, '')}`;
}

/**
 * Seeded member - `API/Data/UserSeedData.json`, created by `Seed.SeedUsers`
 * with the password below and the `Member` role.
 *
 * The seed lower-cases every username on insert (`user.UserName!.ToLower()`),
 * so the API answers `lisa` even when the spec signs in as `Lisa`; compare
 * usernames case-insensitively.
 */
export const MEMBER: Credentials = {
  username: process.env.MEMBER_USER ?? 'Lisa',
  password: process.env.MEMBER_PASSWORD ?? 'Pa$$w0rd2024',
};

/** Seeded administrator - `API/Data/Seed.cs`, holds `Admin` *and* `Moderator`. */
export const ADMIN: Credentials = {
  username: process.env.ADMIN_USER ?? 'admin',
  password: process.env.ADMIN_PASSWORD ?? 'Admin2024',
};

/**
 * Accounts used by the sign-in health probes, one per role, kept distinct
 * from `MEMBER` so a UI/token pair of tests never share a session. Not part
 * of `UserSeedData.json` - must exist in the target database already.
 */

/** No role. */
export const TEST_USER_1: Credentials = {
  username: process.env.TEST_USER_1 ?? 'test_user_1',
  password: process.env.TEST_PASSWORD_1 ?? 'testUser1#1',
};

/** `Member` role. */
export const TEST_USER_2: Credentials = {
  username: process.env.TEST_USER_2 ?? 'test_user_2',
  password: process.env.TEST_PASSWORD_2 ?? 'testUser2#2',
};

/** `Moderator` role. */
export const TEST_USER_3: Credentials = {
  username: process.env.TEST_USER_3 ?? 'test_user_3',
  password: process.env.TEST_PASSWORD_3 ?? 'testUser3#3',
};

/** `Admin` role. */
export const TEST_USER_4: Credentials = {
  username: process.env.TEST_USER_4 ?? 'test_user_4',
  password: process.env.TEST_PASSWORD_4 ?? 'testUser4#4',
};

/** `Moderator` and `Admin` roles. */
export const TEST_USER_5: Credentials = {
  username: process.env.TEST_USER_5 ?? 'test_user_5',
  password: process.env.TEST_PASSWORD_5 ?? 'testUser5#5',
};

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
