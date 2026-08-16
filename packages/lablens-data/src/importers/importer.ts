import type { ImportResult } from "@lablens/core";

export interface Importer<TOptions> {
  import(options: TOptions): Promise<ImportResult>;
}

export function emptyImportResult(): ImportResult {
  return { inserted: 0, updated: 0, skipped: 0, errors: [] };
}

export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function stableId(prefix: string, value: string): string {
  return `${prefix}_${hashString(value)}`;
}
