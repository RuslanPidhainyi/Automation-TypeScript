import fs from 'fs';
import { APIRequestContext, APIResponse, expect } from '@playwright/test';
import { z } from 'zod';

/**
 * `https://localhost:5001/api/` unless `API_URL` says otherwise - the same value
 * the client compiles in (`Client/src/environments/environment.development.ts`),
 * kept with a trailing slash so routes read like the Angular services.
 */
export function apiBaseUrl(): string {
  return (process.env.API_URL ?? 'https://localhost:5001/api/').replace(/\/*$/, '/');
}

/** Builds an absolute API URL from a route, e.g. `posts` or `buggy/auth`. */
export function apiUrl(endpoint: string): string {
  return `${apiBaseUrl()}${endpoint.replace(/^\/+/, '')}`;
}

/** The values of a `multipart/form-data` body besides its files - the API binds them by name, case-insensitively. */
export type FormFields = Record<string, string | number | boolean>;

/**
 * The transport under every controller in `src/api/controllers/`: Playwright's
 * `request` fixture plus an optional bearer token. It knows nothing about
 * routes - those live in `src/constants/endpoints.ts`.
 *
 * The verbs return the raw `APIResponse`, so a check can look at the status
 * itself; `expectOk` and `parse` are what a controller uses when the call has to
 * succeed.
 */
export class HttpClient {
  constructor(
    private readonly request: APIRequestContext,
    readonly token?: string,
  ) {}

  get(endpoint: string): Promise<APIResponse> {
    return this.request.get(apiUrl(endpoint), { headers: this.headers() });
  }

  post(endpoint: string, data?: unknown): Promise<APIResponse> {
    return this.request.post(apiUrl(endpoint), { data, headers: this.headers() });
  }

  /** A multipart upload of one file under the form field `field`. */
  postFile(endpoint: string, filePath: string, field = 'file'): Promise<APIResponse> {
    return this.postForm(endpoint, {}, { [field]: filePath });
  }

  /**
   * A `multipart/form-data` POST - the body of the API's `[FromForm]` actions.
   * `files` maps a form field to the path of the file uploaded under it.
   */
  postForm(endpoint: string, fields: FormFields, files: Record<string, string> = {}): Promise<APIResponse> {
    const streams = Object.fromEntries(
      Object.entries(files).map(([field, filePath]) => [field, fs.createReadStream(filePath)]),
    );
    return this.request.post(apiUrl(endpoint), { multipart: { ...fields, ...streams }, headers: this.headers() });
  }

  put(endpoint: string, data?: unknown): Promise<APIResponse> {
    return this.request.put(apiUrl(endpoint), { data, headers: this.headers() });
  }

  /** A `multipart/form-data` PUT - see `postForm`. */
  putForm(endpoint: string, fields: FormFields): Promise<APIResponse> {
    return this.request.put(apiUrl(endpoint), { multipart: fields, headers: this.headers() });
  }

  delete(endpoint: string): Promise<APIResponse> {
    return this.request.delete(apiUrl(endpoint), { headers: this.headers() });
  }

  /** Asserts a 2xx - Playwright's `toBeOK()` prints the status and body when it is not. */
  async expectOk(response: APIResponse): Promise<APIResponse> {
    await expect(response, `${response.url()} should succeed`).toBeOK();
    return response;
  }

  /**
   * Asserts a 2xx and validates the JSON body against `schema`, so a changed API
   * contract fails right here, with every mismatching field listed, instead of
   * somewhere later in the spec.
   */
  async parse<Schema extends z.ZodType>(response: APIResponse, schema: Schema): Promise<z.output<Schema>> {
    await this.expectOk(response);
    const result = schema.safeParse(await response.json());
    if (!result.success) {
      throw new Error(`${response.url()} broke its contract:\n${z.prettifyError(result.error)}`);
    }
    return result.data;
  }

  private headers(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }
}
