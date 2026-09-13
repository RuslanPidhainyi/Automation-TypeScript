/**
 * Queries against `dbo.AspNetUsers` - Identity's own user table
 * (`IdentityDbContext<AppUser, AppRole, int, ...>`, no custom `ToTable()`
 * rename - confirmed against `API/Data/Migrations/20250302123454_InitialCreate.cs`).
 */
export const UsersQueries = {
  /** The four free-text fields `/member/edit-profile` writes. */
  getProfileByUsername: `
    SELECT Description, Interests, City, Country
    FROM dbo.AspNetUsers
    WHERE UserName = @username
  `,
} as const;
