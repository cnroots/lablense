import type { Comparator } from "./observation";
import type { MatchConfidence, UnitMatch } from "./unit";

export type { UnitMatch } from "./unit";

export interface ExtractedLabValue {
  rawName: string;
  rawValue: string;
  rawUnit?: string;
  rawReference?: string;

  value?: number;
  comparator?: Comparator;

  measuredAt?: string;

  confidence: number;
}

export interface AnalyteMatch {
  analyteKey: string;
  analyteId?: string;
  displayName?: string;
  score: number;
  confidence: MatchConfidence;
  strategies: string[];
  explanation?: string;
}

export interface ValueConfidence {
  numeric?: number;
  text?: string;
  confidence: number;
}

export interface AnalyteConfidence {
  key?: string;
  confidence: number;
}

export interface UnitConfidence {
  ucum?: string;
  confidence: number;
}

export interface ConfidenceBreakdown {
  ocr?: number;
  analyte?: AnalyteConfidence;
  unit?: UnitConfidence;
  value?: ValueConfidence;
  overallConfidence: number;
}

export type ImportCandidateStatus =
  | "matched"
  | "needs_review"
  | "unmatched"
  | "invalid";

export interface ImportCandidate {
  rawName: string;
  rawValue: string;
  rawUnit?: string;

  analyte?: AnalyteMatch;
  unit?: UnitMatch;

  parsedValue?: number;
  parsedText?: string;
  comparator?: Comparator;

  measuredAt?: string;

  confidence: ConfidenceBreakdown;

  status: ImportCandidateStatus;
}

export interface ImportError {
  code: string;
  message: string;
  index?: number;
}

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
}

export interface ImportPreviewOptions {
  minConfidence?: number;
  reviewConfidence?: number;
}

export interface ConfirmedLabValue {
  analyteId: string;
  valueNumeric?: number;
  valueText?: string;
  comparator?: Comparator;
  unitId?: string;
  measuredAt: string;
  rawName?: string;
  rawValue?: string;
  rawUnit?: string;
  confidence?: number;
}

export interface CommitOptions {
  sourceType?: "manual" | "ocr" | "import";
}

export interface CommitResult {
  inserted: string[];
  duplicates: string[];
  errors: ImportError[];
}

export const DEFAULT_MIN_CONFIDENCE = 0.5;
export const DEFAULT_REVIEW_CONFIDENCE = 0.85;

export function overallConfidence(
  scores: Array<number | undefined>
): number {
  const present = scores.filter(
    (s): s is number => typeof s === "number" && Number.isFinite(s)
  );
  if (present.length === 0) return 0;
  return Math.min(...present);
}
