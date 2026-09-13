import { IntegrityQueries } from '../../../src/constants/queries/mssql/integrity.queries';
import { SEED } from '../../../src/constants/testData';
import type { LikeKeyRow, MainPhotoCountRow, MessageSidesRow } from '../../../src/models';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test } from '../../support';

/**
 * Database layer - invariants the stored data as a whole must keep, which no
 * single request checks (`TestCoveragePlan.md` §7.6).
 *
 * Every query returns the rows that break its invariant, so `toEqual([])` shows
 * every offender in one diff. Read-only, through the `db` fixture; neither the
 * API nor the client has to run.
 */
test.describe(
  'Tests verify the stored data keeps the invariants the application relies on',
  { tag: [LAYER_TAG.database, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 130] no user has more than one main photo',
      { tag: [idTag(130), LAYER_TAG.database, MUTATION_TAG.unmutation] },
      async ({ db }) => {
        const offenders = await db.query<MainPhotoCountRow>(IntegrityQueries.usersWithSeveralMainPhotos);

        expect(offenders, 'users with several main photos').toEqual([]);
      },
    );

    test(
      '[ID: 131] every seeded member has exactly one main photo',
      { tag: [idTag(131), LAYER_TAG.database, MUTATION_TAG.unmutation] },
      async ({ db }) => {
        const offenders = await db.query<MainPhotoCountRow>(IntegrityQueries.membersWithoutExactlyOneMainPhoto, {
          usernames: SEED.members.join(','),
        });

        expect(offenders, 'seeded members without exactly one main photo').toEqual([]);
      },
    );

    test(
      '[ID: 132] no dbo.Likes row points at a post that no longer exists',
      { tag: [idTag(132), LAYER_TAG.database, MUTATION_TAG.unmutation] },
      async ({ db }) => {
        const orphans = await db.query<LikeKeyRow>(IntegrityQueries.orphanLikes);

        expect(orphans, 'likes of deleted posts').toEqual([]);
      },
    );

    test(
      '[ID: 133] no dbo.Messages row is kept once both sides have deleted it',
      { tag: [idTag(133), LAYER_TAG.database, MUTATION_TAG.unmutation] },
      async ({ db }) => {
        const leftovers = await db.query<MessageSidesRow>(IntegrityQueries.messagesDeletedByBothSides);

        expect(leftovers, 'messages deleted by both sides').toEqual([]);
      },
    );
  },
);
