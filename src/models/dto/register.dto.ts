/**
 * `API/DTOs/RegisterDto.cs` - the body of `account/register`. Every field is
 * `[Required]`; the password is 9-21 characters.
 */
export interface RegisterDto {
  username: string;
  knownAs: string;
  gender: string;
  /** ISO date, `yyyy-MM-dd`. */
  dateOfBirth: string;
  city: string;
  country: string;
  password: string;
}
