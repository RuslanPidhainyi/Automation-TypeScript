/**
 * Single source of truth for every timeout that is not Playwright's default, in
 * milliseconds (`RulesForWritingTests.md` §8).
 *
 * Every value is scaled by `TIMEOUT_MULTIPLIER` (env, default `1`), so a slower
 * runner - CI, a cold machine - stretches the whole suite at once instead of each
 * spec growing its own magic number. Playwright's defaults (30 s per test, 5 s
 * per `expect`) are never passed explicitly in a spec; `TIMEOUT.test` and
 * `TIMEOUT.expect` exist only so `playwright.config.ts` scales them too.
 *
 * A new constant comes with a JSDoc line naming the operation that is slow and
 * why. A test that is simply slow, with no single operation to blame, calls
 * `test.slow()` instead.
 */
const parsedMultiplier = Number(process.env.TIMEOUT_MULTIPLIER ?? 1);

export const TIMEOUT_MULTIPLIER =
  Number.isFinite(parsedMultiplier) && parsedMultiplier > 0 ? parsedMultiplier : 1;

const scaled = (ms: number): number => Math.round(ms * TIMEOUT_MULTIPLIER);

export const TIMEOUT = {
  /** Playwright's default per-test timeout, scaled - applied once in `playwright.config.ts`. */
  test: scaled(30_000),
  /** Playwright's default `expect` timeout, scaled - applied once in `playwright.config.ts`. */
  expect: scaled(5_000),

  /** A single health probe - the whole health layer has a 30 s budget. */
  healthProbe: scaled(15_000),
  /** An `expect` inside a health probe. */
  healthExpect: scaled(5_000),

  /**
   * A SignalR event that only fires once a second session has signed in and
   * joined the group (read receipt, live delivery) - most of the wait is that
   * session's own sign-in and navigation, not the round trip itself.
   */
  signalR: scaled(15_000),

  /**
   * One round trip through Cloudinary and the database - publishing or deleting a post, uploading, setting
   * main or deleting a photo. A full local run, with three browsers uploading at once, has taken 22 s.
   */
  cloudinaryRoundTrip: scaled(30_000),

  /**
   * A test with several full page loads plus a second session - the admin roles modal, the two SignalR
   * conversations in `testMessaging.spec.ts`. WebKit needs it most.
   */
  slowTest: scaled(60_000),

  /** A test chaining several Cloudinary round trips - Cloudinary slows down under local parallelism. */
  cloudinaryTest: scaled(90_000),

  /**
   * Starting the stack through `webServer` (`START_STACK=1`): `dotnet run`
   * restores, builds, migrates and seeds the database before it listens, and
   * `ng serve` compiles the whole client - minutes on a cold CI runner.
   */
  stackStart: scaled(180_000),
} as const;
