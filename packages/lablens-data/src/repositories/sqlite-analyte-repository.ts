import { and, eq, like, or } from "drizzle-orm";
import type { Analyte } from "@lablens/core";
import type { AnalyteRepository } from "@lablens/core";
import { normalizeTerm } from "@lablens/core";
import type { DatabaseClient } from "../db/client";
import { analyte, analyteName } from "../db/schema";
import { loadAnalyte } from "../db/loaders";

export class SqliteAnalyteRepository implements AnalyteRepository {
  private readonly db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  findById(id: string): Promise<Analyte | null> {
    return Promise.resolve(loadAnalyte(this.db, id));
  }

  findByKey(key: string): Promise<Analyte | null> {
    const row = this.db
      .select({ id: analyte.id })
      .from(analyte)
      .where(eq(analyte.key, key))
      .get();
    if (!row) return Promise.resolve(null);
    return Promise.resolve(loadAnalyte(this.db, row.id));
  }

  list(): Promise<Analyte[]> {
    const rows = this.db.select({ id: analyte.id }).from(analyte).all();
    return Promise.resolve(
      rows
        .map((r) => loadAnalyte(this.db, r.id))
        .filter((a): a is Analyte => a !== null)
    );
  }

  listByGroup(groupKey: string): Promise<Analyte[]> {
    const rows = this.db
      .select({ id: analyte.id })
      .from(analyte)
      .where(eq(analyte.groupId, groupKey))
      .all();
    return Promise.resolve(
      rows
        .map((r) => loadAnalyte(this.db, r.id))
        .filter((a): a is Analyte => a !== null)
    );
  }

  search(query: string, limit = 20): Promise<Analyte[]> {
    const q = normalizeTerm(query);
    if (!q) return Promise.resolve([]);

    const rank = new Map<string, number>();
    const add = (id: string, r: number) => {
      const current = rank.get(id);
      if (current === undefined || current > r) rank.set(id, r);
    };

    const slug = q.replace(/\s+/g, "");
    for (const row of this.db
      .select({ id: analyte.id })
      .from(analyte)
      .where(eq(analyte.key, slug))
      .all()) {
      add(row.id, 0);
    }

    const exactNames = this.db
      .select()
      .from(analyteName)
      .where(eq(analyteName.normalized, q))
      .all();
    for (const n of exactNames) {
      add(n.analyteId, n.type === "canonical" ? 1 : 2);
    }

    const prefixNames = this.db
      .select()
      .from(analyteName)
      .where(like(analyteName.normalized, `${q}%`))
      .all();
    for (const n of prefixNames) {
      add(n.analyteId, 3);
    }

    const displayMatches = this.db
      .select({ id: analyte.id })
      .from(analyte)
      .where(
        or(
          like(analyte.displayName, `%${q}%`),
          like(analyte.key, `%${slug}%`)
        )
      )
      .all();
    for (const row of displayMatches) {
      add(row.id, 4);
    }

    const substrings = this.db
      .select()
      .from(analyteName)
      .where(like(analyteName.normalized, `%${q}%`))
      .all();
    for (const n of substrings) {
      add(n.analyteId, 5);
    }

    const ids = [...rank.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, limit)
      .map(([id]) => id);

    return Promise.resolve(
      ids
        .map((id) => loadAnalyte(this.db, id))
        .filter((a): a is Analyte => a !== null)
    );
  }
}
