import { Page, Request } from '@playwright/test';
import { apiUrl } from '../../api/HttpClient';
import { ENDPOINTS } from '../../constants/endpoints';
import { API_ERROR } from '../../constants/messages';
import type { PostDto } from '../../models';
import { buildPostDto } from '../data/post.factory';

/** What a stubbed route sends back: a JSON body, or the plain text the API refuses a request with. */
interface StubAnswer {
  status: number;
  body: object | string;
}

/** A route the stub answers in place of the API. */
export interface StubbedCall {
  /** The first request the stub answered, resolved once its answer has been sent. */
  readonly request: Promise<Request>;
}

/** The fields and files of a `multipart/form-data` request body. */
export interface MultipartBody {
  fields: Record<string, string>;
  /** Form field -> name of the file uploaded under it. */
  fileNames: Record<string, string>;
}

/**
 * Answers the API's upload routes inside the browser, so a UI-only check never
 * reaches Cloudinary.
 *
 * The upload itself happens on the server (`PhotoService.AddPhotoAsync`, called
 * by `PostsController.CreatePost` and `UsersController.AddPhoto`), so the only
 * place a test can cut it off is the client's own request to the API. That also
 * means nothing a stub answers is stored: a spec using it checks what the client
 * sends and what it does with the answer, never what the API persists - that
 * stays with smoke, the regression post lifecycle, e2e and the api layer.
 *
 * Reached through the `apiStub` fixture. Arm a stub before the action that sends
 * the request; it lives as long as the test's page.
 */
export class ApiStub {
  constructor(private readonly page: Page) {}

  /** `POST posts/add-post` answers 200 with the post, as if Cloudinary had taken the photo. */
  addPostSucceeds(): Promise<StubbedCall> {
    return this.answer(ENDPOINTS.posts.add, async (request) => {
      const { fields } = await readMultipart(request);
      const created: PostDto = { ...buildPostDto({ title: fields.title }), id: 0, appUserId: 0 };
      return { status: 200, body: created };
    });
  }

  /** `POST posts/add-post` answers 400 with Cloudinary's rejection, which `PostsController.CreatePost` passes on. */
  addPostRejectsPhoto(): Promise<StubbedCall> {
    return this.answer(ENDPOINTS.posts.add, () => ({ status: 400, body: API_ERROR.photoRejected }));
  }

  /** `POST users/add-photo` answers 400 with Cloudinary's rejection, which `UsersController.AddPhoto` passes on. */
  addPhotoRejectsPhoto(): Promise<StubbedCall> {
    return this.answer(ENDPOINTS.users.addPhoto, () => ({ status: 400, body: API_ERROR.photoRejected }));
  }

  private async answer(
    endpoint: string,
    respond: (request: Request) => StubAnswer | Promise<StubAnswer>,
  ): Promise<StubbedCall> {
    let answered!: (request: Request) => void;
    const request = new Promise<Request>((resolve) => (answered = resolve));
    // Matched on the path alone: the client calls `posts/add-post/` with a trailing slash.
    const path = new URL(apiUrl(endpoint)).pathname;

    await this.page.route(
      (url) => url.pathname.replace(/\/+$/, '') === path,
      async (route) => {
        const { status, body } = await respond(route.request());
        // The API is another origin than the client, so the browser applies CORS to a stubbed answer too.
        const headers = { 'access-control-allow-origin': (await route.request().headerValue('origin')) ?? '*' };
        await (typeof body === 'string'
          ? route.fulfill({ status, headers, contentType: 'text/plain; charset=utf-8', body })
          : route.fulfill({ status, headers, json: body }));
        answered(route.request());
      },
    );

    return { request };
  }
}

/** Reads a `multipart/form-data` request body - what the API's `[FromForm]` upload routes bind. */
export async function readMultipart(request: Request): Promise<MultipartBody> {
  const form = await new Response(new Uint8Array(request.postDataBuffer() ?? []), {
    headers: { 'content-type': (await request.headerValue('content-type')) ?? '' },
  }).formData();

  const body: MultipartBody = { fields: {}, fileNames: {} };
  form.forEach((value, key) => {
    if (typeof value === 'string') {
      body.fields[key] = value;
    } else {
      body.fileNames[key] = value.name;
    }
  });
  return body;
}
