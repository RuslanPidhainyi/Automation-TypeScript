/**
 * Every route of the .NET API the suite knows, relative to `API_URL` and checked
 * against `API/Controllers/*.cs`. Specs never spell a route out: the controllers
 * in `src/api/` build every request from these.
 */
export const ENDPOINTS = {
  account: {
    login: 'account/login',
    register: 'account/register',
  },
  posts: {
    list: 'posts',
    byId: (id: number) => `posts/${id}`,
    byUser: (username: string) => `posts/user/${username}`,
    /** Multipart: the `PostDto` fields plus `file`. */
    add: 'posts/add-post',
    edit: (id: number) => `posts/edit-post/${id}`,
    remove: (id: number) => `posts/delete-post/${id}`,
  },
  likes: {
    toggle: (postId: number) => `likes/${postId}`,
    ids: 'likes/list',
    /** `?predicate=` */
    posts: 'likes',
  },
  messages: {
    send: 'messages',
    /** `?container=Inbox|Outbox|Unread` */
    container: 'messages',
    thread: (username: string) => `messages/thread/${username}`,
    remove: (id: number) => `messages/${id}`,
  },
  users: {
    list: 'users',
    byUsername: (username: string) => `users/${username}`,
    update: 'users',
    addPhoto: 'users/add-photo',
    setMainPhoto: (photoId: number) => `users/set-main-photo/${photoId}`,
    deletePhoto: (photoId: number) => `users/delete-photo/${photoId}`,
  },
  admin: {
    usersWithRoles: 'admin/users-with-roles',
    /** `?roles=A,B` */
    editRoles: (username: string) => `admin/edit-roles/${username}`,
    contentsToModerate: 'admin/contents-to-moderate',
  },
  buggy: {
    auth: 'buggy/auth',
    notFound: 'buggy/not-found',
    serverError: 'buggy/server-error',
    badRequest: 'buggy/bad-request',
  },
} as const;

/** One of the deterministic `BuggyController` probes. */
export type BuggyEndpoint = (typeof ENDPOINTS.buggy)[keyof typeof ENDPOINTS.buggy];
