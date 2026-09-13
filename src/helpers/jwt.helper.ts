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
