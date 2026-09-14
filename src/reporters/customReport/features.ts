/**
 * The application feature each spec exercises - the rows of the custom report's
 * "By feature" table. A feature gathers its specs from every layer (health,
 * smoke, regression, api, e2e), matched by their path under `specs/tests/`;
 * the first feature that lists a prefix of the path wins. A new spec no prefix
 * matches is counted under `Other` - add it here.
 */
export const FEATURES: readonly { name: string; paths: readonly string[] }[] = [
  { name: 'Stack health', paths: ['healthCheck/testApi.', 'healthCheck/testApp.'] },
  { name: 'Authentication', paths: ['healthCheck/testAuth.', 'smoke/testAuth.', 'regression/auth/', 'api/testAccount.'] },
  {
    name: 'Offers',
    paths: ['smoke/testAddOffer.', 'smoke/testOffers.', 'regression/offers/', 'api/testPosts.', 'e2e/testOffersDb.'],
  },
  { name: 'Profile & photos', paths: ['smoke/testProfile.', 'regression/profileAndPhotos/', 'e2e/testProfileDb.'] },
  {
    name: 'Likes & lists',
    paths: ['smoke/testLikes.', 'regression/likesAndLists/', 'api/testLikes.', 'e2e/testLikesDb.'],
  },
  { name: 'Messaging', paths: ['smoke/testMessages.', 'regression/messaging/', 'api/testMessages.'] },
  { name: 'Administration', paths: ['smoke/testAdmin.', 'regression/admin/', 'api/testAdmin.', 'e2e/testRolesDb.'] },
  { name: 'Guards & errors', paths: ['regression/guardsAndErrors/', 'api/testAuthorizationMatrix.'] },
  { name: 'Navigation', paths: ['smoke/testNavigation.'] },
  { name: 'Database integrity', paths: ['database/'] },
  { name: 'Accessibility', paths: ['accessibility/'] },
  { name: 'Visual', paths: ['visual/'] },
];

/** The `seed-users`, `setup` and `agents` projects - `specs/support/` and `test-plans/`. */
export const SETUP_FEATURE = 'Test setup';
export const OTHER_FEATURE = 'Other';

const SPECS_DIR = 'specs/tests/';
const SETUP_DIRS = /(^|\/)(specs\/support|test-plans)\//;

/** The feature of the spec `file` - a path relative to the repository root, with forward slashes. */
export function featureOf(file: string): string {
  const specsDir = file.indexOf(SPECS_DIR);
  if (specsDir === -1) return SETUP_DIRS.test(file) ? SETUP_FEATURE : OTHER_FEATURE;

  const specPath = file.slice(specsDir + SPECS_DIR.length);
  return FEATURES.find((feature) => feature.paths.some((prefix) => specPath.startsWith(prefix)))?.name ?? OTHER_FEATURE;
}

/** The features among `names`, in the order of `FEATURES`, with setup and `Other` last. */
export function featuresInOrder(names: readonly string[]): string[] {
  const present = new Set(names);
  return [...FEATURES.map((feature) => feature.name), SETUP_FEATURE, OTHER_FEATURE].filter((name) => present.has(name));
}
