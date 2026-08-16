export interface TestGroup {
  key: string;
  name: string;
  description?: string;
}

export type AnalyteNameType = "canonical" | "synonym" | "abbreviation";

export interface AnalyteName {
  name: string;
  normalized: string;
  language?: string;
  type: AnalyteNameType;
  source?: string;
}

export interface LoincReference {
  code: string;
  displayName?: string;
  component?: string;
  property?: string;
  timeAspect?: string;
  system?: string;
  scaleType?: string;
  method?: string;
}

export interface TestUnit {
  unitId: string;
}

export interface Analyte {
  id: string;
  key: string;
  displayName: string;
  group?: TestGroup;
  description?: string;
  names: AnalyteName[];
  loinc: LoincReference[];
  units: TestUnit[];
}
