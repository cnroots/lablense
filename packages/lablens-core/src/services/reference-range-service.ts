import type {
  ReferenceCondition,
  ReferenceRange,
  ReferenceResolution
} from "../domain/reference-range";
import type { PatientContext } from "../domain/patient-context";
import type { ReferenceRangeRepository } from "../repositories/reference-range-repository";

export interface ReferenceRangeResolver {
  resolve(
    analyteId: string,
    unitId: string | undefined,
    context: PatientContext
  ): Promise<ReferenceResolution>;
}

const FIELD_WEIGHTS: Record<string, number> = {
  pregnant: 1000,
  sex: 500,
  age: 400,
  ageYears: 400,
  fasting: 300,
  specimen: 200,
  method: 100,
  laboratory: 50
};

const DEFAULT_WEIGHT = 10;

const UNIT_MATCH_WEIGHT = 2;
const UNIT_LESS_WEIGHT = 1;
const UNIT_MISMATCH_WEIGHT = 0;

function resolveContextValue(
  field: string,
  context: PatientContext
): string | number | boolean | undefined {
  switch (field) {
    case "age":
    case "ageYears":
      return context.ageYears;
    case "sex":
      return context.sex;
    case "pregnant":
      return context.pregnant;
    case "fasting":
      return context.fasting;
    default:
      return context.conditions?.[field];
  }
}

function compare(
  actual: string | number | boolean,
  operator: ReferenceCondition["operator"],
  expected: string | number | boolean
): boolean {
  switch (operator) {
    case "eq":
      return actual === expected;
    case "ne":
      return actual !== expected;
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
  }
}

export function evaluateCondition(
  condition: ReferenceCondition,
  context: PatientContext
): boolean {
  const actual = resolveContextValue(condition.field, context);
  if (actual === undefined) return false;
  return compare(actual, condition.operator, condition.value);
}

function specificityScore(
  range: ReferenceRange,
  unitId: string | undefined
): number {
  let score = 0;
  for (const condition of range.conditions) {
    score += FIELD_WEIGHTS[condition.field] ?? DEFAULT_WEIGHT;
  }
  if (unitId !== undefined) {
    if (range.unitId === unitId) {
      score += UNIT_MATCH_WEIGHT;
    } else if (range.unitId === undefined || range.unitId === null) {
      score += UNIT_LESS_WEIGHT;
    } else {
      score += UNIT_MISMATCH_WEIGHT;
    }
  }
  return score;
}

function rangeSignature(range: ReferenceRange): string {
  const lower = range.lower
    ? `${range.lower.operator}${range.lower.value}`
    : "-";
  const upper = range.upper
    ? `${range.upper.operator}${range.upper.value}`
    : "-";
  return [
    range.type,
    range.unitId ?? "-",
    lower,
    upper,
    range.categoricalValue ?? "-"
  ].join("|");
}

export class ReferenceRangeResolverImpl implements ReferenceRangeResolver {
  private readonly repository: ReferenceRangeRepository;

  constructor(repository: ReferenceRangeRepository) {
    this.repository = repository;
  }

  async resolve(
    analyteId: string,
    unitId: string | undefined,
    context: PatientContext
  ): Promise<ReferenceResolution> {
    const all = await this.repository.findByAnalyte(analyteId);

    const applicable = all.filter((range) =>
      range.conditions.every((condition) =>
        evaluateCondition(condition, context)
      )
    );

    if (applicable.length === 0) {
      return {
        status: "none",
        explanation: `No applicable reference range for analyte "${analyteId}"`
      };
    }

    const scored = applicable.map((range) => ({
      range,
      score: specificityScore(range, unitId)
    }));

    scored.sort((a, b) => b.score - a.score);
    const bestScore = scored[0]?.score ?? 0;
    const best = scored
      .filter((entry) => entry.score === bestScore)
      .map((entry) => entry.range);

    const unique = new Map<string, ReferenceRange>();
    for (const range of best) {
      const sig = rangeSignature(range);
      if (!unique.has(sig)) unique.set(sig, range);
    }
    const uniqueRanges = [...unique.values()];

    if (uniqueRanges.length === 1) {
      const range = uniqueRanges[0]!;
      return {
        status: "resolved",
        referenceRange: range,
        explanation: `Resolved most specific reference range (score ${bestScore})`
      };
    }

    return {
      status: "ambiguous",
      candidates: uniqueRanges,
      explanation:
        `Multiple equally specific reference ranges (score ${bestScore}) ` +
        `apply; refusing to pick arbitrarily`
    };
  }
}
