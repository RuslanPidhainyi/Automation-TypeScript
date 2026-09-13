/**
 * Queries against `dbo.Likes` - a composite primary key `(AppUserId, PostId)`,
 * no surrogate `Id` column at all (`AppDbContext.OnModelCreating`:
 * `.HasKey(l => new { l.AppUserId, l.PostId })`).
 */
export const LikesQueries = {
  countForUserAndPost: `
    SELECT COUNT(*) AS total
    FROM dbo.Likes l
    JOIN dbo.AspNetUsers u ON u.Id = l.AppUserId
    WHERE u.UserName = @username AND l.PostId = @postId
  `,
} as const;
