import path from 'path';
import type { Suite, TestCase } from '@playwright/test/reporter';

const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, 'g');

/** Removes the ANSI colour codes Playwright writes into error messages and code snippets. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE, '');
}

/** An absolute path relative to the working directory - the repository root - with forward slashes. */
export function repoRelative(file: string): string {
  return path.relative(process.cwd(), file).replace(/\\/g, '/');
}

/** `850 ms`, `12.3 s`, `4 min 5 s`. A step that never finished reports a negative duration: `-`. */
export function formatDuration(ms: number): string {
  if (ms < 0) return '-';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

/** The titles of the `describe` blocks around a test, outermost first. */
export function describeTitles(test: TestCase): string[] {
  const titles: string[] = [];
  for (let suite: Suite | undefined = test.parent; suite?.type === 'describe'; suite = suite.parent) {
    titles.unshift(suite.title);
  }
  return titles;
}
