import { eq } from "drizzle-orm";
import { z } from "zod";
import type { ImportResult, TransactionRunner } from "@lablens/core";
import { AppError, normalizeUnit } from "@lablens/core";
import type { DatabaseClient } from "../db/client";
import { dataImport, loinc, unit, unitName } from "../db/schema";
import { emptyImportResult, stableId } from "./importer";
import type { Importer } from "./importer";

/**
 * Bundled (JSON) LOINC blood catalog importer. Consumes the artifact emitted by
 * `scripts/build-loinc-blood-catalog.ts` (`apps/mobile/src/loinc-data.json`).
 *
 * Unlike the streaming CSV `LoincImporter`, this importer is fully portable
 * (no Node I/O), so it runs on-device from the bundled catalog. It upserts
 * blood-related LOINC rows, records their **default metric** (primary UCUM
 * unit) and registers those default metric units so the app can resolve them.
 */
const entrySchema = z.object({
  c: z.string().regex(/^\d+-\d+$/, "Malformed LOINC_NUM"),
  n: z.string().nullable().optional(),
  comp: z.string().nullable().optional(),
  p: z.string().nullable().optional(),
  t: z.string().nullable().optional(),
  sys: z.string().nullable().optional(),
  sc: z.string().nullable().optional(),
  m: z.string().nullable().optional(),
  st: z.string().nullable().optional(),
  eu: z.string().nullable().optional(),
  uu: z.string().nullable().optional(),
  def: z.string().nullable().optional()
});

const unitEntrySchema = z.object({
  code: z.string().min(1),
  names: z.array(z.string().min(1)).default([])
});

const loincBloodSchema = z.object({
  version: z.string().default("1.0"),
  entries: z.array(entrySchema).default([]),
  units: z.array(unitEntrySchema).default([])
});

export interface LoincJsonImporterOptions {
  data: unknown;
}

const DATASET = "LOINC.BLOOD";

export class LoincJsonImporter implements Importer<LoincJsonImporterOptions> {
  private readonly db: DatabaseClient;
  private readonly transactions: TransactionRunner;

  constructor(db: DatabaseClient, transactions: TransactionRunner) {
    this.db = db;
    this.transactions = transactions;
  }

  async import(options: LoincJsonImporterOptions): Promise<ImportResult> {
    const result = emptyImportResult();

    const parsed = loincBloodSchema.safeParse(options.data);
    if (!parsed.success) {
      throw new AppError(
        "INVALID_IMPORT",
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")
      );
    }
    const data = parsed.data;

    await this.transactions.run(async () => {
      this.registerUnits(data.units);

      for (const entry of data.entries) {
        const existing = this.db
          .select({ code: loinc.code })
          .from(loinc)
          .where(eq(loinc.code, entry.c))
          .get();

        this.db
          .insert(loinc)
          .values({
            code: entry.c,
            displayName: entry.n ?? null,
            version: data.version,
            status: entry.st ?? null,
            component: entry.comp ?? null,
            property: entry.p ?? null,
            timeAspect: entry.t ?? null,
            system: entry.sys ?? null,
            scaleType: entry.sc ?? null,
            method: entry.m ?? null,
            exampleUnits: entry.eu ?? null,
            exampleUcumUnits: entry.uu ?? null,
            defaultUnit: entry.def ?? null
          })
          .onConflictDoUpdate({
            target: loinc.code,
            set: {
              displayName: entry.n ?? null,
              version: data.version,
              status: entry.st ?? null,
              component: entry.comp ?? null,
              property: entry.p ?? null,
              timeAspect: entry.t ?? null,
              system: entry.sys ?? null,
              scaleType: entry.sc ?? null,
              method: entry.m ?? null,
              exampleUnits: entry.eu ?? null,
              exampleUcumUnits: entry.uu ?? null,
              defaultUnit: entry.def ?? null
            }
          })
          .run();

        if (existing) result.updated++;
        else result.inserted++;
      }

      this.recordImport(data.version);
    });

    return result;
  }

  /**
   * Registers the default-metric units used by the blood catalog. Existing
   * curated aliases (from the UCUM catalog) are preserved; the canonical UCUM
   * code is always present as a name so `UnitService.normalize` can resolve
   * it.
   */
  private registerUnits(units: z.infer<typeof unitEntrySchema>[]): void {
    for (const u of units) {
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
      } else {
        this.db
          .insert(unit)
          .values({ id: unitId, ucumCode: u.code, displayName })
          .onConflictDoNothing()
          .run();
      }

      for (const alias of new Set([u.code, ...u.names])) {
        this.db
          .insert(unitName)
          .values({
            id: stableId("un", `${unitId}|${alias}`),
            unitId,
            name: alias,
            normalized: normalizeUnit(alias)
          })
          .onConflictDoNothing()
          .run();
      }
    }
  }

  private recordImport(version: string): void {
    const id = stableId("di", `${DATASET}|${version}`);
    this.db
      .insert(dataImport)
      .values({
        id,
        dataset: DATASET,
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
  }
}