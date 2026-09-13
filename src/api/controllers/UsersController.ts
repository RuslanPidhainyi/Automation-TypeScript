import { APIResponse } from '@playwright/test';
import { ENDPOINTS } from '../../constants/endpoints';
import { MemberDto, MemberDtoSchema, MemberUpdateDto, PhotoDto, PhotoDtoSchema } from '../../models';
import { HttpClient } from '../HttpClient';

/** `API/Controllers/UsersController.cs` - every route acts on, or needs, a signed-in caller. */
export class UsersController {
  constructor(private readonly http: HttpClient) {}

  /** `GET users`, as-is - every member. */
  listRaw(): Promise<APIResponse> {
    return this.http.get(ENDPOINTS.users.list);
  }

  async get(username: string): Promise<MemberDto> {
    return this.http.parse(await this.http.get(ENDPOINTS.users.byUsername(username)), MemberDtoSchema);
  }

  /**
   * `PUT users` for the caller, as-is: `UpdateUser` answers 400 whenever nothing
   * changed, so a caller checks the result rather than the status.
   */
  updateRaw(fields: MemberUpdateDto): Promise<APIResponse> {
    return this.http.put(ENDPOINTS.users.update, fields);
  }

  /** Uploads a photo for the caller (through Cloudinary); a user's first photo becomes the main one. */
  async addPhoto(filePath: string): Promise<PhotoDto> {
    return this.http.parse(await this.http.postFile(ENDPOINTS.users.addPhoto, filePath), PhotoDtoSchema);
  }

  async setMainPhoto(photoId: number): Promise<void> {
    await this.http.expectOk(await this.http.put(ENDPOINTS.users.setMainPhoto(photoId)));
  }

  /** The API refuses to delete the main photo. */
  async deletePhoto(photoId: number): Promise<void> {
    await this.http.expectOk(await this.http.delete(ENDPOINTS.users.deletePhoto(photoId)));
  }
}
