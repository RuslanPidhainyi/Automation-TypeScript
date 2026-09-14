#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * CLI shim so the suite can be driven with the pytest-style flags the team
 * already reaches for. Recognised flags are translated to their
 * @playwright/test equivalent; everything else (a spec path, --project=health,
 * -g, ...) passes straight through untouched.
 *
 *   -v / -s       -> --reporter=list  (the configured 'html' reporter prints
 *                                       nothing while the run is in progress)
 *   -k <pattern>  -> --grep <pattern> (substring/regex match on the test
 *                                       title - not pytest's -k boolean
 *                                       keyword expressions)
 *   --tracing=X   -> --trace=X
 *   --headed      -> passed through unchanged, Playwright already supports it
 *
 * `--all` (npm run test:all) runs every layer in pipeline order, one
 * `playwright test` per phase, and merges the phases into one HTML report:
 *
 *   seed-users -> health -> api + database -> smoke, regression x3, e2e, accessibility, visual, Google Chrome
 *
 * The order comes from the phases, not from the projects' `dependencies` (those
 * chain only on CI), so a red phase does not skip the ones after it - except
 * health: when it fails the stack is down and the rest is skipped. `api` gets a
 * phase before regression and e2e because those change the roles it reads from
 * sign-in tokens (README.md, "The layers"). Each phase writes a blob report,
 * `merge-reports` turns them into playwright-report/ (plus reports/test-ids.* and
 * reports/custom-report/) and `show-report` opens it.
 */
const args = process.argv.slice(2);
const forwarded = [];
let verbose = false;
let all = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--all') {
    all = true;
  } else if (arg === '-v' || arg === '-s') {
    verbose = true;
  } else if (arg === '-k') {
    forwarded.push('--grep', args[++i]);
  } else if (arg.startsWith('--tracing=')) {
    forwarded.push(`--trace=${arg.slice('--tracing='.length)}`);
  } else {
    forwarded.push(arg);
  }
}

// Every --all phase already reports through `list`.
if (verbose && !all) forwarded.push('--reporter=list');

// Invoked as `node cli.js test ...` (not `npx playwright test`) so a pattern
// with spaces (e.g. -k "sign in") reaches Playwright as one argv entry -
// `shell: true` on Windows only concatenates the array back into a string,
// undoing the quoting Node would otherwise take care of.
const cli = path.join(path.dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
const playwright = (cliArgs, env = {}) =>
  spawnSync(process.execPath, [cli, ...cliArgs], { stdio: 'inherit', env: { ...process.env, ...env } }).status ?? 1;

if (!all) process.exit(playwright(['test', ...forwarded]));

const PHASES = [
  { name: 'seed', projects: ['seed-users'] },
  { name: 'health', projects: ['health'] },
  { name: 'api', projects: ['api', 'database'] },
  {
    name: 'ui',
    projects: ['smoke', 'regression-chromium', 'regression-firefox', 'regression-webkit', 'e2e', 'accessibility', 'visual', 'Google Chrome'],
  },
];

const BLOB_DIR = path.resolve(__dirname, '..', 'blob-report');
// merge-reports reads only the .zip files directly inside the folder it is given.
const MERGE_DIR = path.join(BLOB_DIR, 'all');

fs.rmSync(BLOB_DIR, { recursive: true, force: true });
fs.mkdirSync(MERGE_DIR, { recursive: true });

const failed = [];

for (const [index, phase] of PHASES.entries()) {
  console.log(`\n=== ${index + 1}/${PHASES.length} ${phase.name}: ${phase.projects.join(', ')} ===\n`);

  // The blob reporter empties its own output folder when it starts, so every
  // phase writes to a folder of its own and its report is copied out afterwards.
  const outputDir = path.join(BLOB_DIR, phase.name);
  const fileName = `${index + 1}-${phase.name}.zip`;
  const status = playwright(
    [
      'test',
      ...phase.projects.map((project) => `--project=${project}`),
      ...forwarded,
      '--reporter=list,blob',
      // A -k filter may leave a phase without tests; that is not a failure.
      '--pass-with-no-tests',
    ],
    { PLAYWRIGHT_BLOB_OUTPUT_DIR: outputDir, PLAYWRIGHT_BLOB_OUTPUT_NAME: fileName },
  );

  const report = path.join(outputDir, fileName);
  if (fs.existsSync(report)) fs.copyFileSync(report, path.join(MERGE_DIR, fileName));

  if (status !== 0) {
    failed.push(phase.name);
    if (phase.name === 'health') {
      console.error('\nhealth is red - the stack is down, skipping the remaining phases.');
      break;
    }
  }
}

if (fs.readdirSync(MERGE_DIR).length === 0) {
  console.error('\nNo phase produced a report.');
  process.exit(1);
}

console.log('\n=== Merging the phases into playwright-report/ ===\n');
if (playwright(['merge-reports', '--reporter=html,./src/reporters/testIdReporter.ts,./src/reporters/customReport/customReporter.ts', MERGE_DIR], { PLAYWRIGHT_HTML_OPEN: 'never' }) !== 0) {
  process.exit(1);
}

console.log(failed.length ? `\nFailed phases: ${failed.join(', ')}` : '\nEvery phase passed.');
if (playwright(['show-report']) !== 0) {
  console.error(
    '\nCould not serve the report on http://localhost:9323 - most likely a show-report from an earlier run is still' +
      ' open there. It serves playwright-report/ from disk, so reload that tab (or close it and run `npm run report`).',
  );
}
process.exit(failed.length ? 1 : 0);
