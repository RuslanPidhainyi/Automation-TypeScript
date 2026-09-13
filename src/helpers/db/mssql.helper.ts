import type { ConnectionPool, config as MssqlConfig } from 'mssql';

/**
 * Direct access to the same `TravelApp` SQL Server database the API under test
 * writes to - the connection behind the `db` fixture, used by
 * `specs/tests/e2e/` to prove a UI action was actually committed and by
 * `specs/tests/database/` to check the schema and the data as a whole (see
 * `TestCoveragePlan.md` §7).
 *
 * Two drivers, picked by `DB_DRIVER`:
 *
 *   msnodesqlv8 (default)  the native ODBC driver - this Windows machine
 *   tedious                plain `mssql`, pure JavaScript - CI, Linux, a SQL Server container
 *
 * A driver is loaded only when a connection is opened, so the specs that never
 * query the database never load one, and a runner without the native
 * `msnodesqlv8` (an optional dependency that may not build there) never needs it.
 */
export type DbDriver = 'msnodesqlv8' | 'tedious';

export const DB_DRIVER: DbDriver = process.env.DB_DRIVER === 'tedious' ? 'tedious' : 'msnodesqlv8';

/**
 * `msnodesqlv8`, not plain `mssql` (`tedious`), is the local default because
 * this SQL Server instance runs **Windows Integrated Security only** -
 * `SELECT SERVERPROPERTY('IsIntegratedSecurityOnly')` returns `1`, so there is no
 * SQL login `tedious` could authenticate with. `msnodesqlv8` reaches the
 * instance the same way the .NET API's own `SqlClient` does.
 *
 * The connection string addresses the instance by its **Named Pipe**
 * (`np:\\.\pipe\MSSQL$SQLEXPRESS\sql\query`), not by `Server=RUSLAN\SQLEXPRESS`.
 * The latter requires SQL Server Browser (UDP 1434) to resolve the instance's
 * dynamic TCP port, and Browser is stopped on this machine with no TCP
 * listener configured either - `sql.connect()` then hangs indefinitely
 * instead of failing fast (see `RulesForWritingTests.md` §2 / `TestCoveragePlan.md`
 * §5 for the dead end this replaced).
 */
const DEFAULT_CONNECTION_STRING =
  'Driver={ODBC Driver 17 for SQL Server};' +
  'Server=np:\\\\.\\pipe\\MSSQL$SQLEXPRESS\\sql\\query;' +
  'Database=TravelApp;' +
  'Trusted_Connection=Yes;' +
  'TrustServerCertificate=Yes;';

/**
 * One connection pool to `TravelApp`. Specs never open one themselves: the
 * worker-scoped `db` fixture (`specs/support/fixtures.ts`) connects on first use
 * and closes the pool when the worker finishes.
 */
export class MssqlClient {
  private constructor(private readonly pool: ConnectionPool) {}

  /** Opens a pool through `driver` - the one `DB_DRIVER` names unless told otherwise. */
  static async connect(driver: DbDriver = DB_DRIVER): Promise<MssqlClient> {
    const pool = driver === 'tedious' ? await connectWithTedious() : await connectWithMsnodesqlv8();
    return new MssqlClient(pool);
  }

  /**
   * Runs `query` and returns its rows. `params` are bound through
   * `Request.input()` - never string-interpolated into the SQL, which is exactly
   * the SQL-injection habit `RulesForWritingTests.md` §2 calls out. The query
   * text itself always comes from `src/constants/queries/mssql/*.queries.ts`.
   */
  async query<Row = Record<string, unknown>>(query: string, params: Record<string, unknown> = {}): Promise<Row[]> {
    const request = this.pool.request();
    for (const [name, value] of Object.entries(params)) {
      request.input(name, value);
    }
    const result = await request.query<Row>(query);
    return result.recordset;
  }

  async close(): Promise<void> {
    await this.pool.close();
  }
}

/** `DB_CONNECTION_STRING`, or this machine's Named Pipe with Windows authentication. */
async function connectWithMsnodesqlv8(): Promise<ConnectionPool> {
  const connectionString = process.env.DB_CONNECTION_STRING ?? DEFAULT_CONNECTION_STRING;

  // A plain `require`: Playwright hands a dynamic `import()` to Node's ESM resolver, which cannot resolve the
  // extensionless `mssql/msnodesqlv8` subpath ("Cannot find module ... Did you mean mssql/msnodesqlv8.js?").
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- see the comment above
  const { connect } = require('mssql/msnodesqlv8') as typeof import('mssql/msnodesqlv8');

  // `connect()` given a bare string runs it through mssql's own ADO-style
  // parser (built for tedious's `Server=host;User Id=u;Password=p` shape),
  // which explicitly rejects the `np:` Named Pipes prefix with "Connection
  // via Named Pipes is not supported" before msnodesqlv8 ever sees it.
  // Wrapping it as `{ connectionString }` instead passes the ODBC string
  // straight through to the native driver, unparsed.
  //
  // The cast is a real gap in `@types/mssql`, not a shortcut: `config` only
  // declares `connectionString` nested under `options` (`IOptions`), but
  // `mssql/lib/msnodesqlv8/connection-pool.js`'s `_poolCreate` reads
  // `this.config.connectionString` at the top level, exactly as used here -
  // confirmed by reading that file, not guessed.
  return connect({ connectionString } as unknown as MssqlConfig);
}

/**
 * A SQL login - what a SQL Server container offers (`sa`): `DB_SERVER`
 * (default `localhost`), `DB_PORT` (`1433`), `DB_NAME` (`TravelApp`), `DB_USER`
 * and `DB_PASSWORD`. Such a server presents a self-signed certificate, hence
 * `trustServerCertificate`.
 */
async function connectWithTedious(): Promise<ConnectionPool> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded on demand, like msnodesqlv8 above
  const { ConnectionPool: Pool } = require('mssql') as typeof import('mssql');

  const pool = new Pool({
    server: process.env.DB_SERVER ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_NAME ?? 'TravelApp',
    user: requireDbSetting('DB_USER'),
    password: requireDbSetting('DB_PASSWORD'),
    options: { encrypt: true, trustServerCertificate: true },
  });
  return pool.connect();
}

function requireDbSetting(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not set - DB_DRIVER=tedious signs in to SQL Server with a SQL login`);
  }
  return value;
}
