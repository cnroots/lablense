import { eq } from "drizzle-orm";
import type { Unit, UnitWithNames } from "@lablens/core";
import type { UnitRepository } from "@lablens/core";
import type { DatabaseClient } from "../db/client";
import { unit, unitName } from "../db/schema";

export class SqliteUnitRepository implements UnitRepository {
  private readonly db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  findById(id: string): Promise<Unit | null> {
    const row = this.db.select().from(unit).where(eq(unit.id, id)).get();
    if (!row) return Promise.resolve(null);
    return Promise.resolve({
      id: row.id,
      ucumCode: row.ucumCode,
      displayName: row.displayName
    });
  }

  findByCode(ucumCode: string): Promise<Unit | null> {
    const row = this.db
      .select()
      .from(unit)
      .where(eq(unit.ucumCode, ucumCode))
      .get();
    if (!row) return Promise.resolve(null);
    return Promise.resolve({
      id: row.id,
      ucumCode: row.ucumCode,
      displayName: row.displayName
    });
  }

  list(): Promise<Unit[]> {
    const rows = this.db.select().from(unit).all();
    return Promise.resolve(
      rows.map((row) => ({
        id: row.id,
        ucumCode: row.ucumCode,
        displayName: row.displayName
      }))
    );
  }

  listAll(): Promise<UnitWithNames[]> {
    const units = this.db.select().from(unit).all();
    const names = this.db.select().from(unitName).all();
    const byUnit = new Map<string, UnitWithNames>();
    for (const u of units) {
      byUnit.set(u.id, {
        unit: { id: u.id, ucumCode: u.ucumCode, displayName: u.displayName },
        names: []
      });
    }
    for (const n of names) {
      const entry = byUnit.get(n.unitId);
      if (entry) {
        entry.names.push({
          unitId: n.unitId,
          name: n.name,
          normalized: n.normalized
        });
      }
    }
    return Promise.resolve([...byUnit.values()]);
  }
}
