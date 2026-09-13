import dotenv from 'dotenv';
import path from 'path';

/**
 * Loads `.env` into `process.env` as a side effect of being imported.
 *
 * `playwright.config.ts` imports this module before anything else, so every
 * module evaluated after it - including `src/constants/timeouts.ts`, which reads
 * `TIMEOUT_MULTIPLIER` once at load time - already sees the values. A plain
 * `dotenv.config()` call inside the config would run only after all of the
 * config's own imports had been evaluated. Real environment variables (a CI
 * runner's) still win over `.env`, which is dotenv's default.
 */
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
