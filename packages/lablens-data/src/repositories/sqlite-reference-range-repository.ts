import { eq } from "drizzle-orm";
import type { ReferenceRange } from "@lablens/core";
import type { ReferenceRangeRepository } from "@lablens/core";
import type { DatabaseClient } from "../db/client";
import { referenceRange } from "../db/schema";
import { loadReferenceRange } from "../db/loaders";

export class SqliteReferenceRangeRepository
  implements ReferenceRangeRepository
{
  private readonly db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  findByAnalyte(analyteId: string): Promise<ReferenceRange[]> {
    const rows = this.db
      .select({ id: referenceRange.id })
      .from(referenceRange)
      .where(eq(referenceRange.analyteId, analyteId))
      .all();
    return Promise.resolve(
      rows
        .map((r) => loadReferenceRange(this.db, r.id))
        .filter((range): range is ReferenceRange => range !== null)
    );
  }

  findById(id: string): Promise<ReferenceRange | null> {
    return Promise.resolve(loadReferenceRange(this.db, id));
  }
}
