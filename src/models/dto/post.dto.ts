import { z } from 'zod';

/** `API/DTOs/PostDto.cs` - one element of `GET posts` and `GET posts/user/{username}`. */
export const PostDtoSchema = z.object({
  id: z.number(),
  url: z.string().nullish(),
  ownerPhotoUrl: z.string().nullish(),
  title: z.string(),
  locationCountry: z.string(),
  locationCity: z.string(),
  lastCountry: z.string(),
  lastRegion: z.string(),
  localTransport: z.boolean(),
  minPriceLocalTrans: z.number(),
  maxPriceLocalTrans: z.number(),
  travelTime: z.number(),
  entranceFee: z.boolean(),
  minPriceEntrFee: z.number(),
  maxPriceEntrFee: z.number(),
  placeStay: z.boolean(),
  typePlaceStay: z.string().nullish(),
  minPricePlaceStay: z.number(),
  maxPricePlaceStay: z.number(),
  groceryStore: z.boolean(),
  minPriceGroceryStore: z.number(),
  maxPriceGroceryStore: z.number(),
  guide: z.boolean(),
  minPriceGuide: z.number(),
  maxPriceGuide: z.number(),
  currency: z.string(),
  description: z.string().nullish(),
  appUserId: z.number(),
  /** The owner's username (`PostDto.UserName`). */
  userName: z.string().nullish(),
});

export type PostDto = z.infer<typeof PostDtoSchema>;

/**
 * The fields `POST posts/add-post` and `PUT posts/edit-post/{id}` bind from the
 * form: `PostDto` without what the API fills in itself, and with the two
 * optional texts always present.
 */
export type NewPostDto = Omit<
  PostDto,
  'id' | 'url' | 'ownerPhotoUrl' | 'appUserId' | 'userName' | 'typePlaceStay' | 'description'
> & {
  typePlaceStay: string;
  description: string;
};
