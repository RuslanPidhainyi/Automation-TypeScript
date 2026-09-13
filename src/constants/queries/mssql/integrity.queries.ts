/**
 * The database as a whole - schema facts and rules about the data that no
 * single request checks (`specs/tests/database/`). Verified against
 * `API/Data/Migrations/20250302123454_InitialCreate.cs`.
 *
 * Every invariant query returns the rows that break it, so an empty result
 * means the invariant holds and a failing `toEqual([])` lists every offender at
 * once.
 */
export const IntegrityQueries = {
  /** Users with more than one main photo - the nav avatar and member cards assume at most one. */
  usersWithSeveralMainPhotos: `
    SELECT u.UserName, COUNT(*) AS mainPhotos
    FROM dbo.GeneralPhotos p
    JOIN dbo.AspNetUsers u ON u.Id = p.AppUserId
    WHERE p.IsMain = 1
    GROUP BY u.UserName
    HAVING COUNT(*) > 1
  `,

  /**
   * Which of `@usernames` (comma-separated) do not have exactly one main photo.
   * Starts from the list itself, so a username missing from `dbo.AspNetUsers`
   * is reported too, with `0`.
   */
  membersWithoutExactlyOneMainPhoto: `
    SELECT s.value AS UserName, COUNT(p.Id) AS mainPhotos
    FROM STRING_SPLIT(@usernames, ',') s
    LEFT JOIN dbo.AspNetUsers u ON u.UserName = s.value
    LEFT JOIN dbo.GeneralPhotos p ON p.AppUserId = u.Id AND p.IsMain = 1
    GROUP BY s.value
    HAVING COUNT(p.Id) <> 1
  `,

  /** `dbo.Likes` rows whose post no longer exists. */
  orphanLikes: `
    SELECT l.AppUserId, l.PostId
    FROM dbo.Likes l
    LEFT JOIN dbo.Posts p ON p.Id = l.PostId
    WHERE p.Id IS NULL
  `,

  /** Messages still stored after both sides deleted them - `MessagesController.DeleteMessage` removes those outright. */
  messagesDeletedByBothSides: `
    SELECT Id, SenderUsername, RecipientUsername
    FROM dbo.Messages
    WHERE SenderDeleted = 1 AND RecipientDeleted = 1
  `,

  /** The foreign key called `@name`: the table it starts from, the table it points at, and what a delete does. */
  foreignKeyByName: `
    SELECT fk.name,
           OBJECT_NAME(fk.parent_object_id) AS fromTable,
           OBJECT_NAME(fk.referenced_object_id) AS toTable,
           fk.delete_referential_action_desc AS onDelete
    FROM sys.foreign_keys fk
    WHERE fk.name = @name
  `,

  /** Every applied EF Core migration, oldest first - the ids start with a timestamp. */
  appliedMigrations: `
    SELECT MigrationId FROM dbo.__EFMigrationsHistory ORDER BY MigrationId
  `,
} as const;
