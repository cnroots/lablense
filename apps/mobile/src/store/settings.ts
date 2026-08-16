import type { SQLiteDatabase } from "expo-sqlite";

export interface AppSettings {
  activeUserId: string | null;
  dashboardAnalytes: string[];
  period: "6M" | "1J" | "3J" | "5J" | "Alle";
  showRefs: boolean;
  highlightOutside: boolean;
  largeText: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  activeUserId: null,
  dashboardAnalytes: [],
  period: "1J",
  showRefs: true,
  highlightOutside: true,
  largeText: false
};

const KEY = "app_settings";

/**
 * Small key-value persistence for UI preferences. Stored in the same local
 * SQLite database (`app_setting` table), keeping the whole app dependency-free.
 */
export class SettingsStore {
  private readonly sqlite: SQLiteDatabase;
  private cache: AppSettings | null = null;

  constructor(sqlite: SQLiteDatabase) {
    this.sqlite = sqlite;
  }

  load(): AppSettings {
    if (this.cache) return this.cache;
    const row = this.sqlite.getFirstSync<{ value: string }>(
      "SELECT value FROM app_setting WHERE key = ?",
      KEY
    );
    let settings = DEFAULT_SETTINGS;
    if (row?.value) {
      try {
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
      } catch {
        settings = DEFAULT_SETTINGS;
      }
    }
    this.cache = settings;
    return settings;
  }

  save(patch: Partial<AppSettings>): AppSettings {
    const next = { ...this.load(), ...patch };
    this.sqlite.runSync(
      "INSERT INTO app_setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      KEY,
      JSON.stringify(next)
    );
    this.cache = next;
    return next;
  }
}
