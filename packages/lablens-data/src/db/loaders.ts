import { eq } from "drizzle-orm";
import type {
  Analyte,
  Bound,
  Comparator,
  Observation,
  ProvenanceSourceType,
  ReferenceRange,
  ConditionValue,
  Source,
  ConditionOperator
} from "@lablens/core";
import type { DatabaseClient } from "./client";
import {
  analyte,
  analyteLoinc,
  analyteName,
  analyteUnit,
  loinc,
  observation,
  observationProvenance,
  referenceCondition,
  referenceRange,
  source,
  testGroup,
  unit
} from "./schema";

export function parseConditionValue(
  value: string,
  valueType: string
): ConditionValue {
  if (valueType === "number") return Number(value);
  if (valueType === "boolean") return value === "true";
  return value;
}

export function serializeConditionValue(value: ConditionValue): {
  value: string;
  valueType: "string" | "number" | "boolean";
} {
  if (typeof value === "number") return { value: String(value), valueType: "number" };
  if (typeof value === "boolean") return { value: value ? "true" : "false", valueType: "boolean" };
  return { value, valueType: "string" };
}

function mapSource(row: typeof source.$inferSelect | undefined): Source | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    url: row.url ?? undefined,
    version: row.version ?? undefined,
    accessedAt: row.accessedAt ?? undefined
  };
}

export function loadAnalyte(db: DatabaseClient, id: string): Analyte | null {
  const row = db.select().from(analyte).where(eq(analyte.id, id)).get();
  if (!row) return null;

  const groupRow = row.groupId
    ? db.select().from(testGroup).where(eq(testGroup.id, row.groupId)).get()
    : undefined;

  const nameRows = db
    .select()
    .from(analyteName)
    .where(eq(analyteName.analyteId, id))
    .all();

  const loincRows = db
    .select({
      code: loinc.code,
      displayName: loinc.displayName,
      component: loinc.component,
      property: loinc.property,
      timeAspect: loinc.timeAspect,
      system: loinc.system,
      scaleType: loinc.scaleType,
      method: loinc.method,
      defaultUnit: loinc.defaultUnit
    })
    .from(analyteLoinc)
    .innerJoin(loinc, eq(analyteLoinc.loincCode, loinc.code))
    .where(eq(analyteLoinc.analyteId, id))
    .all();

  const unitRows = db
    .select({ unitId: analyteUnit.unitId })
    .from(analyteUnit)
    .where(eq(analyteUnit.analyteId, id))
    .all();

  return {
    id: row.id,
    key: row.key,
    displayName: row.displayName,
    group: groupRow
      ? {
          key: groupRow.key,
          name: groupRow.name,
          description: groupRow.description ?? undefined
        }
      : undefined,
    description: row.description ?? undefined,
    names: nameRows.map((n) => ({
      name: n.name,
      normalized: n.normalized,
      language: n.language ?? undefined,
      type: n.type as Analyte["names"][number]["type"],
      source: n.source ?? undefined
    })),
    loinc: loincRows.map((l) => ({
      code: l.code,
      displayName: l.displayName ?? undefined,
      component: l.component ?? undefined,
      property: l.property ?? undefined,
      timeAspect: l.timeAspect ?? undefined,
      system: l.system ?? undefined,
      scaleType: l.scaleType ?? undefined,
      method: l.method ?? undefined,
      defaultUnit: l.defaultUnit ?? undefined
    })),
    units: unitRows.map((u) => ({ unitId: u.unitId }))
  };
}

export function loadReferenceRange(
  db: DatabaseClient,
  id: string
): ReferenceRange | null {
  const row = db
    .select()
    .from(referenceRange)
    .where(eq(referenceRange.id, id))
    .get();
  if (!row) return null;

  const conditionRows = db
    .select()
    .from(referenceCondition)
    .where(eq(referenceCondition.referenceRangeId, id))
    .all();

  const sourceRow = row.sourceId
    ? db.select().from(source).where(eq(source.id, row.sourceId)).get()
    : undefined;

  return {
    id: row.id,
    analyteId: row.analyteId,
    unitId: row.unitId ?? undefined,
    type: row.type as ReferenceRange["type"],
    lower:
      row.lowerValue !== null && row.lowerOperator
        ? {
            value: row.lowerValue,
            operator: row.lowerOperator as Bound["operator"]
          }
        : undefined,
    upper:
      row.upperValue !== null && row.upperOperator
        ? {
            value: row.upperValue,
            operator: row.upperOperator as Bound["operator"]
          }
        : undefined,
    categoricalValue: row.categoricalValue ?? undefined,
    conditions: conditionRows.map((c) => ({
      id: c.id,
      field: c.field,
      operator: c.operator as ConditionOperator,
      value: parseConditionValue(c.value, c.valueType)
    })),
    source: mapSource(sourceRow)
  };
}

export function loadObservation(
  db: DatabaseClient,
  id: string
): Observation | null {
  const row = db
    .select()
    .from(observation)
    .where(eq(observation.id, id))
    .get();
  if (!row) return null;

  const provenanceRow = db
    .select()
    .from(observationProvenance)
    .where(eq(observationProvenance.observationId, id))
    .get();

  return {
    id: row.id,
    userId: row.userId,
    analyteId: row.analyteId,
    valueNumeric: row.valueNumeric ?? undefined,
    valueText: row.valueText ?? undefined,
    comparator: (row.comparator ?? undefined) as Comparator | undefined,
    unitId: row.unitId ?? undefined,
    measuredAt: row.measuredAt,
    provenance: provenanceRow
      ? {
          sourceType: provenanceRow.sourceType as ProvenanceSourceType,
          originalName: provenanceRow.originalName ?? undefined,
          originalValue: provenanceRow.originalValue ?? undefined,
          originalUnit: provenanceRow.originalUnit ?? undefined,
          extractionMethod: provenanceRow.extractionMethod ?? undefined,
          extractionEngine: provenanceRow.extractionEngine ?? undefined,
          extractionEngineVersion:
            provenanceRow.extractionEngineVersion ?? undefined,
          confidence: provenanceRow.confidence ?? undefined,
          createdAt: provenanceRow.createdAt
        }
      : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function loadObservationIds(
  db: DatabaseClient,
  ids: string[]
): Observation[] {
  return ids
    .map((id) => loadObservation(db, id))
    .filter((o): o is Observation => o !== null);
}

export function listUnitIdsForAnalyte(db: DatabaseClient, id: string): string[] {
  return db
    .select({ unitId: analyteUnit.unitId })
    .from(analyteUnit)
    .where(eq(analyteUnit.analyteId, id))
    .all()
    .map((u) => u.unitId);
}

export { unit };
