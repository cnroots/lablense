export interface Migration {
  version: number;
  statements: string[];
}

/**
 * Shared schema DDL, kept in sync with `drizzle-kit` output
 * (`src/db/migrations/0000_*.sql`). Both the Node and the Expo drivers apply
 * these statements and track progress via SQLite's `user_version` pragma, so
 * the schema is defined once and runs identically everywhere.
 */
export const CORE_MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE \`analyte\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`key\` text NOT NULL,
        \`display_name\` text NOT NULL,
        \`group_id\` text,
        \`description\` text,
        FOREIGN KEY (\`group_id\`) REFERENCES \`test_group\`(\`id\`) ON UPDATE no action ON DELETE no action
      );`,
      `CREATE UNIQUE INDEX \`analyte_key_unique\` ON \`analyte\` (\`key\`);`,
      `CREATE TABLE \`analyte_loinc\` (
        \`analyte_id\` text NOT NULL,
        \`loinc_code\` text NOT NULL,
        PRIMARY KEY(\`analyte_id\`, \`loinc_code\`),
        FOREIGN KEY (\`analyte_id\`) REFERENCES \`analyte\`(\`id\`) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (\`loinc_code\`) REFERENCES \`loinc\`(\`code\`) ON UPDATE no action ON DELETE cascade
      );`,
      `CREATE TABLE \`analyte_name\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`analyte_id\` text NOT NULL,
        \`name\` text NOT NULL,
        \`normalized\` text NOT NULL,
        \`language\` text,
        \`type\` text NOT NULL,
        \`source\` text,
        FOREIGN KEY (\`analyte_id\`) REFERENCES \`analyte\`(\`id\`) ON UPDATE no action ON DELETE cascade
      );`,
      `CREATE TABLE \`analyte_unit\` (
        \`analyte_id\` text NOT NULL,
        \`unit_id\` text NOT NULL,
        PRIMARY KEY(\`analyte_id\`, \`unit_id\`),
        FOREIGN KEY (\`analyte_id\`) REFERENCES \`analyte\`(\`id\`) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (\`unit_id\`) REFERENCES \`unit\`(\`id\`) ON UPDATE no action ON DELETE cascade
      );`,
      `CREATE TABLE \`data_import\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`dataset\` text NOT NULL,
        \`version\` text NOT NULL,
        \`imported_at\` text NOT NULL,
        \`status\` text NOT NULL
      );`,
      `CREATE TABLE \`loinc\` (
        \`code\` text PRIMARY KEY NOT NULL,
        \`display_name\` text,
        \`version\` text NOT NULL,
        \`status\` text,
        \`component\` text,
        \`property\` text,
        \`time_aspect\` text,
        \`system\` text,
        \`scale_type\` text,
        \`method\` text,
        \`example_units\` text,
        \`example_ucum_units\` text
      );`,
      `CREATE TABLE \`observation\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`user_id\` text NOT NULL,
        \`analyte_id\` text NOT NULL,
        \`value_numeric\` real,
        \`value_text\` text,
        \`comparator\` text,
        \`unit_id\` text,
        \`measured_at\` text NOT NULL,
        \`created_at\` text NOT NULL,
        \`updated_at\` text NOT NULL,
        FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (\`analyte_id\`) REFERENCES \`analyte\`(\`id\`) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (\`unit_id\`) REFERENCES \`unit\`(\`id\`) ON UPDATE no action ON DELETE no action
      );`,
      `CREATE TABLE \`observation_provenance\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`observation_id\` text NOT NULL,
        \`source_type\` text NOT NULL,
        \`original_name\` text,
        \`original_value\` text,
        \`original_unit\` text,
        \`extraction_method\` text,
        \`extraction_engine\` text,
        \`extraction_engine_version\` text,
        \`confidence\` real,
        \`created_at\` text NOT NULL,
        FOREIGN KEY (\`observation_id\`) REFERENCES \`observation\`(\`id\`) ON UPDATE no action ON DELETE cascade
      );`,
      `CREATE UNIQUE INDEX \`observation_provenance_observation_id_unique\` ON \`observation_provenance\` (\`observation_id\`);`,
      `CREATE TABLE \`reference_condition\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`reference_range_id\` text NOT NULL,
        \`field\` text NOT NULL,
        \`operator\` text NOT NULL,
        \`value\` text NOT NULL,
        \`value_type\` text NOT NULL,
        FOREIGN KEY (\`reference_range_id\`) REFERENCES \`reference_range\`(\`id\`) ON UPDATE no action ON DELETE cascade
      );`,
      `CREATE TABLE \`reference_range\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`analyte_id\` text NOT NULL,
        \`unit_id\` text,
        \`type\` text NOT NULL,
        \`lower_value\` real,
        \`lower_operator\` text,
        \`upper_value\` real,
        \`upper_operator\` text,
        \`categorical_value\` text,
        \`source_id\` text,
        FOREIGN KEY (\`analyte_id\`) REFERENCES \`analyte\`(\`id\`) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (\`unit_id\`) REFERENCES \`unit\`(\`id\`) ON UPDATE no action ON DELETE no action,
        FOREIGN KEY (\`source_id\`) REFERENCES \`source\`(\`id\`) ON UPDATE no action ON DELETE no action
      );`,
      `CREATE TABLE \`source\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`name\` text NOT NULL,
        \`url\` text,
        \`version\` text,
        \`accessed_at\` text
      );`,
      `CREATE TABLE \`test_group\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`key\` text NOT NULL,
        \`name\` text NOT NULL,
        \`description\` text
      );`,
      `CREATE UNIQUE INDEX \`test_group_key_unique\` ON \`test_group\` (\`key\`);`,
      `CREATE TABLE \`unit\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`ucum_code\` text NOT NULL,
        \`display_name\` text NOT NULL
      );`,
      `CREATE UNIQUE INDEX \`unit_ucum_code_unique\` ON \`unit\` (\`ucum_code\`);`,
      `CREATE TABLE \`unit_name\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`unit_id\` text NOT NULL,
        \`name\` text NOT NULL,
        \`normalized\` text NOT NULL,
        FOREIGN KEY (\`unit_id\`) REFERENCES \`unit\`(\`id\`) ON UPDATE no action ON DELETE cascade
      );`,
      `CREATE TABLE \`user\` (
        \`id\` text PRIMARY KEY NOT NULL,
        \`name\` text,
        \`age_years\` real,
        \`sex\` text,
        \`created_at\` text NOT NULL
      );`
    ]
  },
  {
    version: 3,
    statements: [
      // Default metric (UCUM unit) per LOINC code, populated by the blood
      // LOINC catalog import (see LoincJsonImporter / build-loinc-blood-catalog).
      `ALTER TABLE \`loinc\` ADD COLUMN \`default_unit\` text;`
    ]
  }
];

/**
 * Applies `migrations` in order, tracking the applied version via
 * `user_version`. `exec`, `readVersion` and `writeVersion` are provided by the
 * platform driver so the same migration list runs on Node and on mobile.
 */
export function applyMigrations(
  migrations: Migration[],
  exec: (sql: string) => void,
  readVersion: () => number,
  writeVersion: (version: number) => void
): void {
  const current = readVersion();
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    for (const statement of migration.statements) {
      exec(statement);
    }
    writeVersion(migration.version);
  }
}
