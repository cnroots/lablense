import { eq } from "drizzle-orm";
import { z } from "zod";
import type { ImportResult, TransactionRunner } from "@lablens/core";
import { AppError, normalizeTerm, normalizeUnit } from "@lablens/core";
import type { DatabaseClient } from "../db/client";
import {
  analyte,
  analyteLoinc,
  analyteName,
  analyteUnit,
  dataImport,
  loinc,
  referenceCondition,
  referenceRange,
  source,
  testGroup,
  unit,
  unitName
} from "../db/schema";
import { serializeConditionValue } from "../db/loaders";
import { emptyImportResult, stableId } from "./importer";
import type { Importer } from "./importer";

const boundSchema = z.object({
  value: z.number().finite(),
  operator: z.enum(["<", "<=", ">", ">="])
});

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["eq", "ne", "gt", "gte", "lt", "lte"]),
  value: z.union([z.string(), z.number(), z.boolean()])
});

const referenceRangeSchema = z.object({
  type: z.enum(["numeric", "categorical"]),
  unit: z.string().optional(),
  lower: boundSchema.optional(),
  upper: boundSchema.optional(),
  categoricalValue: z.string().optional(),
  conditions: z.array(conditionSchema).default([])
});

const unitSchema = z.object({
  ucum: z.string().min(1),
  display: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([])
});

const nameSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["canonical", "synonym", "abbreviation"]),
  language: z.string().optional()
});

const testSchema = z.object({
  key: z.string().min(1),
  displayName: z.string().min(1),
  group: z.string().optional(),
  description: z.string().optional(),
  loinc: z.string().optional(),
  names: z.array(nameSchema).default([]),
  units: z.array(unitSchema).default([]),
  referenceRanges: z.array(referenceRangeSchema).default([])
});

const groupSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional()
});

const appDataSchema = z.object({
  version: z.string().default("1.0"),
  source: z.object({
    name: z.string().min(1),
    version: z.string().optional(),
    url: z.string().optional()
  }),
  groups: z.array(groupSchema).default([]),
  tests: z.array(testSchema).default([])
});

export interface AppDataImporterOptions {
  data: unknown;
}

export class AppDataImporter implements Importer<AppDataImporterOptions> {
  private readonly db: DatabaseClient;
  private readonly transactions: TransactionRunner;

  constructor(db: DatabaseClient, transactions: TransactionRunner) {
    this.db = db;
    this.transactions = transactions;
  }

  async import(options: AppDataImporterOptions): Promise<ImportResult> {
    const result = emptyImportResult();
    const parsed = appDataSchema.safeParse(options.data);
    if (!parsed.success) {
      throw new AppError(
        "INVALID_IMPORT",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      );
    }
    const data = parsed.data;

    await this.transactions.run(async () => {
      const sourceId = this.upsertSource(data.source);

      for (const group of data.groups) {
        const status = this.upsertGroup(group);
        if (status === "inserted") result.inserted++;
        else result.updated++;
      }

      const unitIds = new Map<string, string>();
      const existingUnits = this.db.select().from(unit).all();
      for (const u of existingUnits) {
        unitIds.set(u.ucumCode, u.id);
      }

      const aliasesByUnit = new Map<string, Set<string>>();
      for (const test of data.tests) {
        for (const u of test.units) {
          const set = aliasesByUnit.get(u.ucum) ?? new Set<string>();
          set.add(u.ucum);
          set.add(u.display);
          for (const alias of u.aliases) set.add(alias);
          aliasesByUnit.set(u.ucum, set);
        }
      }

      for (const [ucum, aliases] of aliasesByUnit) {
        const display =
          data.tests.flatMap((t) => t.units).find((u) => u.ucum === ucum)
            ?.display ?? ucum;
        this.upsertUnit(ucum, display, aliases, unitIds);
      }

      for (const test of data.tests) {
        const { id: analyteId, status } = this.upsertAnalyte(test, sourceId);
        if (status === "inserted") result.inserted++;
        else result.updated++;

        this.replaceNames(analyteId, test);
        this.linkUnits(analyteId, test, unitIds);
        this.linkLoinc(analyteId, test);
        this.replaceReferenceRanges(analyteId, test, unitIds, sourceId);
      }

      this.recordImport("application", data.version);
    });

    return result;
  }

  private upsertSource(info: {
    name: string;
    version?: string;
    url?: string;
  }): string {
    const id = stableId("src", info.name);
    const existing = this.db
      .select({ id: source.id })
      .from(source)
      .where(eq(source.id, id))
      .get();
    const values = {
      id,
      name: info.name,
      version: info.version ?? null,
      url: info.url ?? null,
      accessedAt: new Date().toISOString()
    };
    if (existing) {
      this.db.update(source).set(values).where(eq(source.id, id)).run();
    } else {
      this.db.insert(source).values(values).run();
    }
    return id;
  }

  private upsertGroup(group: z.infer<typeof groupSchema>): "inserted" | "updated" {
    const id = `group_${group.key}`;
    const existing = this.db
      .select({ id: testGroup.id })
      .from(testGroup)
      .where(eq(testGroup.id, id))
      .get();
    this.db
      .insert(testGroup)
      .values({
        id,
        key: group.key,
        name: group.name,
        description: group.description ?? null
      })
      .onConflictDoUpdate({
        target: testGroup.key,
        set: {
          name: group.name,
          description: group.description ?? null
        }
      })
      .run();
    return existing ? "updated" : "inserted";
  }

