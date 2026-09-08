import { APIRequestContext, APIResponse } from '@playwright/test';
import { apiUrl, Credentials } from './env';

/**
 * `UserDto` as the API returns it (`API/DTOs/UserDto.cs`, camel-cased by the
 * default `System.Text.Json` policy).
 */
export interface UserDto {
  username: string;
  token: string;
  knownAs: string;
  generalPhotoUrl?: string | null;
}

/**
 * Thin wrapper over the Playwright `request` fixture for talking to the .NET
 * API directly - health probes, fixture data and cleanup that has no business
 * being clicked through the UI.
 *
 * Everything except `account/*` and the unauthenticated `buggy/*` probes sits
 * behind `[Authorize]`, so the calls take an optional bearer token:
 *
 *   const api = new ApiClient(request);
 *   const token = await api.authenticate(MEMBER);
 *   const posts = await api.get('posts', token);
 *
 * The methods return the raw `APIResponse` on purpose - a health spec asserts
 * on status codes, and swallowing a non-2xx here would hide exactly what it is
 * looking for. Use `authenticate()` when the call must succeed.
 */
export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  // -------------------------------------------------------------- account

  /** `POST account/login`. Returns the response as-is, including 401s. */
  login(credentials: Credentials): Promise<APIResponse> {
    return this.request.post(apiUrl('account/login'), { data: credentials });
  }

  /** Signs in and returns the JWT; throws when the API refuses the credentials. */
  async authenticate(credentials: Credentials): Promise<string> {
    const response = await this.login(credentials);

    if (!response.ok()) {
      throw new Error(
        `Login as "${credentials.username}" failed: ${response.status()} ${await response.text()}`,
      );
    }

    const user = (await response.json()) as UserDto;
    return user.token;
  }

  // ---------------------------------------------------------------- verbs

  get(endpoint: string, token?: string): Promise<APIResponse> {
    return this.request.get(apiUrl(endpoint), { headers: authHeader(token) });
  }

  post(endpoint: string, data?: unknown, token?: string): Promise<APIResponse> {
    return this.request.post(apiUrl(endpoint), { data, headers: authHeader(token) });
  }

  put(endpoint: string, data?: unknown, token?: string): Promise<APIResponse> {
    return this.request.put(apiUrl(endpoint), { data, headers: authHeader(token) });
  }

  delete(endpoint: string, token?: string): Promise<APIResponse> {
    return this.request.delete(apiUrl(endpoint), { headers: authHeader(token) });
  }
}

function authHeader(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Claims `TokenService.CreateToken` puts into the token. `JwtSecurityTokenHandler`
 * shortens the `ClaimTypes.*` URIs on the way out, hence `nameid` / `unique_name`
 * / `role`; `role` is a bare string for a single role and an array for several.
 */
export interface JwtPayload {
  nameid?: string;
  unique_name?: string;
  role?: string | string[];
  exp?: number;
  [claim: string]: unknown;
}

/** Decodes the payload of a JWT; returns `null` when the string is not one. */
export function decodeJwt(token: string): JwtPayload | null {
  const segments = token.split('.');
  if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) return null;

  try {
    return JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as JwtPayload;
  } catch {
    return null;
  }
}

/** Roles carried by a token, always as a list. */
export function rolesOf(token: string): string[] {
  const role = decodeJwt(token)?.role;
  if (!role) return [];
  return Array.isArray(role) ? role : [role];
}
