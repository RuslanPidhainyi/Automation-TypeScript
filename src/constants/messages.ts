/**
 * Toast texts the Angular client shows through `ngx-toastr`, verbatim
 * (`RulesForWritingTests.md` §9). A message changed in the client then fails
 * exactly the assertions that match it, instead of each spec carrying its own
 * copy of the string.
 */
export const TOAST = {
  postAdded: 'Post added successfully',
  postUpdated: 'Post updated successfully',
  postDeleted: 'Post deleted successfully',
  profileUpdated: 'Profile updated successfully',
  loginFailed: 'Failed to login',
  unauthorised: 'Unauthorised',
  /** `authGuard` refusing a signed-out visitor. */
  signInRequired: 'You shall not pass!',
  /** `adminGuard` refusing a signed-in user who is neither Admin nor Moderator. */
  adminAreaForbidden: 'You cannot enter this area',
  /** `buggy/bad-request`'s plain-string body, shown by `error.interceptor.ts`'s generic branch. */
  badRequest: 'This was not a good request',
} as const;

/**
 * The plain-text bodies the API answers a refused request with, verbatim from
 * `API/Controllers/*.cs` - what `specs/tests/api/` asserts on.
 */
export const API_ERROR = {
  usernameTaken: 'Username is taken',
  invalidUsername: 'Invalid username',
  postCannotBeDeleted: 'This post cannot be deleted',
  cannotLikeOwnPost: 'You cannot like your own post',
  postNotFound: 'Post not found',
  cannotMessageYourself: 'You cannot message yourself',
  cannotSendMessage: 'Cannot send message at this time',
  cannotDeleteMessage: 'Cannot delete this message!',
  userNotFound: 'User not found',
} as const;