  private upsertAnalyte(
    test: z.infer<typeof testSchema>,
    sourceId: string
  ): { id: string; status: "inserted" | "updated" } {
    const id = `analyte_${test.key}`;
    const groupId = test.group ? `group_${test.group}` : null;
    const existing = this.db
      .select({ id: analyte.id })
      .from(analyte)
      .where(eq(analyte.id, id))
      .get();
    this.db
      .insert(analyte)
      .values({
        id,
        key: test.key,
        displayName: test.displayName,
        groupId,
        description: test.description ?? null
      })
      .onConflictDoUpdate({
        target: analyte.key,
        set: {
          displayName: test.displayName,
          groupId,
          description: test.description ?? null
        }
      })
      .run();
    return { id, status: existing ? "updated" : "inserted" };
  }

  private replaceNames(
    analyteId: string,
    test: z.infer<typeof testSchema>
  ): void {
    this.db
      .delete(analyteName)
      .where(eq(analyteName.analyteId, analyteId))
      .run();

    const names = [...test.names];
    const hasCanonical = names.some((n) => n.type === "canonical");
    if (!hasCanonical) {
      names.push({ name: test.displayName, type: "canonical" });
    }

    for (const name of names) {
      this.db
        .insert(analyteName)
        .values({
          id: stableId("an", `${analyteId}|${name.type}|${name.name}`),
          analyteId,
          name: name.name,
          normalized: normalizeTerm(name.name),
          language: name.language ?? null,
          type: name.type,
          source: null
        })
        .run();
    }
  }

  private linkUnits(
    analyteId: string,
    test: z.infer<typeof testSchema>,
    unitIds: Map<string, string>
  ): void {
    this.db
      .delete(analyteUnit)
      .where(eq(analyteUnit.analyteId, analyteId))
      .run();

    for (const u of test.units) {
      const unitId = unitIds.get(u.ucum);
      if (!unitId) continue;
      this.db
        .insert(analyteUnit)
        .values({ analyteId, unitId })
        .onConflictDoNothing()
        .run();
    }
  }

  /**
   * Links an analyte to its curated LOINC code. The link is only created when
   * the code already exists in the `loinc` table (i.e. the LOINC distribution
   * was imported first); on runtimes without LOINC the German/English names
   * already carried in the seed are sufficient for matching.
   */
  private linkLoinc(
    analyteId: string,
    test: z.infer<typeof testSchema>
  ): void {
    if (!test.loinc) return;
    const exists = this.db
      .select({ code: loinc.code })
      .from(loinc)
      .where(eq(loinc.code, test.loinc))
      .get();
    if (!exists) return;
    this.db
      .insert(analyteLoinc)
      .values({ analyteId, loincCode: test.loinc })
      .onConflictDoNothing()
      .run();
  }

  private upsertUnit(
    ucum: string,
    display: string,
    aliases: Set<string>,
    unitIds: Map<string, string>
  ): string {
    let unitId = unitIds.get(ucum);
    if (!unitId) {
      unitId = stableId("unit", ucum);
      this.db
        .insert(unit)
        .values({ id: unitId, ucumCode: ucum, displayName: display })
        .onConflictDoUpdate({
          target: unit.ucumCode,
          set: { displayName: display }
        })
        .run();
      unitIds.set(ucum, unitId);
    } else {
      this.db
        .update(unit)
        .set({ displayName: display })
        .where(eq(unit.id, unitId))
        .run();
    }

    this.db.delete(unitName).where(eq(unitName.unitId, unitId)).run();
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
    return unitId;
  }

  private replaceReferenceRanges(
    analyteId: string,
    test: z.infer<typeof testSchema>,
    unitIds: Map<string, string>,
    sourceId: string
  ): void {
    const existing = this.db
      .select({ id: referenceRange.id })
      .from(referenceRange)
      .where(eq(referenceRange.analyteId, analyteId))
      .all();
    for (const row of existing) {
      this.db
        .delete(referenceCondition)
        .where(eq(referenceCondition.referenceRangeId, row.id))
        .run();
      this.db.delete(referenceRange).where(eq(referenceRange.id, row.id)).run();
    }

    test.referenceRanges.forEach((range, index) => {
      const rangeId = `rr_${test.key}_${index}`;
      const unitId = range.unit ? unitIds.get(range.unit) : undefined;
      this.db
        .insert(referenceRange)
        .values({
          id: rangeId,
          analyteId,
          unitId: unitId ?? null,
          type: range.type,
          lowerValue: range.lower?.value ?? null,
          lowerOperator: range.lower?.operator ?? null,
          upperValue: range.upper?.value ?? null,
          upperOperator: range.upper?.operator ?? null,
          categoricalValue: range.categoricalValue ?? null,
          sourceId
        })
        .run();

      range.conditions.forEach((condition) => {
        const serialized = serializeConditionValue(condition.value);
        this.db
          .insert(referenceCondition)
          .values({
            id: stableId(
              "rc",
              `${rangeId}|${condition.field}|${condition.operator}|${serialized.value}`
            ),
            referenceRangeId: rangeId,
            field: condition.field,
            operator: condition.operator,
            value: serialized.value,
            valueType: serialized.valueType
          })
          .run();
      });
    });
  }

  private recordImport(dataset: string, version: string): void {
    const id = stableId("di", `${dataset}|${version}`);
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
  }
}
