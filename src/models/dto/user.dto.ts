import { z } from 'zod';

/** `API/DTOs/UserDto.cs` - the body of `account/login` and `account/register`, camel-cased by `System.Text.Json`. */
export const UserDtoSchema = z.object({
  username: z.string(),
  token: z.string(),
  knownAs: z.string(),
  generalPhotoUrl: z.string().nullish(),
});

export type UserDto = z.infer<typeof UserDtoSchema>;
