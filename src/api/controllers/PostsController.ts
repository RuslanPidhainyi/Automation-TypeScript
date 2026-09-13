import { APIResponse } from '@playwright/test';
import { z } from 'zod';
import { ENDPOINTS } from '../../constants/endpoints';
import { NewPostDto, PostDto, PostDtoSchema } from '../../models';
import { HttpClient } from '../HttpClient';

/** `API/Controllers/PostsController.cs` - every route needs a signed-in caller. */
export class PostsController {
  constructor(private readonly http: HttpClient) {}

  /** `GET posts`, as-is - an anonymous caller gets 401. */
  listRaw(): Promise<APIResponse> {
    return this.http.get(ENDPOINTS.posts.list);
  }

  /** Every published post. */
  async list(): Promise<PostDto[]> {
    return this.http.parse(await this.listRaw(), z.array(PostDtoSchema));
  }

  /** `GET posts/{id}`, as-is - a post that does not exist answers 404. */
  getRaw(id: number): Promise<APIResponse> {
    return this.http.get(ENDPOINTS.posts.byId(id));
  }

  /** One post, by its id. */
  async get(id: number): Promise<PostDto> {
    return this.http.parse(await this.getRaw(id), PostDtoSchema);
  }

  /** The posts `username` published. */
  async byUser(username: string): Promise<PostDto[]> {
    return this.http.parse(await this.http.get(ENDPOINTS.posts.byUser(username)), z.array(PostDtoSchema));
  }

  /**
   * Publishes `post` as the caller, with the image at `photoPath` uploaded
   * through Cloudinary, and returns the post as created - `id` included.
   */
  async add(post: NewPostDto, photoPath: string): Promise<PostDto> {
    const response = await this.http.postForm(ENDPOINTS.posts.add, post, { file: photoPath });
    return this.http.parse(response, PostDtoSchema);
  }

  /** `PUT posts/edit-post/{id}`, as-is - replaces every field of the post with those of `post`. */
  editRaw(id: number, post: NewPostDto): Promise<APIResponse> {
    return this.http.putForm(ENDPOINTS.posts.edit(id), post);
  }

  /**
   * `DELETE posts/delete-post/{id}`, as-is - the API looks the post up among the
   * caller's own, so anyone else's answers 400.
   */
  removeRaw(id: number): Promise<APIResponse> {
    return this.http.delete(ENDPOINTS.posts.remove(id));
  }

  /** Deletes one of the caller's own posts. */
  async remove(id: number): Promise<void> {
    await this.http.expectOk(await this.removeRaw(id));
  }

  /**
   * Deletes every post `owner` - who must be the caller - published under
   * `title`; does nothing when there is none.
   */
  async deleteByTitle(owner: string, title: string): Promise<void> {
    const matches = (await this.byUser(owner)).filter((post) => post.title === title);
    for (const post of matches) {
      await this.remove(post.id);
    }
  }
}
