/** Queries against `dbo.Posts`. */
export const PostsQueries = {
  getByTitle: `
    SELECT Id, Title, LocationCountry, LocationCity, Currency
    FROM dbo.Posts
    WHERE Title = @title
  `,
  /** Also doubles as the FK-cascade probe - `dbo.Likes.PostId` cascades on post delete. */
  countLikesForPost: `
    SELECT COUNT(*) AS total FROM dbo.Likes WHERE PostId = @postId
  `,
} as const;
