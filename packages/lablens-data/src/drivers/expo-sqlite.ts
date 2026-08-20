import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import type { TransactionRunner } from "@lablens/core";
import type { DatabaseHandle } from "../db/client";
import * as schema from "../db/schema";
import { CORE_MIGRATIONS, applyMigrations } from "../db/migrations";
import type { Migration } from "../db/migrations";

/**
 * Mobile-only preferences table (UI settings such as the dashboard selection).
 * Kept out of the shared domain schema; it lives only on the device.
 */
const APP_SETTING_MIGRATION: Migration = {
  version: 4,
  statements: [
    `CREATE TABLE IF NOT EXISTS \`app_setting\` (
      \`key\` text PRIMARY KEY NOT NULL,
      \`value\` text NOT NULL
    );`
  ]
};

/**
 * Android/iOS driver. Uses `expo-sqlite` through Drizzle's `expo-sqlite`
 * adapter (synchronous query surface, async transaction wrapper).
 */
export class ExpoTransactionRunner implements TransactionRunner {
  private readonly sqlite: SQLiteDatabase;

  constructor(sqlite: SQLiteDatabase) {
    this.sqlite = sqlite;
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    let result: T | undefined;
    await this.sqlite.withTransactionAsync(async () => {
      result = await operation();
    });
    return result as T;
  }
}

export function runExpoMigrations(sqlite: SQLiteDatabase): void {
  applyMigrations(
    [...CORE_MIGRATIONS, APP_SETTING_MIGRATION],
    (sql) => sqlite.execSync(sql),
    () =>
      sqlite.getFirstSync<{ user_version: number }>("PRAGMA user_version")
        ?.user_version ?? 0,
    (version) => sqlite.execSync(`PRAGMA user_version = ${version}`)
  );
}

export function createExpoDatabase(
  name = "lablens.db"
): DatabaseHandle<SQLiteDatabase> {
  const sqlite = openDatabaseSync(name);
  sqlite.execSync("PRAGMA journal_mode = WAL;");
  sqlite.execSync("PRAGMA foreign_keys = ON;");
  const db = drizzle(sqlite, { schema });
  runExpoMigrations(sqlite);
  return {
    connection: sqlite,
    db,
    transactions: new ExpoTransactionRunner(sqlite)
  };
}
