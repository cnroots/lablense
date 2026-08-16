import type { Sex } from "./user";

export type ConditionFieldValue = string | number | boolean;

export interface PatientContext {
  ageYears?: number;
  sex?: Sex;
  pregnant?: boolean;
  fasting?: boolean;

  conditions?: Record<string, ConditionFieldValue>;
}
