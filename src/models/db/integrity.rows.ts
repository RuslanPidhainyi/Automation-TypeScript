/** `IntegrityQueries.usersWithSeveralMainPhotos` and `IntegrityQueries.membersWithoutExactlyOneMainPhoto`. */
export interface MainPhotoCountRow {
  UserName: string;
  mainPhotos: number;
}

/** `IntegrityQueries.orphanLikes` - the composite key of a `dbo.Likes` row. */
export interface LikeKeyRow {
  AppUserId: number;
  PostId: number;
}

/** `IntegrityQueries.messagesDeletedByBothSides`. */
export interface MessageSidesRow {
  Id: number;
  SenderUsername: string;
  RecipientUsername: string;
}

/** `IntegrityQueries.foreignKeyByName` - one `sys.foreign_keys` row. */
export interface ForeignKeyRow {
  name: string;
  fromTable: string;
  toTable: string;
  /** `delete_referential_action_desc`: `NO_ACTION`, `CASCADE`, `SET_NULL` or `SET_DEFAULT`. */
  onDelete: string;
}

/** `IntegrityQueries.appliedMigrations` - one `dbo.__EFMigrationsHistory` row. */
export interface MigrationRow {
  MigrationId: string;
}
