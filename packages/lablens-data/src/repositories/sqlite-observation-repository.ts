import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import type {
  DuplicateCheck,
  Observation,
  ObservationInsert,
  ObservationQuery,
  ObservationUpdate
} from "@lablens/core";
import type { ObservationRepository } from "@lablens/core";
import type { DatabaseClient } from "../db/client";
import {
  observation,
  observationProvenance
} from "../db/schema";
import { loadObservation } from "../db/loaders";

export class SqliteObservationRepository implements ObservationRepository {
  private readonly db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  findById(userId: string, observationId: string): Promise<Observation | null> {
    const row = this.db
      .select({ id: observation.id })
      .from(observation)
      .where(
        and(
          eq(observation.id, observationId),
          eq(observation.userId, userId)
        )
      )
      .get();
    if (!row) return Promise.resolve(null);
    return Promise.resolve(loadObservation(this.db, row.id));
  }

  latest(userId: string, analyteId: string): Promise<Observation | null> {
    const row = this.db
      .select({ id: observation.id })
      .from(observation)
      .where(
        and(
          eq(observation.userId, userId),
          eq(observation.analyteId, analyteId)
        )
      )
      .orderBy(desc(observation.measuredAt))
      .limit(1)
      .get();
    if (!row) return Promise.resolve(null);
    return Promise.resolve(loadObservation(this.db, row.id));
  }

  list(userId: string, query: ObservationQuery): Promise<Observation[]> {
    const conditions = [eq(observation.userId, userId)];
    if (query.analyteId) {
      conditions.push(eq(observation.analyteId, query.analyteId));
    }
    if (query.from) {
      conditions.push(gte(observation.measuredAt, query.from));
    }
    if (query.to) {
      conditions.push(lte(observation.measuredAt, query.to));
    }

    let builder = this.db
      .select({ id: observation.id })
      .from(observation)
      .where(and(...conditions))
      .orderBy(
        query.sort === "desc"
          ? desc(observation.measuredAt)
          : asc(observation.measuredAt)
      )
      .$dynamic();

    if (query.limit !== undefined) builder = builder.limit(query.limit);
    if (query.offset !== undefined) builder = builder.offset(query.offset);

    const rows = builder.all();
    return Promise.resolve(
      rows
        .map((r) => loadObservation(this.db, r.id))
        .filter((o): o is Observation => o !== null)
    );
  }

  insert(input: ObservationInsert): Promise<Observation> {
    const row = this.db
      .insert(observation)
      .values({
        id: input.id,
        userId: input.userId,
        analyteId: input.analyteId,
        valueNumeric: input.valueNumeric ?? null,
        valueText: input.valueText ?? null,
        comparator: input.comparator ?? null,
        unitId: input.unitId ?? null,
        measuredAt: input.measuredAt,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt
      })
      .returning({ id: observation.id })
      .get();

    if (input.provenance) {
      this.insertProvenance(row.id, input.provenance);
    }

    return Promise.resolve(loadObservation(this.db, row.id)!);
  }

  insertMany(inputs: ObservationInsert[]): Promise<Observation[]> {
    if (inputs.length === 0) return Promise.resolve([]);

    const values = inputs.map((input) => ({
      id: input.id,
      userId: input.userId,
      analyteId: input.analyteId,
      valueNumeric: input.valueNumeric ?? null,
      valueText: input.valueText ?? null,
      comparator: input.comparator ?? null,
      unitId: input.unitId ?? null,
      measuredAt: input.measuredAt,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt
    }));

    const rows = this.db
      .insert(observation)
      .values(values)
      .returning({ id: observation.id })
      .all();

    const provenanceValues = inputs.flatMap((input, index) => {
      if (!input.provenance) return [];
      const row = rows[index];
      if (!row) return [];
      return [this.provenanceValue(row.id, input.provenance)];
    });

    if (provenanceValues.length > 0) {
      this.db
        .insert(observationProvenance)
        .values(provenanceValues)
        .run();
    }

    return Promise.resolve(
      rows
        .map((r) => loadObservation(this.db, r.id))
        .filter((o): o is Observation => o !== null)
    );
  }

  update(
    userId: string,
    observationId: string,
    update: ObservationUpdate
  ): Promise<Observation> {
    this.db
      .update(observation)
      .set({
        valueNumeric: update.valueNumeric ?? undefined,
        valueText: update.valueText ?? undefined,
        comparator: update.comparator ?? undefined,
        unitId: update.unitId ?? undefined,
        measuredAt: update.measuredAt ?? undefined,
        updatedAt: new Date().toISOString()
      })
      .where(
        and(eq(observation.id, observationId), eq(observation.userId, userId))
      )
      .run();

    return Promise.resolve(loadObservation(this.db, observationId)!);
  }

  delete(userId: string, observationId: string): Promise<void> {
    this.db
      .delete(observation)
      .where(
        and(eq(observation.id, observationId), eq(observation.userId, userId))
      )
      .run();
    return Promise.resolve();
  }

  findPotentialDuplicates(
    userId: string,
    checks: DuplicateCheck[]
  ): Promise<Observation[]> {
    const results: Observation[] = [];
    const seen = new Set<string>();
    for (const check of checks) {
      const conditions = [
        eq(observation.userId, userId),
        eq(observation.analyteId, check.analyteId),
        eq(observation.measuredAt, check.measuredAt)
      ];
      if (check.valueNumeric !== undefined) {
        conditions.push(eq(observation.valueNumeric, check.valueNumeric));
      } else if (check.valueText !== undefined) {
        conditions.push(eq(observation.valueText, check.valueText));
      }
      if (check.unitId !== undefined) {
        conditions.push(eq(observation.unitId, check.unitId));
      }
      const rows = this.db
        .select({ id: observation.id })
        .from(observation)
        .where(and(...conditions))
        .all();
      for (const row of rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        const loaded = loadObservation(this.db, row.id);
        if (loaded) results.push(loaded);
      }
    }
    return Promise.resolve(results);
  }

  private insertProvenance(
    observationId: string,
    provenance: NonNullable<ObservationInsert["provenance"]>
  ): void {
    this.db
      .insert(observationProvenance)
      .values(this.provenanceValue(observationId, provenance))
      .run();
  }

  private provenanceValue(
    observationId: string,
    provenance: NonNullable<ObservationInsert["provenance"]>
  ) {
    return {
      id: `prov_${observationId}`,
      observationId,
      sourceType: provenance.sourceType,
      originalName: provenance.originalName ?? null,
      originalValue: provenance.originalValue ?? null,
      originalUnit: provenance.originalUnit ?? null,
      extractionMethod: provenance.extractionMethod ?? null,
      extractionEngine: provenance.extractionEngine ?? null,
      extractionEngineVersion: provenance.extractionEngineVersion ?? null,
      confidence: provenance.confidence ?? null,
      createdAt: provenance.createdAt
    };
  }
}
