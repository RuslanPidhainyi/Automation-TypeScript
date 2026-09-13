import type { MemberUpdateDto } from '../dto/member.dto';

/**
 * `UsersQueries.getProfileByUsername` - the four free-text columns
 * `/member/edit-profile` writes, PascalCase exactly as `dbo.AspNetUsers` defines
 * them. `Description` and `Interests` are nullable, `City` and `Country` are
 * `required` (`API/Entities/AppUser.cs`).
 */
export interface ProfileFieldsRow {
  Description: string | null;
  Interests: string | null;
  City: string;
  Country: string;
}

/**
 * The same four fields in the API's camelCase with `null` normalised to `''`,
 * so a `dbo.AspNetUsers` row, an API response and the values a spec typed into
 * the form all compare with a single `toEqual`.
 */
export interface ProfileFields {
  description: string;
  interests: string;
  city: string;
  country: string;
}

export function profileFieldsOfRow(row: ProfileFieldsRow): ProfileFields {
  return {
    description: row.Description ?? '',
    interests: row.Interests ?? '',
    city: row.City,
    country: row.Country,
  };
}

/** Accepts a whole `MemberDto` as well - it carries the same four fields. */
export function profileFieldsOfMember(member: MemberUpdateDto): ProfileFields {
  return {
    description: member.description ?? '',
    interests: member.interests ?? '',
    city: member.city ?? '',
    country: member.country ?? '',
  };
}
