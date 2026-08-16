import type {
  Analyte,
  ImportCandidate,
  Observation,
  ReferenceRange,
  User
} from "@lablens/core";

export interface AnalyteDto {
  id: string;
  key: string;
  displayName: string;
  group?: { key: string; name: string; description?: string };
  description?: string;
  names: {
    name: string;
    type: "canonical" | "synonym" | "abbreviation";
    language?: string;
  }[];
  loinc: {
    code: string;
    displayName?: string;
  }[];
  units: { unitId: string }[];
}

export function toAnalyteDto(analyte: Analyte): AnalyteDto {
  return {
    id: analyte.id,
    key: analyte.key,
    displayName: analyte.displayName,
    group: analyte.group,
    description: analyte.description,
    names: analyte.names.map((n) => ({
      name: n.name,
      type: n.type,
      language: n.language
    })),
    loinc: analyte.loinc.map((l) => ({
      code: l.code,
      displayName: l.displayName
    })),
    units: analyte.units
  };
}

export function toObservationDto(observation: Observation): Observation {
  return observation;
}

export function toUserDto(user: User): User {
  return user;
}

export function toReferenceRangeDto(range: ReferenceRange): ReferenceRange {
  return range;
}

export function toImportCandidateDto(candidate: ImportCandidate): ImportCandidate {
  return candidate;
}
