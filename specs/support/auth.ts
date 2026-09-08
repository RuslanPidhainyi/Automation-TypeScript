import path from 'path';
import { ADMIN, Credentials, MEMBER } from './env';

/**
 * Signed-in browser state, produced once per run by the `setup` project
 * (`auth.setup.ts`) and reused by every spec that only needs *to be* someone.
 *
 * The client keeps its session entirely in `localStorage` under the key `user`
 * (`_services/account.service.ts` -> `setCurrentUser`), and `AppComponent.ngOnInit`
 * restores it on every load - so a saved `storageState` is a complete session,
 * no cookies involved.
 *
 * A spec opts in per file, which keeps the anonymous specs (login, register,
 * guards) free to run in the same project:
 *
 *   test.use({ storageState: STORAGE_STATE.member });
 *
 * The files live under `playwright/.auth/`, which is git-ignored.
 */
export const STORAGE_STATE = {
  member: path.resolve(__dirname, '../../playwright/.auth/member.json'),
  admin: path.resolve(__dirname, '../../playwright/.auth/admin.json'),
} as const;

/** The roles the setup project signs in as. */
export type AuthRole = keyof typeof STORAGE_STATE;

/** Credentials behind each saved state. */
export const CREDENTIALS: Record<AuthRole, Credentials> = {
  member: MEMBER,
  admin: ADMIN,
};
