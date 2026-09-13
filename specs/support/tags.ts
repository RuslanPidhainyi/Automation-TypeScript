/**
 * Tag vocabulary for `test()`/`test.describe()`'s `tag` option (see
 * `RulesForWritingTests.md` §6).
 *
 * Every spec pairs three tags, never hand-typed as string literals: a numeric
 * `@<n>` tag (mirroring the `[ID: n]` in the title), exactly one layer tag
 * matching the folder the file lives in, and exactly one mutation-state tag.
 * A typo (`'@healtCheck'`, a bare identifier like `HEALTHCHECK`) is a compile
 * error this way instead of a tag that silently never matches
 * `--grep`/`--grep-invert`.
 */
export const LAYER_TAG = {
  healthCheck: '@healthCheck',
  smoke: '@smoke',
  regression: '@regression',
  /**
   * `specs/tests/e2e/` - proves a UI action is actually committed to the
   * database, not just echoed back by the API. See `TestCoveragePlan.md` §7.
   */
  e2e: '@e2e',
  /**
   * `specs/tests/api/` - the API on its own: which callers each route lets
   * through, and how it answers a request it refuses. No browser, no client.
   */
  api: '@api',
  /**
   * `specs/tests/database/` - the schema and the invariants the data must keep,
   * read straight from SQL Server. Neither the API nor the client is involved.
   */
  database: '@database',
} as const;

export type LayerTag = (typeof LAYER_TAG)[keyof typeof LAYER_TAG];

/**
 * Whether a test (or every test in a `describe` block) writes, edits, deletes
 * or otherwise changes persisted application state through the UI or the API
 * (`mutation`), or only reads/observes it — including signing in, since a
 * sign-in creates no lasting change to application data (`unmutation`).
 * Independent of the layer tag - a test always carries exactly one of each.
 */
export const MUTATION_TAG = {
  mutation: '@mutation',
  unmutation: '@unmutation',
} as const;

export type MutationTag = (typeof MUTATION_TAG)[keyof typeof MUTATION_TAG];

/** Builds the `@<n>` tag mirroring the `[ID: n]` in the test title, exactly. */
export function idTag(id: number): `@${number}` {
  return `@${id}`;
}
