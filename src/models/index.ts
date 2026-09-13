/**
 * Shapes of the data the suite exchanges with the application under test:
 *
 *   dto/  API bodies - zod schemas mirroring `API/DTOs/*.cs`, with the TypeScript
 *         type inferred from each schema
 *   db/   rows returned by `src/constants/queries/mssql/`, one file per table
 *
 * Specs and helpers import from here and never declare these shapes themselves.
 */

export * from './credentials';

export * from './dto/admin.dto';
export * from './dto/apiException.dto';
export * from './dto/member.dto';
export * from './dto/message.dto';
export * from './dto/post.dto';
export * from './dto/register.dto';
export * from './dto/user.dto';
export * from './dto/validationProblem.dto';

export * from './db/common.rows';
export * from './db/integrity.rows';
export * from './db/posts.rows';
export * from './db/roles.rows';
export * from './db/users.rows';
