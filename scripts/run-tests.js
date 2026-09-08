#!/usr/bin/env node
'use strict';

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
 */
const args = process.argv.slice(2);
const forwarded = [];
let verbose = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '-v' || arg === '-s') {
    verbose = true;
  } else if (arg === '-k') {
    forwarded.push('--grep', args[++i]);
  } else if (arg.startsWith('--tracing=')) {
    forwarded.push(`--trace=${arg.slice('--tracing='.length)}`);
  } else {
    forwarded.push(arg);
  }
}

if (verbose) forwarded.push('--reporter=list');

// Invoked as `node cli.js test ...` (not `npx playwright test`) so a pattern
// with spaces (e.g. -k "sign in") reaches Playwright as one argv entry -
// `shell: true` on Windows only concatenates the array back into a string,
// undoing the quoting Node would otherwise take care of.
const cli = path.join(path.dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
const result = spawnSync(process.execPath, [cli, 'test', ...forwarded], { stdio: 'inherit' });
process.exit(result.status ?? 1);
