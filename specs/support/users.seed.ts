import { TravelApi } from '../../src/api/TravelApi';
import { API_ERROR } from '../../src/constants/messages';
import { buildRegisterDto } from '../../src/helpers/data/registration.factory';
import { rolesOf } from '../../src/helpers/jwt.helper';
import { seededAdminCredentials } from './env';
import { expect, test as seed } from './fixtures';
import { PERSONAS } from './personas';

/**
 * The `seed-users` project - makes sure the five test accounts exist and hold
 * exactly the roles `PERSONAS` gives them.
 *
 * The test accounts are not part of the application's seed (`API/Data/Seed.cs`),
 * so on a fresh database - a CI runner's - every layer would fail at its first
 * sign-in. Idempotent: registering an account that exists answers
 * `Username is taken`, and roles that already match are left alone, so where the
 * accounts are set up this changes nothing.
 *
 * `account/register` grants no role and only an Admin may grant one, so this is
 * the one place the suite signs in as a seeded account - the seeded `admin`
 * (`ADMIN_USER` / `ADMIN_PASSWORD`), and only when a role is missing. An account
 * that must hold no role but holds one fails here instead: `admin/edit-roles`
 * refuses an empty list, so the API cannot take its last role away.
 */
for (const [name, { credentials, roles }] of Object.entries(PERSONAS)) {
  seed(`${credentials.username} (${name}) exists with the roles [${roles.join(', ')}]`, async ({ api, request }) => {
    const registration = buildRegisterDto({
      username: credentials.username,
      knownAs: credentials.username,
      password: credentials.password,
    });
    const registered = await api.account.registerRaw(registration);
    if (!registered.ok()) {
      expect(await registered.text(), `registering ${credentials.username}`).toBe(API_ERROR.usernameTaken);
    }

    const expected = [...roles].sort();
    const held = rolesOf((await api.account.login(credentials)).token).sort();
    if (held.join() === expected.join()) return;

    expect(expected, `${credentials.username} holds [${held.join(', ')}], which the API cannot take away`).not.toEqual([]);
    const admin = await TravelApi.signedIn(request, seededAdminCredentials());
    await admin.admin.editRoles(credentials.username, expected);

    const granted = rolesOf((await api.account.login(credentials)).token).sort();
    expect(granted, `the roles of ${credentials.username}`).toEqual(expected);
  });
}
