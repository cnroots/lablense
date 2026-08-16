import type { AnalyteMatch, ExtractedLabValue, UnitMatch } from "../domain/import";

export interface AnalyteMatcher {
  match(value: ExtractedLabValue): Promise<AnalyteMatch | null>;
}

export interface UnitMatcher {
  match(
    rawUnit: string,
    options?: { analyte?: AnalyteMatch | null }
  ): Promise<UnitMatch | null>;
}
