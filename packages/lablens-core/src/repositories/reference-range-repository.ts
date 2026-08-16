import type { ReferenceRange } from "../domain/reference-range";

export interface ReferenceRangeRepository {
  findByAnalyte(analyteId: string): Promise<ReferenceRange[]>;

  findById(id: string): Promise<ReferenceRange | null>;
}
