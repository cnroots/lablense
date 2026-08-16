import { eq } from "drizzle-orm";
import { z } from "zod";
import type { ImportResult, TransactionRunner } from "@lablens/core";
import { AppError, normalizeUnit } from "@lablens/core";
import type { DatabaseClient } from "../db/client";
import { dataImport, unit, unitName } from "../db/schema";
import { emptyImportResult, stableId } from "./importer";
import type { Importer } from "./importer";

const ucumUnitSchema = z.object({
  code: z.string().min(1),
  names: z.array(z.string().min(1)).default([])
});

const ucumDataSchema = z.object({
  version: z.string().default("1.0"),
  units: z.array(ucumUnitSchema).default([])
});

export interface UcumImporterOptions {
  data: unknown;
}

export class UcumImporter implements Importer<UcumImporterOptions> {
  private readonly db: DatabaseClient;
  private readonly transactions: TransactionRunner;

  constructor(db: DatabaseClient, transactions: TransactionRunner) {
    this.db = db;
    this.transactions = transactions;
  }

  async import(options: UcumImporterOptions): Promise<ImportResult> {
    const result = emptyImportResult();

    const parsed = ucumDataSchema.safeParse(options.data);
    if (!parsed.success) {
      throw new AppError(
        "INVALID_IMPORT",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      );
    }
    const data = parsed.data;

    await this.transactions.run(async () => {
      for (const u of data.units) {
        const unitId = stableId("unit", u.code);
        const existing = this.db
          .select({ id: unit.id })
          .from(unit)
          .where(eq(unit.id, unitId))
          .get();
        const displayName = u.names[0] ?? u.code;
        if (existing) {
          this.db
            .update(unit)
            .set({ displayName })
            .where(eq(unit.id, unitId))
            .run();
          result.updated++;
        } else {
          this.db
            .insert(unit)
            .values({ id: unitId, ucumCode: u.code, displayName })
            .run();
          result.inserted++;
        }

        this.db.delete(unitName).where(eq(unitName.unitId, unitId)).run();
        const aliases = new Set<string>([u.code, ...u.names]);
        for (const alias of aliases) {
          this.db
            .insert(unitName)
            .values({
              id: stableId("un", `${unitId}|${alias}`),
              unitId,
              name: alias,
              normalized: normalizeUnit(alias)
            })
            .run();
        }
      }

      const id = stableId("di", `UCUM|${data.version}`);
      this.db
        .insert(dataImport)
        .values({
          id,
          dataset: "UCUM",
          version: data.version,
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

    return result;
  }
}
