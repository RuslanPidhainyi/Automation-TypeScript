import { APIResponse } from '@playwright/test';
import { ENDPOINTS } from '../../constants/endpoints';
import { Credentials, RegisterDto, UserDto, UserDtoSchema } from '../../models';
import { HttpClient } from '../HttpClient';

/** `API/Controllers/AccountController.cs`. */
export class AccountController {
  constructor(private readonly http: HttpClient) {}

  /**
   * `POST account/register`, as-is - a taken username answers 400 with a plain
   * message, a field that breaks `RegisterDto`'s annotations 400 with a
   * `ValidationProblem`. There is no typed variant: the API has no endpoint to
   * delete an account again, so the suite never registers one for real.
   */
  registerRaw(registration: RegisterDto): Promise<APIResponse> {
    return this.http.post(ENDPOINTS.account.register, registration);
  }

  /** `POST account/login`, as-is - an unknown username or a wrong password answers 401. */
  loginRaw(credentials: Credentials): Promise<APIResponse> {
    return this.http.post(ENDPOINTS.account.login, credentials);
  }

  /** Signs in and returns the validated `UserDto`, token included. */
  async login(credentials: Credentials): Promise<UserDto> {
    return this.http.parse(await this.loginRaw(credentials), UserDtoSchema);
  }
}
