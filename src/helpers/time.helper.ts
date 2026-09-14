const HOUR_MS = 60 * 60 * 1000;

/**
 * A copy of `date` moved forward by `days` and `hours` - e.g. to pin
 * `page.clock` a known distance after a timestamp the API returned.
 */
export function shiftTime(date: Date, { days = 0, hours = 0 }: { days?: number; hours?: number }): Date {
  return new Date(date.getTime() + (days * 24 + hours) * HOUR_MS);
}
