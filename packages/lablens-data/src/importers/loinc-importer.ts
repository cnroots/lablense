import { eq } from "drizzle-orm";
import type { ImportResult, TransactionRunner } from "@lablens/core";
import { AppError } from "@lablens/core";
import type { DatabaseClient } from "../db/client";
import { dataImport, loinc } from "../db/schema";
import { emptyImportResult, stableId } from "./importer";
import type { Importer } from "./importer";
import { iterateCsvRows } from "./csv";

const COLUMNS = [
  "LOINC_NUM",
  "COMPONENT",
  "PROPERTY",
  "TIME_ASPCT",
  "SYSTEM",
  "SCALE_TYP",
  "METHOD_TYP",
  "STATUS",
  "EXAMPLE_UNITS",
  "EXAMPLE_UCUM_UNITS",
  "LONG_COMMON_NAME"
] as const;

const MAX_RECORDED_ERRORS = 100;

export interface LoincImporterOptions {
  sourcePath: string;
  version: string;
}

export class LoincImporter implements Importer<LoincImporterOptions> {
  private readonly db: DatabaseClient;
  private readonly transactions: TransactionRunner;

  constructor(db: DatabaseClient, transactions: TransactionRunner) {
    this.db = db;
    this.transactions = transactions;
  }

  async import(options: LoincImporterOptions): Promise<ImportResult> {
    const result = emptyImportResult();
    let header: string[] | null = null;
    let indices: Record<string, number> = {};
    let errorCount = 0;

    await this.transactions.run(async () => {
      for await (const row of iterateCsvRows(options.sourcePath)) {
        if (header === null) {
          header = row;
          indices = this.buildIndices(header);
          continue;
        }

        const code = this.column(row, indices, "LOINC_NUM");
        if (!code || !/^\d+-\d+$/.test(code)) {
          result.skipped++;
          errorCount++;
          if (errorCount <= MAX_RECORDED_ERRORS) {
            result.errors.push({
              code: "INVALID_IMPORT",
              message: "Row has a missing or malformed LOINC_NUM"
            });
          }
          continue;
        }

        try {
          const existing = this.db
            .select({ code: loinc.code })
            .from(loinc)
            .where(eq(loinc.code, code))
            .get();
          this.db
            .insert(loinc)
            .values({
              code,
              displayName: this.column(row, indices, "LONG_COMMON_NAME"),
              version: options.version,
              status: this.column(row, indices, "STATUS"),
              component: this.column(row, indices, "COMPONENT"),
              property: this.column(row, indices, "PROPERTY"),
              timeAspect: this.column(row, indices, "TIME_ASPCT"),
              system: this.column(row, indices, "SYSTEM"),
              scaleType: this.column(row, indices, "SCALE_TYP"),
              method: this.column(row, indices, "METHOD_TYP"),
              exampleUnits: this.column(row, indices, "EXAMPLE_UNITS"),
              exampleUcumUnits: this.column(row, indices, "EXAMPLE_UCUM_UNITS")
            })
            .onConflictDoUpdate({
              target: loinc.code,
              set: {
                displayName: this.column(row, indices, "LONG_COMMON_NAME"),
                version: options.version,
                status: this.column(row, indices, "STATUS"),
                component: this.column(row, indices, "COMPONENT"),
                property: this.column(row, indices, "PROPERTY"),
                timeAspect: this.column(row, indices, "TIME_ASPCT"),
                system: this.column(row, indices, "SYSTEM"),
                scaleType: this.column(row, indices, "SCALE_TYP"),
                method: this.column(row, indices, "METHOD_TYP"),
                exampleUnits: this.column(row, indices, "EXAMPLE_UNITS"),
                exampleUcumUnits: this.column(row, indices, "EXAMPLE_UCUM_UNITS")
              }
            })
            .run();
          if (existing) result.updated++;
          else result.inserted++;
        } catch (error) {
          result.skipped++;
          errorCount++;
          if (errorCount <= MAX_RECORDED_ERRORS) {
            result.errors.push({
              code: "INVALID_IMPORT",
              message: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
    });

    await this.recordImport("LOINC", options.version);

    if (!header) {
      throw new AppError(
        "INVALID_IMPORT",
        `LOINC file "${options.sourcePath}" was empty or unreadable`
      );
    }

    return result;
  }

  private buildIndices(header: string[]): Record<string, number> {
    const indices: Record<string, number> = {};
    for (const name of COLUMNS) {
      indices[name] = header.indexOf(name);
    }
    if (indices.LOINC_NUM === -1) {
      throw new AppError(
        "INVALID_IMPORT",
        "LOINC CSV header missing LOINC_NUM column"
      );
    }
    return indices;
  }

  private column(
    row: string[],
    indices: Record<string, number>,
    name: string
  ): string | null {
    const index = indices[name];
    if (index === undefined || index === -1) return null;
    const value = row[index];
    return value && value.trim() !== "" ? value : null;
  }

  private async recordImport(dataset: string, version: string): Promise<void> {
    const id = stableId("di", `${dataset}|${version}`);
    await this.transactions.run(async () => {
      this.db
        .insert(dataImport)
        .values({
          id,
          dataset,
          version,
          importedAt: new Date().toISOString(),
          status: "success"
        })
        .onConflictDoUpdate({
          target: dataImport.id,
          set: {
            importedAt: new Date().toISOString(),
            status: "success"
          }
        })
        .run();
    });
  }
}
