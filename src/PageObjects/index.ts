/**
 * Public surface of the page-object layer.
 *
 * Specs import from here, never from a deep path:
 *   import { LoginPage, OffersPage } from '../src/Pages';
 */

// Infrastructure
export * from './BasePage';
export * from './widgets';

// Pages
export * from './Auth/Login/Login.page';
export * from './Auth/Registration/Registration.page';
export * from './Offers/Offers.page';
export * from './Offers/OfferDetails/OfferDetails.page';
export * from './Offers/AddOffer/AddOffer.page';
export * from './Offers/EditOffer/EditOffer.page';
export * from './Profile/Profile.page';
export * from './Profile/MemberProfile/MemberProfile.page';
export * from './Profile/EditProfile/EditProfile.page';
export * from './Lists/Lists.page';
export * from './Messages/Messages.page';
export * from './Admin/Admin.page';
export * from './Errors/TestErrors/TestErrors.page';
export * from './Errors/NotFound/NotFound.page';
export * from './Errors/ServerError/ServerError.page';
