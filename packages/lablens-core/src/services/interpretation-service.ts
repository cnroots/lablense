import type { Observation } from "../domain/observation";
import type { ReferenceRange } from "../domain/reference-range";
import type { PatientContext } from "../domain/patient-context";
import type { UnitRepository } from "../repositories/unit-repository";
import type { UnitService } from "../domain/unit";
import type { ReferenceRangeResolver } from "./reference-range-service";

export type InterpretationStatus = "low" | "normal" | "high" | "unknown";

export interface InterpretedObservation {
  observation: Observation;
  status: InterpretationStatus;
  referenceRange?: ReferenceRange;
  explanation?: string;
}

function normalizeCategorical(value: string): string {
  return value.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function interpretCategoricalStatus(
  valueText: string | undefined,
  range: ReferenceRange
): InterpretationStatus {
  if (valueText === undefined || valueText.trim() === "") return "unknown";
  const expected = range.categoricalValue;
  if (expected === undefined || expected === "") return "unknown";
  const actual = normalizeCategorical(valueText);
  const target = normalizeCategorical(expected);
  if (actual === target) return "normal";
  return "high";
}

export function interpretNumericStatus(
  bound: number | undefined,
  comparator: Observation["comparator"] | undefined,
  range: ReferenceRange
): InterpretationStatus {
  if (bound === undefined || !Number.isFinite(bound)) return "unknown";
  const lower = range.lower;
  const upper = range.upper;
  const L = lower?.value;
  const U = upper?.value;

  if (comparator === undefined || comparator === "=") {
    if (L !== undefined) {
      const belowLower =
        (lower!.operator === ">" && bound <= L) ||
        (lower!.operator === ">=" && bound < L);
      if (belowLower) return "low";
    }
    if (U !== undefined) {
      const aboveUpper =
        (upper!.operator === "<" && bound >= U) ||
        (upper!.operator === "<=" && bound > U);
      if (aboveUpper) return "high";
    }
    return "normal";
  }

  if (comparator === "<" || comparator === "<=") {
    if (L !== undefined && bound <= L) return "low";
    if (U !== undefined && bound <= U) return "normal";
    if (U !== undefined && bound > U) return "unknown";
    return "unknown";
  }

  if (comparator === ">" || comparator === ">=") {
    if (U !== undefined && bound >= U) return "high";
    if (L !== undefined && bound >= L) return "normal";
    return "unknown";
  }

  return "unknown";
}

export interface InterpretationService {
  interpret(
    observation: Observation,
    context: PatientContext
  ): Promise<InterpretedObservation>;
}

export class InterpretationServiceImpl implements InterpretationService {
  private readonly resolver: ReferenceRangeResolver;
  private readonly unitService: UnitService;
  private readonly units: UnitRepository;

  constructor(
    resolver: ReferenceRangeResolver,
    unitService: UnitService,
    units: UnitRepository
  ) {
    this.resolver = resolver;
    this.unitService = unitService;
    this.units = units;
  }

  async interpret(
    observation: Observation,
    context: PatientContext
  ): Promise<InterpretedObservation> {
    const resolution = await this.resolver.resolve(
      observation.analyteId,
      observation.unitId,
      context
    );

    if (resolution.status !== "resolved" || !resolution.referenceRange) {
      return {
        observation,
        status: "unknown",
        explanation:
          resolution.explanation ?? "No applicable reference range resolved"
      };
    }

    const range = resolution.referenceRange;

    if (range.type === "categorical") {
      const status = interpretCategoricalStatus(observation.valueText, range);
      return {
        observation,
        status,
        referenceRange: range,
        explanation: `Categorical comparison against "${range.categoricalValue ?? ""}"`
      };
    }

    let bound = observation.valueNumeric;
    if (bound !== undefined && range.unitId && observation.unitId) {
      if (range.unitId !== observation.unitId) {
        const fromUnit = await this.units.findById(observation.unitId);
        const toUnit = await this.units.findById(range.unitId);
        if (fromUnit && toUnit) {
          try {
            bound = this.unitService.convert(
              bound,
              fromUnit.ucumCode,
              toUnit.ucumCode
            );
          } catch {
            return {
              observation,
              status: "unknown",
              referenceRange: range,
              explanation:
                `Cannot convert ${fromUnit.ucumCode} to ${toUnit.ucumCode}`
            };
          }
        }
      }
    }

    const status = interpretNumericStatus(bound, observation.comparator, range);
    return {
      observation,
      status,
      referenceRange: range,
      explanation: `Numeric comparison against reference range`
    };
  }
}
