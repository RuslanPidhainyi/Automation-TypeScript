/**
 * Product defects the suite caught, attached to the tests that caught them as
 * `issue` annotations. The HTML report shows them on the test, and
 * `reports/test-ids.json` / `.csv` (`src/reporters/testIdReporter.ts`) list them
 * per `[ID: n]`.
 *
 *   test('[ID: 32] ...', { tag: [...], annotation: issuesOf(32) }, async () => { ... });
 */
const APP_REPOSITORY = 'https://github.com/RuslanPidhainyi/EW-TravelApp-.Net8-Angular17';

/** The shape of Playwright's test annotation, narrowed to the `issue` type. */
export interface ProductIssue {
  type: 'issue';
  description: string;
}

function productIssue(summary: string, link: string): ProductIssue {
  return { type: 'issue', description: `${summary} - ${link}` };
}

export const PRODUCT_ISSUE = {
  likesWithoutAuthorize: productIssue(
    'Fixed: LikesController had no [Authorize], so an anonymous likes call answered 500',
    `${APP_REPOSITORY}/commit/55fccce57ccc951fd19855d24ef9c4f88f9c2c62`,
  ),
  updatePostWithoutOwnerCheck: productIssue(
    'Fixed: PostsController.UpdatePost did not check the owner, so any member could edit any post',
    `${APP_REPOSITORY}/commit/55fccce57ccc951fd19855d24ef9c4f88f9c2c62`,
  ),
  messageSentBeforeHubConnected: productIssue(
    'Fixed on EW-021: Send was enabled before the SignalR message hub connected, so a quick message was silently lost',
    `${APP_REPOSITORY}/tree/EW-021`,
  ),
  photoUploadFailedSilently: productIssue(
    'Fixed on EW-021: photo-editor had no onErrorItem, so a refused upload showed the member no message',
    `${APP_REPOSITORY}/blob/EW-021/Client/src/app/member/photo-editor/photo-editor.component.ts`,
  ),
  lastActiveFailedConcurrentRequest: productIssue(
    'Fixed on EW-021: LogUserActivity saved LastActive through a stale tracked user, so a request answered 500 when the user changed meanwhile - a photo upload while an admin edited the roles',
    `${APP_REPOSITORY}/blob/EW-021/API/Helpers/LogUserActivity.cs`,
  ),
  accessibilityViolations: productIssue(
    'Fixed on EW-021: axe-core found WCAG and best-practice violations on every screen',
    `${APP_REPOSITORY}/tree/EW-021`,
  ),
} as const;

/** `specs/tests/accessibility/` - every screen had violations before the fix. */
const ACCESSIBILITY_TEST_IDS = [137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157];

const ISSUES_BY_ID: Partial<Record<number, readonly ProductIssue[]>> = {
  32: [PRODUCT_ISSUE.messageSentBeforeHubConnected],
  60: [PRODUCT_ISSUE.lastActiveFailedConcurrentRequest],
  93: [PRODUCT_ISSUE.likesWithoutAuthorize],
  97: [PRODUCT_ISSUE.likesWithoutAuthorize],
  118: [PRODUCT_ISSUE.updatePostWithoutOwnerCheck],
  136: [PRODUCT_ISSUE.photoUploadFailedSilently],
  ...Object.fromEntries(ACCESSIBILITY_TEST_IDS.map((id) => [id, [PRODUCT_ISSUE.accessibilityViolations]])),
};

/** The issues the test `[ID: id]` caught - an empty list for most tests. */
export function issuesOf(id: number): ProductIssue[] {
  return [...(ISSUES_BY_ID[id] ?? [])];
}
