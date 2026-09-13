import path from 'path';
import type { Credentials } from '../../src/models';
import { PERSONAS } from './personas';

/**
 * Signed-in browser state, produced once per run by the `setup` project
 * (`auth.setup.ts`) and reused by every spec that only needs *to be* someone.
 *
 * The client keeps its session entirely in `localStorage` under the key `user`
 * (`_services/account.service.ts` -> `setCurrentUser`), and `AppComponent.ngOnInit`
 * restores it on every load - so a saved `storageState` is a complete session,
 * no cookies involved.
 *
 * A spec opts in per file or `describe` block through the `persona` fixture
 * option, which keeps the anonymous specs (login, register, guards) free to run
 * in the same project:
 *
 *   test.use({ persona: 'member' });
 *
 * The files live under `playwright/.auth/`, which is git-ignored.
 */
export const STORAGE_STATE = {
  member: path.resolve(__dirname, '../../playwright/.auth/member.json'),
  adminModerator: path.resolve(__dirname, '../../playwright/.auth/admin-moderator.json'),
} as const;

/** The personas the setup project saves a session for - the names match `PERSONAS`. */
export type AuthRole = keyof typeof STORAGE_STATE;

/** Credentials behind each saved state. */
export const CREDENTIALS: Record<AuthRole, Credentials> = {
  member: PERSONAS.member.credentials,
  adminModerator: PERSONAS.adminModerator.credentials,
};
