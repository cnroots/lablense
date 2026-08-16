import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type { TransactionRunner } from "@lablens/core";
import type * as schema from "./schema";

/**
 * Shared Drizzle database client type. Both platform drivers
 * (`better-sqlite3` for Node and `expo-sqlite` for mobile) produce a
 * synchronous-mode Drizzle database that satisfies this base type, so all
 * repository/loader logic can be written once against it.
 *
 * `@lablens/core` and the repositories never know which concrete driver is in
 * use — only `drivers/node-sqlite.ts` and `drivers/expo-sqlite.ts` do.
 */
export type DatabaseClient = BaseSQLiteDatabase<
  "sync",
  unknown,
  typeof schema
>;

/**
 * A connected database plus the platform's transaction runner. The concrete
 * `connection` type differs per driver (better-sqlite3 `Database` vs
 * expo-sqlite `SQLiteDatabase`); it is only used by driver-specific code.
 */
export interface DatabaseHandle<Connection = unknown> {
  db: DatabaseClient;
  connection: Connection;
  transactions: TransactionRunner;
}
