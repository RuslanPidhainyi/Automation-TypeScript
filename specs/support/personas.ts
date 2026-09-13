import type { Credentials } from '../../src/models';
import { TEST_USER_1, TEST_USER_2, TEST_USER_3, TEST_USER_4, TEST_USER_5 } from './env';

export interface Persona {
  credentials: Credentials;
  /** The roles the account holds - documentation for whoever picks a persona. */
  roles: readonly string[];
}

/**
 * The test accounts, named after what they may do. `member` and
 * `adminModerator` also have a saved session (`auth.ts`, `test.use({ persona })`);
 * every persona can sign in on demand through the `apiAs` / `pageAs` fixtures.
 */
export const PERSONAS = {
  noRole: { credentials: TEST_USER_1, roles: [] },
  member: { credentials: TEST_USER_2, roles: ['Member'] },
  moderator: { credentials: TEST_USER_3, roles: ['Moderator'] },
  admin: { credentials: TEST_USER_4, roles: ['Admin'] },
  adminModerator: { credentials: TEST_USER_5, roles: ['Admin', 'Moderator'] },
} as const satisfies Record<string, Persona>;

export type PersonaName = keyof typeof PERSONAS;

/** Who an API call is made as: one of the personas, or nobody signed in at all. */
export type Caller = PersonaName | 'anonymous';
