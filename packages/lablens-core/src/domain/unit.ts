export interface Unit {
  id: string;
  ucumCode: string;
  displayName: string;
}

export interface UnitName {
  unitId: string;
  name: string;
  normalized: string;
}

export interface UnitWithNames {
  unit: Unit;
  names: UnitName[];
}

export type MatchConfidence = "high" | "medium" | "low";

export interface UnitMatch {
  unitId: string;
  ucumCode: string;
  displayName?: string;
  score: number;
  confidence: MatchConfidence;
  strategies: string[];
  explanation?: string;
}

export interface UnitService {
  normalize(input: string): Promise<UnitMatch | null>;

  convert(value: number, from: string, to: string): number;
}
