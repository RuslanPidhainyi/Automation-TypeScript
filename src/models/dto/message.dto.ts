import { z } from 'zod';

/** `API/DTOs/MessageDto.cs` - one element of `GET messages` and `GET messages/thread/{username}`. */
export const MessageDtoSchema = z.object({
  id: z.number(),
  senderId: z.number(),
  senderUsername: z.string(),
  /**
   * Declared `required string` in the DTO, but `AutoMapperProfiles` fills both
   * photo URLs from the user's main photo - `null` for an account without one.
   */
  senderPhotoUrl: z.string().nullish(),
  recipientId: z.number(),
  recipientPhotoUrl: z.string().nullish(),
  recipientUsername: z.string(),
  content: z.string(),
  dateRead: z.string().nullish(),
  messageSent: z.string().nullish(),
});

export type MessageDto = z.infer<typeof MessageDtoSchema>;
