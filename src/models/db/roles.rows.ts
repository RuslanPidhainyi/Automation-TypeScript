/** `RolesQueries.getRoleNamesByUsername` - one `dbo.AspNetRoles.Name` per row. */
export interface RoleNameRow {
  Name: string;
}

/** The role names of such a result, sorted - so two role sets compare regardless of order. */
export function roleNamesOf(rows: readonly RoleNameRow[]): string[] {
  return rows.map((row) => row.Name).sort();
}
