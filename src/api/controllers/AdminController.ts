import { APIResponse } from '@playwright/test';
import { z } from 'zod';
import { ENDPOINTS } from '../../constants/endpoints';
import { UserWithRoles, UserWithRolesSchema } from '../../models';
import { HttpClient } from '../HttpClient';

/** `API/Controllers/AdminController.cs` - `RequireAdminRole` / `ModerateContentRole` policies. */
export class AdminController {
  constructor(private readonly http: HttpClient) {}

  /** `GET admin/users-with-roles`, as-is - Admin only (`RequireAdminRole`). */
  usersWithRolesRaw(): Promise<APIResponse> {
    return this.http.get(ENDPOINTS.admin.usersWithRoles);
  }

  async usersWithRoles(): Promise<UserWithRoles[]> {
    return this.http.parse(await this.usersWithRolesRaw(), z.array(UserWithRolesSchema));
  }

  /** `GET admin/contents-to-moderate`, as-is - Admin or Moderator (`ModerateContentRole`). */
  contentsToModerateRaw(): Promise<APIResponse> {
    return this.http.get(ENDPOINTS.admin.contentsToModerate);
  }

  /**
   * `POST admin/edit-roles/{username}?roles=...`, as-is - Admin only. An empty
   * role list or a username nobody has answers 400.
   */
  editRolesRaw(username: string, roles: readonly string[]): Promise<APIResponse> {
    return this.http.post(`${ENDPOINTS.admin.editRoles(username)}?roles=${encodeURIComponent(roles.join(','))}`);
  }

  /** Makes `roles` exactly the roles of `username` and returns what the API reports back. */
  async editRoles(username: string, roles: readonly string[]): Promise<string[]> {
    return this.http.parse(await this.editRolesRaw(username, roles), z.array(z.string()));
  }
}
