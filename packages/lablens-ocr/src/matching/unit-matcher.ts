import type {
  UnitMatch,
  UnitMatcher as UnitMatcherPort,
  UnitService,
  AnalyteMatch
} from "@lablens/core";
import { parseUnit } from "../parsing/unit-parser";

/**
 * Resolves an OCR'd unit string against the UCUM catalog. All alias/variant
 * data lives in the catalog (data/ucum/units.json); nothing is hardcoded here.
 * The `UnitService` performs a case-preserving lookup first (disambiguating
 * "G/l" giga/l from "g/l" gram/l) and a case-insensitive fallback.
 */
export class UnitMatcher implements UnitMatcherPort {
  private readonly units: UnitService;

  constructor(units: UnitService) {
    this.units = units;
  }

  async match(
    rawUnit: string,
    options?: { analyte?: AnalyteMatch | null }
  ): Promise<UnitMatch | null> {
    const parsed = parseUnit(rawUnit);
    if (!parsed) return null;

    const resolved = await this.units.normalize(parsed.cleaned);
    if (!resolved) return null;

    return {
      unitId: resolved.unitId,
      ucumCode: resolved.ucumCode,
      displayName: resolved.displayName,
      score: resolved.score,
      confidence: resolved.confidence,
      strategies: resolved.strategies,
      explanation: resolved.explanation
    };
  }
}
