import type {
  AnalyteMatch,
  CommitOptions,
  CommitResult,
  ConfirmedLabValue,
  ConfidenceBreakdown,
  ExtractedLabValue,
  ImportCandidate,
  ImportPreviewOptions,
  UnitMatch
} from "../domain/import";
import {
  DEFAULT_MIN_CONFIDENCE,
  DEFAULT_REVIEW_CONFIDENCE,
  overallConfidence
} from "../domain/import";
import type { NewObservation } from "../domain/observation";
import type { AnalyteMatcher, UnitMatcher } from "../ports/matchers";
import type { ValueParser } from "../ports/value-parser";
import type { Clock } from "../ports/clock";
import type { AnalyteRepository } from "../repositories/analyte-repository";
import type { UnitRepository } from "../repositories/unit-repository";
import type { ObservationService } from "./observation-service";
import { AppError, isAppError } from "../errors";
import { confirmedLabValueSchema } from "../validation";

export interface ImportService {
  preview(
    values: ExtractedLabValue[],
    options?: ImportPreviewOptions
  ): Promise<ImportCandidate[]>;

  commit(
    userId: string,
    candidates: ConfirmedLabValue[],
    options?: CommitOptions
  ): Promise<CommitResult>;
}

export class ImportServiceImpl implements ImportService {
  private readonly observationService: ObservationService;
  private readonly analyteMatcher: AnalyteMatcher;
  private readonly unitMatcher: UnitMatcher;
  private readonly valueParser: ValueParser;
  private readonly analytes: AnalyteRepository;
  private readonly units: UnitRepository;
  private readonly clock: Clock;

  constructor(deps: {
    observationService: ObservationService;
    analyteMatcher: AnalyteMatcher;
    unitMatcher: UnitMatcher;
    valueParser: ValueParser;
    analytes: AnalyteRepository;
    units: UnitRepository;
    clock: Clock;
  }) {
    this.observationService = deps.observationService;
    this.analyteMatcher = deps.analyteMatcher;
    this.unitMatcher = deps.unitMatcher;
    this.valueParser = deps.valueParser;
    this.analytes = deps.analytes;
    this.units = deps.units;
    this.clock = deps.clock;
  }

  async preview(
    values: ExtractedLabValue[],
    options?: ImportPreviewOptions
  ): Promise<ImportCandidate[]> {
    const reviewConfidence =
      options?.reviewConfidence ?? DEFAULT_REVIEW_CONFIDENCE;
    const minConfidence = options?.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    const candidates = await Promise.all(
      values.map((value) =>
        this.previewOne(value, reviewConfidence, minConfidence)
      )
    );
    return candidates;
  }

  private async previewOne(
    value: ExtractedLabValue,
    reviewConfidence: number,
    minConfidence: number
  ): Promise<ImportCandidate> {
    const parsed = this.valueParser.parse(value.rawValue);

    let analyte: AnalyteMatch | null = null;
    try {
      analyte = await this.analyteMatcher.match(value);
    } catch {
      analyte = null;
    }

    let unit: UnitMatch | null = null;
    if (value.rawUnit) {
      try {
        unit = await this.unitMatcher.match(value.rawUnit, { analyte });
      } catch {
        unit = null;
      }
    }

    const valueConfidence = !parsed.ok ? 0 : parsed.value !== undefined ? 0.99 : 0.85;
    const unitConfidence = value.rawUnit ? (unit ? unit.score : 0) : undefined;
    const overall = overallConfidence([
      value.confidence,
      valueConfidence,
      analyte?.score,
      unitConfidence
    ]);

    const confidence: ConfidenceBreakdown = {
      ocr: value.confidence,
      analyte: analyte
        ? { key: analyte.analyteKey, confidence: analyte.score }
        : undefined,
      unit: unit ? { ucum: unit.ucumCode, confidence: unit.score } : undefined,
      value: {
        numeric: parsed.value,
        text: parsed.valueText,
        confidence: valueConfidence
      },
      overallConfidence: overall
    };

    const status = this.determineStatus(
      parsed.ok,
      analyte,
      unit,
      value.rawUnit,
      overall,
      reviewConfidence,
      minConfidence
    );

    return {
      rawName: value.rawName,
      rawValue: value.rawValue,
      rawUnit: value.rawUnit,
      analyte: analyte ?? undefined,
      unit: unit ?? undefined,
      parsedValue: parsed.value,
      parsedText: parsed.valueText,
      comparator: parsed.comparator,
      measuredAt: value.measuredAt,
      confidence,
      status
    };
  }

