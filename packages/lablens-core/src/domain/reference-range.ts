export interface Bound {
  value: number;
  operator: "<" | "<=" | ">" | ">=";
}

export type ReferenceRangeType = "numeric" | "categorical";

export type ConditionOperator = "eq" | "ne" | "gt" | "gte" | "lt" | "lte";

export type ConditionValue = string | number | boolean;

export interface ReferenceCondition {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: ConditionValue;
}

export interface Source {
  id: string;
  name: string;
  url?: string;
  version?: string;
  accessedAt?: string;
}

export interface ReferenceRange {
  id: string;
  analyteId: string;
  unitId?: string;

  type: ReferenceRangeType;

  lower?: Bound;
  upper?: Bound;

  categoricalValue?: string;

  conditions: ReferenceCondition[];

  source?: Source;
}

export type ReferenceResolutionStatus = "resolved" | "ambiguous" | "none";

export interface ReferenceResolution {
  status: ReferenceResolutionStatus;
  referenceRange?: ReferenceRange;
  candidates?: ReferenceRange[];
  explanation?: string;
}
