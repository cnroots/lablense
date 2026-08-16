export type Comparator = "<" | "<=" | "=" | ">=" | ">";

export type ProvenanceSourceType = "manual" | "ocr" | "import";

export interface ObservationProvenance {
  sourceType: ProvenanceSourceType;

  originalName?: string;
  originalValue?: string;
  originalUnit?: string;

  extractionMethod?: string;
  extractionEngine?: string;
  extractionEngineVersion?: string;

  confidence?: number;

  createdAt: string;
}

export interface Observation {
  id: string;
  userId: string;
  analyteId: string;

  valueNumeric?: number;
  valueText?: string;

  comparator?: Comparator;

  unitId?: string;

  measuredAt: string;

  provenance?: ObservationProvenance;

  createdAt: string;
  updatedAt: string;
}

export interface NewObservation {
  userId?: string;
  analyteId: string;

  valueNumeric?: number;
  valueText?: string;

  comparator?: Comparator;

  unitId?: string;

  measuredAt: string;

  provenance?: ObservationProvenance;
}

export interface ObservationUpdate {
  valueNumeric?: number;
  valueText?: string;
  comparator?: Comparator;
  unitId?: string;
  measuredAt?: string;
}

export type ObservationInsert = Omit<NewObservation, "userId"> & {
  userId: string;
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type ObservationSort = "asc" | "desc";

export interface ObservationQuery {
  analyteId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  sort?: ObservationSort;
}

export interface DuplicateCheck {
  analyteId: string;
  valueNumeric?: number;
  valueText?: string;
  unitId?: string;
  measuredAt: string;
}
