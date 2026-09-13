/** Any `SELECT COUNT(*) AS total ...` query from `src/constants/queries/mssql/`. */
export interface CountRow {
  total: number;
}

/** The number such a query returns - `COUNT(*)` always yields exactly one row. */
export function totalOf([row]: readonly CountRow[]): number {
  return row.total;
}
