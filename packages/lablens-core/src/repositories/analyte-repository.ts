import type { Analyte } from "../domain/analyte";

export interface AnalyteRepository {
  findById(id: string): Promise<Analyte | null>;

  findByKey(key: string): Promise<Analyte | null>;

  search(query: string, limit?: number): Promise<Analyte[]>;

  list(): Promise<Analyte[]>;

  listByGroup(groupKey: string): Promise<Analyte[]>;
}
