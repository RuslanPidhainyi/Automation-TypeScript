import { IntegrityQueries } from '../../../src/constants/queries/mssql/integrity.queries';
import { SCHEMA } from '../../../src/constants/testData';
import type { ForeignKeyRow, MigrationRow } from '../../../src/models';
import { expect, idTag, LAYER_TAG, MUTATION_TAG, test } from '../../support';

/**
 * Database layer - the schema the rest of the suite silently relies on.
 *
 * Reads SQL Server's own catalog through the `db` fixture: neither the API nor
 * the client has to run, and nothing is written. An e2e test that fails because
 * the database is a migration behind, or lost the cascade the test counts on,
 * blames the wrong thing - these name the real cause.
 */
test.describe(
  'Tests verify the database schema is the one the application defines',
  { tag: [LAYER_TAG.database, MUTATION_TAG.unmutation] },
  () => {
    test(
      '[ID: 128] dbo.__EFMigrationsHistory holds exactly the migrations of API/Data/Migrations',
      { tag: [idTag(128), LAYER_TAG.database, MUTATION_TAG.unmutation] },
      async ({ db }) => {
        const applied = await db.query<MigrationRow>(IntegrityQueries.appliedMigrations);

        expect(applied.map((row) => row.MigrationId)).toEqual(SCHEMA.migrations);
      },
    );

    test(
      '[ID: 129] FK_Likes_Posts_PostId deletes the likes of a post together with the post',
      { tag: [idTag(129), LAYER_TAG.database, MUTATION_TAG.unmutation] },
      async ({ db }) => {
        const { likesToPostsForeignKey } = SCHEMA;

        const foreignKeys = await db.query<ForeignKeyRow>(IntegrityQueries.foreignKeyByName, {
          name: likesToPostsForeignKey.name,
        });

        expect(foreignKeys).toEqual([likesToPostsForeignKey]);
      },
    );
  },
);
