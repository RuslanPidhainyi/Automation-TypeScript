import { randomUUID } from 'crypto';

/**
 * Collision-free suffix for data a test creates and has to find again. A bare
 * `Date.now()` is not enough once regression runs three browsers in parallel
 * under the same account - two workers can land on the same millisecond, and a
 * cleanup that looks data up by name would then remove the other worker's row.
 *
 * Digits and lower-case hex only, so it is safe inside a username as well.
 */
export function uniqueSuffix(): string {
  return `${Date.now()}${randomUUID().slice(0, 8)}`;
}

/** `<prefix> <uniqueSuffix>` - a post title or message body that a cleanup can look up again. */
export function uniqueName(prefix: string): string {
  return `${prefix} ${uniqueSuffix()}`;
}

/** A username no account has - for requests that must find nobody. */
export function unknownUsername(): string {
  return `nobody_${uniqueSuffix()}`;
}