  private determineStatus(
    valueOk: boolean,
    analyte: AnalyteMatch | null,
    unit: UnitMatch | null,
    rawUnit: string | undefined,
    overall: number,
    reviewConfidence: number,
    minConfidence: number
  ): ImportCandidate["status"] {
    if (!valueOk) return "invalid";
    if (!analyte) return "unmatched";
    if (rawUnit && !unit) return "needs_review";
    if (analyte.confidence === "low" || overall < minConfidence) {
      return "needs_review";
    }
    if (overall >= reviewConfidence) return "matched";
    return "needs_review";
  }

  async commit(
    userId: string,
    candidates: ConfirmedLabValue[],
    options?: CommitOptions
  ): Promise<CommitResult> {
    const sourceType = options?.sourceType ?? "import";
    const result: CommitResult = { inserted: [], duplicates: [], errors: [] };
    const toInsert: NewObservation[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      try {
        const parsed = confirmedLabValueSchema.safeParse(candidate);
        if (!parsed.success) {
          throw new AppError(
            "INVALID_IMPORT",
            parsed.error.issues.map((issue) => issue.message).join("; ")
          );
        }
        const confirmed = parsed.data;

        const analyte = await this.analytes.findById(confirmed.analyteId);
        if (!analyte) {
          throw new AppError(
            "ANALYTE_NOT_FOUND",
            `Analyte "${confirmed.analyteId}" not found`
          );
        }
        if (confirmed.unitId) {
          const unit = await this.units.findById(confirmed.unitId);
          if (!unit) {
            throw new AppError(
              "UNIT_NOT_FOUND",
              `Unit "${confirmed.unitId}" not found`
            );
          }
        }

        const duplicates = await this.observationService.findDuplicates(
          userId,
          [
            {
              analyteId: confirmed.analyteId,
              valueNumeric: confirmed.valueNumeric,
              valueText: confirmed.valueText,
              unitId: confirmed.unitId,
              measuredAt: confirmed.measuredAt
            }
          ]
        );
        if (duplicates.length > 0) {
          for (const dup of duplicates) result.duplicates.push(dup.id);
          continue;
        }

        toInsert.push(
          this.buildNewObservation(confirmed, sourceType)
        );
      } catch (error) {
        result.errors.push({
          code: isAppError(error) ? error.code : "INVALID_IMPORT",
          message: error instanceof Error ? error.message : String(error),
          index: i
        });
      }
    }

    if (toInsert.length > 0) {
      try {
        const inserted = await this.observationService.createMany(
          userId,
          toInsert
        );
        result.inserted.push(...inserted.map((observation) => observation.id));
      } catch (error) {
        result.errors.push({
          code: isAppError(error) ? error.code : "INVALID_IMPORT",
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return result;
  }

  private buildNewObservation(
    confirmed: ConfirmedLabValue,
    sourceType: NonNullable<CommitOptions["sourceType"]>
  ): NewObservation {
    return {
      analyteId: confirmed.analyteId,
      valueNumeric: confirmed.valueNumeric,
      valueText: confirmed.valueText,
      comparator: confirmed.comparator,
      unitId: confirmed.unitId,
      measuredAt: confirmed.measuredAt,
      provenance: {
        sourceType,
        originalName: confirmed.rawName,
        originalValue: confirmed.rawValue,
        originalUnit: confirmed.rawUnit,
        confidence: confirmed.confidence,
        createdAt: this.clock.nowISO()
      }
    };
  }
}
