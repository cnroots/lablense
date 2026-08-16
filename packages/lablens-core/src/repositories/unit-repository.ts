import type { Unit, UnitWithNames } from "../domain/unit";

export interface UnitRepository {
  findById(id: string): Promise<Unit | null>;

  findByCode(ucumCode: string): Promise<Unit | null>;

  list(): Promise<Unit[]>;

  listAll(): Promise<UnitWithNames[]>;
}
