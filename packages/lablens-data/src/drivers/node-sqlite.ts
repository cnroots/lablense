import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { TransactionRunner } from "@lablens/core";
import type { DatabaseClient, DatabaseHandle } from "../db/client";
import * as schema from "../db/schema";
import { CORE_MIGRATIONS, applyMigrations } from "../db/migrations";

export type NodeSqliteConnection = Database.Database;

/**
 * Node.js driver. Uses `better-sqlite3` (the established synchronous SQLite
 * driver for Node) through Drizzle's `better-sqlite3` adapter. Used by the
 * development tooling, the optional REST API and the test suite.
 */
export class NodeTransactionRunner implements TransactionRunner {
  private readonly connection: NodeSqliteConnection;

  constructor(connection: NodeSqliteConnection) {
    this.connection = connection;
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    const inTransaction = this.connection.inTransaction;
    if (!inTransaction) this.connection.exec("BEGIN IMMEDIATE");
    try {
      const result = await operation();
      if (!inTransaction) this.connection.exec("COMMIT");
      return result;
    } catch (error) {
      if (!inTransaction) this.connection.exec("ROLLBACK");
      throw error;
    }
  }
}

export function runNodeMigrations(connection: NodeSqliteConnection): void {
  applyMigrations(
    CORE_MIGRATIONS,
    (sql) => connection.exec(sql),
    () => connection.pragma("user_version", { simple: true }) as number,
    (version) => connection.pragma(`user_version = ${version}`)
  );
}

export function createNodeDatabase(
  path: string
): DatabaseHandle<NodeSqliteConnection> {
  const connection = new Database(path);
  connection.pragma("journal_mode = WAL");
  connection.pragma("foreign_keys = ON");
  const db = drizzle(connection, { schema });
  runNodeMigrations(connection);
  return {
    connection,
    db,
    transactions: new NodeTransactionRunner(connection)
  };
}

export function createNodeInMemoryDatabase(): DatabaseHandle<NodeSqliteConnection> {
  return createNodeDatabase(":memory:");
}

export type { DatabaseClient };
