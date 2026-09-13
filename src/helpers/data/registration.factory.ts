import type { RegisterData } from '../../PageObjects';
import type { RegisterDto } from '../../models';
import { uniqueSuffix } from './unique.helper';

/**
 * A registration that passes every client-side validator in
 * `register.component.ts`: every field required, the password 9-21 characters
 * and matched by `confirmPassword`.
 *
 * The suite never submits one successfully - `account/register` has no delete
 * endpoint to clean up with - so the unique username only keeps parallel runs
 * from ever colliding on the "Username is taken" path.
 */
export function buildRegistration(overrides: Partial<RegisterData> = {}): RegisterData {
  return {
    gender: 'female',
    username: `reg_user_${uniqueSuffix()}`,
    knownAs: 'Regression Tester',
    // Matches `DatePickerComponent`'s `bsConfig.dateInputFormat: 'DD MMMM YYYY'`.
    dateOfBirth: '10 January 2000',
    city: 'Warsaw',
    country: 'Poland',
    password: 'Regression9Pass',
    confirmPassword: 'Regression9Pass',
    ...overrides,
  };
}

/**
 * The same registration as the API's body - for `api.account.registerRaw`, which
 * skips the form. `dateOfBirth` is an ISO date, not the date picker's display
 * format.
 */
export function buildRegisterDto(overrides: Partial<RegisterDto> = {}): RegisterDto {
  const { username, knownAs, gender, city, country, password } = buildRegistration();
  return { username, knownAs, gender, dateOfBirth: '2000-01-10', city, country, password, ...overrides };
}
