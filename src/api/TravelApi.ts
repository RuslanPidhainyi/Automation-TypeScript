import { APIRequestContext } from '@playwright/test';
import { Credentials } from '../models';
import { AccountController } from './controllers/AccountController';
import { AdminController } from './controllers/AdminController';
import { BuggyController } from './controllers/BuggyController';
import { LikesController } from './controllers/LikesController';
import { MessagesController } from './controllers/MessagesController';
import { PostsController } from './controllers/PostsController';
import { UsersController } from './controllers/UsersController';
import { HttpClient } from './HttpClient';

/**
 * The .NET API as the suite sees it - one controller per `API/Controllers/*.cs`,
 * all sharing one caller:
 *
 *   const api = await TravelApi.signedIn(request, TEST_USER_2);
 *   await api.posts.deleteByTitle(TEST_USER_2.username, title);
 *
 * Specs do not build one themselves; they take the `api` / `apiAs(persona)`
 * fixtures from `specs/support/fixtures.ts`.
 */
export class TravelApi {
  readonly account: AccountController;
  readonly posts: PostsController;
  readonly likes: LikesController;
  readonly messages: MessagesController;
  readonly users: UsersController;
  readonly admin: AdminController;
  readonly buggy: BuggyController;

  /** @param token bearer token to send; omit for an anonymous caller. */
  constructor(request: APIRequestContext, token?: string) {
    const http = new HttpClient(request, token);
    this.account = new AccountController(http);
    this.posts = new PostsController(http);
    this.likes = new LikesController(http);
    this.messages = new MessagesController(http);
    this.users = new UsersController(http);
    this.admin = new AdminController(http);
    this.buggy = new BuggyController(http);
  }

  /** Signs `credentials` in and returns a client that calls the API as that user. */
  static async signedIn(request: APIRequestContext, credentials: Credentials): Promise<TravelApi> {
    const user = await new TravelApi(request).account.login(credentials);
    return new TravelApi(request, user.token);
  }
}
