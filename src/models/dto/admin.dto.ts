import { z } from 'zod';

/** One element of `GET admin/users-with-roles` - an anonymous object in `AdminController`, camel-cased. */
export const UserWithRolesSchema = z.object({
  id: z.number(),
  username: z.string(),
  roles: z.array(z.string()),
});

export type UserWithRoles = z.infer<typeof UserWithRolesSchema>;
