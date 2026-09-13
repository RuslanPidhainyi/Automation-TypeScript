import { APIResponse } from '@playwright/test';
import { z } from 'zod';
import { ENDPOINTS } from '../../constants/endpoints';
import { HttpClient } from '../HttpClient';

/** `API/Controllers/LikesController.cs`. */
export class LikesController {
  constructor(private readonly http: HttpClient) {}

  /** `POST likes/{postId}`, as-is - liking your own post answers 400, a post that does not exist 404. */
  toggleRaw(postId: number): Promise<APIResponse> {
    return this.http.post(ENDPOINTS.likes.toggle(postId));
  }

  /** Likes the post, or unlikes it when the caller already did. */
  async toggle(postId: number): Promise<void> {
    await this.http.expectOk(await this.toggleRaw(postId));
  }

  /** `GET likes/list`, as-is. */
  idsRaw(): Promise<APIResponse> {
    return this.http.get(ENDPOINTS.likes.ids);
  }

  /** The ids of every post the caller likes. */
  async ids(): Promise<number[]> {
    return this.http.parse(await this.idsRaw(), z.array(z.number()));
  }
}
