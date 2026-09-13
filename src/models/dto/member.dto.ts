import { z } from 'zod';
import { PostDtoSchema } from './post.dto';

/** `API/DTOs/PhotoDto.cs` - one of a member's `generalPhotos`. */
export const PhotoDtoSchema = z.object({
  id: z.number(),
  url: z.string().nullish(),
  isMain: z.boolean(),
});

export type PhotoDto = z.infer<typeof PhotoDtoSchema>;

/** `API/DTOs/MemberDto.cs` - the body of `GET users/{username}`. */
export const MemberDtoSchema = z.object({
  id: z.number(),
  username: z.string().nullish(),
  age: z.number(),
  generalPhotoUrl: z.string().nullish(),
  knownAs: z.string().nullish(),
  created: z.string(),
  lastActive: z.string(),
  gender: z.string().nullish(),
  description: z.string().nullish(),
  interests: z.string().nullish(),
  country: z.string().nullish(),
  city: z.string().nullish(),
  generalPhotos: z.array(PhotoDtoSchema).nullish(),
  posts: z.array(PostDtoSchema).nullish(),
});

export type MemberDto = z.infer<typeof MemberDtoSchema>;

/** `API/DTOs/MemberUpdateDto.cs` (class `MemberUpdatedDto`) - the body of `PUT users`. */
export const MemberUpdateDtoSchema = MemberDtoSchema.pick({
  description: true,
  interests: true,
  city: true,
  country: true,
});

export type MemberUpdateDto = z.infer<typeof MemberUpdateDtoSchema>;
