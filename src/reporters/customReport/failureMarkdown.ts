import fs from 'fs';
import type { TestCase, TestError, TestResult, TestStep } from '@playwright/test/reporter';
import { describeTitles, formatDuration, repoRelative, stripAnsi } from './format';

export interface FailureMarkdownInput {
  test: TestCase;
  /** The attempt that failed: the last one, or for a flaky test the last one that did not pass. */
  result: TestResult;
  project: string;
  feature: string;
  /** The screenshots and the trace copied into the report, as paths relative to the repository root. */
  savedAttachments: readonly { name: string; path: string }[];
}

/** The ARIA snapshot of the page inside Playwright's `error-context` attachment. */
const PAGE_SNAPSHOT = /```yaml\n([\s\S]*?)\n```/;

/**
 * What the Copy button of a failed test copies: where the test is, its errors
 * with the code around them, the step log of the failed attempt, its console
 * output and the ARIA snapshot of the page when it failed - as Markdown, ready
 * for a bug report or a chat.
 */
export function failureMarkdown({ test, result, project, feature, savedAttachments }: FailureMarkdownInput): string {
  const sections = [
    `# ${oneLine(test.title)}`,
    table([
      ['Status', test.outcome() === 'flaky' ? `${result.status} - passed on a later retry (flaky)` : result.status],
      ['Project', project],
      ['Feature', feature],
      ['File', `\`${repoRelative(test.location.file)}:${test.location.line}\``],
      ['Describe', describeTitles(test).join(' › ') || '-'],
      ['Tags', [...new Set(test.tags)].map((tag) => `\`${tag}\``).join(' ') || '-'],
      ['Attempt', `${result.retry + 1} of ${test.results.length}`],
      ['Started', result.startTime.toISOString()],
      ['Duration', formatDuration(result.duration)],
    ]),
  ];

  const issues = test.annotations.filter((annotation) => annotation.type === 'issue');
  if (issues.length) sections.push('## Product issues', issues.map((issue) => `- ${issue.description ?? ''}`).join('\n'));

  if (result.errors.length) {
    sections.push('## Errors');
    result.errors.forEach((error, index) => {
      if (result.errors.length > 1) sections.push(`### Error ${index + 1}`);
      sections.push(errorSection(error));
    });
  }

  if (result.steps.length) sections.push('## Execution log', stepLines(result.steps, 0).join('\n'));

  const stdout = output(result.stdout);
  if (stdout) sections.push('## stdout', codeBlock(stdout));
  const stderr = output(result.stderr);
  if (stderr) sections.push('## stderr', codeBlock(stderr));

  // The rest of error-context.md repeats the error and the test source already above.
  const errorContext = readText(result.attachments.find((attachment) => attachment.name === 'error-context'));
  const pageSnapshot = errorContext && PAGE_SNAPSHOT.exec(errorContext.replace(/\r\n/g, '\n'))?.[1];
  if (pageSnapshot) sections.push('## Page snapshot', codeBlock(pageSnapshot, 'yaml'));

  if (savedAttachments.length) {
    sections.push('## Attachments', savedAttachments.map((attachment) => `- ${attachment.name}: \`${attachment.path}\``).join('\n'));
  }

  return `${sections.join('\n\n')}\n`;
}

function errorSection(error: TestError): string {
  const parts = [codeBlock(stripAnsi(error.message ?? error.value ?? 'Unknown error'))];
  if (error.location) {
    parts.push(`At \`${repoRelative(error.location.file)}:${error.location.line}:${error.location.column}\``);
  }
  if (error.snippet) parts.push(codeBlock(stripAnsi(error.snippet)));

  // The stack repeats the message before its frames - only the frames are new.
  const frames = stripAnsi(error.stack ?? '')
    .split('\n')
    .filter((line) => /^\s*at /.test(line))
    .map((line) => line.trim());
  if (frames.length) parts.push('Stack:', codeBlock(frames.join('\n')));

  if (error.cause) parts.push('Caused by:', errorSection(error.cause));
  return parts.join('\n\n');
}

/** Every step as a nested list; failed steps and `test.step`s also say where they are. */
function stepLines(steps: readonly TestStep[], depth: number): string[] {
  return steps.flatMap((step) => {
    const mark = step.error ? '❌' : '✅';
    const where =
      step.location && (step.error || step.category === 'test.step')
        ? ` - \`${repoRelative(step.location.file)}:${step.location.line}\``
        : '';
    const line = `${'  '.repeat(depth)}- ${mark} ${oneLine(step.title)} (${formatDuration(step.duration)})${where}`;
    return [line, ...stepLines(step.steps, depth + 1)];
  });
}

function table(rows: readonly [string, string][]): string {
  const cell = (text: string) => text.replace(/\|/g, '\\|');
  return ['| Field | Value |', '| --- | --- |', ...rows.map(([field, value]) => `| ${field} | ${cell(value)} |`)].join('\n');
}

/** A fenced block whose fence is longer than any run of backticks inside it. */
function codeBlock(text: string, language = 'text'): string {
  const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  return `${fence}${language}\n${text}\n${fence}`;
}

function output(chunks: readonly (string | Buffer)[]): string {
  return stripAnsi(chunks.map(String).join('')).trimEnd();
}

function readText(attachment: TestResult['attachments'][number] | undefined): string | undefined {
  if (attachment?.body) return attachment.body.toString('utf8');
  if (attachment?.path && fs.existsSync(attachment.path)) return fs.readFileSync(attachment.path, 'utf8');
  return undefined;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
