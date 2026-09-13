import type { PostFormData, RequiredPostField } from '../../PageObjects';
import { CURRENCY, LOCATION } from '../../constants/testData';
import type { NewPostDto } from '../../models';
import { uniqueName } from './unique.helper';

export type NewPost = PostFormData & Required<Pick<PostFormData, RequiredPostField>>;

/**
 * A publishable post: every required field filled, a unique title, and nothing
 * optional unless `overrides` asks for it - so a test only spells out what it is
 * actually about:
 *
 *   await addOffer.publish(buildPost({ title, entranceFee: { minPrice: '5', maxPrice: '15' } }));
 */
export function buildPost(overrides: Partial<PostFormData> = {}): NewPost {
  return {
    title: uniqueName('Auto Offer'),
    ...LOCATION.morskieOko,
    currency: CURRENCY.pln,
    ...overrides,
  };
}

/**
 * A publishable post as the API's form fields - for `api.posts.add`, which
 * skips the UI. Every optional section is off, with the values
 * `PostExtensions.SetConditionalFieldsForAddPost` would store for it anyway.
 */
export function buildPostDto(overrides: Partial<NewPostDto> = {}): NewPostDto {
  return {
    title: uniqueName('API Offer'),
    ...LOCATION.morskieOko,
    localTransport: false,
    minPriceLocalTrans: 0,
    maxPriceLocalTrans: 0,
    travelTime: 0,
    entranceFee: false,
    minPriceEntrFee: 0,
    maxPriceEntrFee: 0,
    placeStay: false,
    typePlaceStay: 'None',
    minPricePlaceStay: 0,
    maxPricePlaceStay: 0,
    groceryStore: false,
    minPriceGroceryStore: 0,
    maxPriceGroceryStore: 0,
    guide: false,
    minPriceGuide: 0,
    maxPriceGuide: 0,
    currency: CURRENCY.pln,
    description: 'Created by the API layer of the automation suite.',
    ...overrides,
  };
}
