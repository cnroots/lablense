import { asc, eq } from "drizzle-orm";
import type { NewUser, User, UserInsert } from "@lablens/core";
import type { UserRepository } from "@lablens/core";
import type { DatabaseClient } from "../db/client";
import { user } from "../db/schema";

export class SqliteUserRepository implements UserRepository {
  private readonly db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  findById(id: string): Promise<User | null> {
    const row = this.db.select().from(user).where(eq(user.id, id)).get();
    if (!row) return Promise.resolve(null);
    return Promise.resolve(this.map(row));
  }

  list(): Promise<User[]> {
    const rows = this.db.select().from(user).orderBy(asc(user.createdAt)).all();
    return Promise.resolve(rows.map((row) => this.map(row)));
  }

  delete(id: string): Promise<void> {
    this.db.delete(user).where(eq(user.id, id)).run();
    return Promise.resolve();
  }

  insert(input: UserInsert): Promise<User> {
    const row = this.db
      .insert(user)
      .values({
        id: input.id,
        name: input.name ?? null,
        ageYears: input.ageYears ?? null,
        sex: input.sex ?? null,
        createdAt: input.createdAt
      })
      .returning()
      .get();
    return Promise.resolve(this.map(row));
  }

  update(id: string, patch: Partial<NewUser>): Promise<User> {
    this.db
      .update(user)
      .set({
        name: patch.name ?? undefined,
        ageYears: patch.ageYears ?? undefined,
        sex: patch.sex ?? undefined
      })
      .where(eq(user.id, id))
      .run();
    const row = this.db.select().from(user).where(eq(user.id, id)).get();
    return Promise.resolve(this.map(row!));
  }

  private map(row: typeof user.$inferSelect): User {
    return {
      id: row.id,
      name: row.name ?? undefined,
      ageYears: row.ageYears ?? undefined,
      sex: (row.sex ?? undefined) as User["sex"],
      createdAt: row.createdAt
    };
  }
}
