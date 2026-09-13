/** Queries joining `dbo.AspNetUserRoles` -> `dbo.AspNetRoles` -> `dbo.AspNetUsers`. */
export const RolesQueries = {
  getRoleNamesByUsername: `
    SELECT r.Name
    FROM dbo.AspNetUserRoles ur
    JOIN dbo.AspNetRoles r ON r.Id = ur.RoleId
    JOIN dbo.AspNetUsers u ON u.Id = ur.UserId
    WHERE u.UserName = @username
  `,
} as const;
