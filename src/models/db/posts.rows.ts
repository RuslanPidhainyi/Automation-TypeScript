/** `PostsQueries.getByTitle` - `dbo.Posts` columns, PascalCase exactly as the table defines them. */
export interface PostRow {
  Id: number;
  Title: string;
  LocationCountry: string;
  LocationCity: string;
  Currency: string;
}
