import { beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  AppDataImporter,
  SqliteAnalyteRepository,
  SqliteObservationRepository,
  SqliteReferenceRangeRepository,
  SqliteUnitRepository,
  SqliteUserRepository
} from "@lablens/data";
import { createNodeDatabase } from "@lablens/data/node";

const appDataPath = fileURLToPath(
  new URL("../../../data/app/tests.json", import.meta.url)
);

let appData: { tests: unknown[]; groups: unknown[] };

beforeAll(async () => {
  appData = JSON.parse(await readFile(appDataPath, "utf8"));
});

function freshDb() {
  return createNodeDatabase(":memory:");
}

async function seededDb() {
  const handle = freshDb();
  const importer = new AppDataImporter(handle.db, handle.transactions);
  await importer.import({ data: appData });
  return { handle };
}

describe("migrations", () => {
  it("creates the full schema", () => {
    const handle = freshDb();
    const tables = handle.connection
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r: { name: string }) => r.name);
    for (const table of [
      "test_group",
      "analyte",
      "analyte_name",
      "loinc",
      "analyte_loinc",
      "unit",
      "unit_name",
      "analyte_unit",
      "source",
      "reference_range",
      "reference_condition",
      "user",
      "observation",
      "observation_provenance",
      "data_import"
    ]) {
      expect(tables).toContain(table);
    }
  });

  it("does not create document/OCR persistence tables", () => {
    const handle = freshDb();
    const tables = handle.connection
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r: { name: string }) => r.name);
    for (const forbidden of [
      "document",
      "ocr_document",
      "ocr_run",
      "ocr_block",
      "document_page",
      "scan"
    ]) {
      expect(tables).not.toContain(forbidden);
    }
  });
});

describe("app-data importer", () => {
  it("imports the initial dataset", async () => {
    const { handle } = await seededDb();
    const count = handle.connection
      .prepare("SELECT COUNT(*) c FROM analyte")
      .get() as { c: number };
    expect(count.c).toBe(appData.tests.length);

    const groups = handle.connection
      .prepare("SELECT COUNT(*) c FROM test_group")
      .get() as { c: number };
    expect(groups.c).toBe(appData.groups.length);
  });

  it("is idempotent", async () => {
    const { handle } = await seededDb();
    const importer = new AppDataImporter(handle.db, handle.transactions);
    const first = await importer.import({ data: appData });
    const second = await importer.import({ data: appData });
    expect(first.inserted).toBe(second.inserted);
    expect(second.inserted).toBe(0);

    const count = handle.connection
      .prepare("SELECT COUNT(*) c FROM analyte")
      .get() as { c: number };
    expect(count.c).toBe(appData.tests.length);

    const names = handle.connection
      .prepare("SELECT COUNT(*) c FROM analyte_name")
      .get() as { c: number };
    const firstNames = names.c;
    expect(names.c).toBe(firstNames);
  });
});

describe("repositories", () => {
  it("analyte repository resolves key and search", async () => {
    const { handle } = await seededDb();
    const repo = new SqliteAnalyteRepository(handle.db);

    const tsh = await repo.findByKey("tsh");
    expect(tsh?.displayName).toBe("TSH");
    expect(tsh?.names.some((n) => n.name === "Thyreotropin")).toBe(true);
    expect(tsh?.units.length).toBeGreaterThan(0);

    const search = await repo.search("Thyreotropin");
    expect(search[0]?.key).toBe("tsh");

    const ferritin = await repo.findByKey("ferritin");
    expect(ferritin?.displayName).toBe("Ferritin");
  });

  it("unit repository resolves aliases", async () => {
    const { handle } = await seededDb();
    const repo = new SqliteUnitRepository(handle.db);
    const unit = await repo.findByCode("mU/L");
    expect(unit).toBeTruthy();
    const all = await repo.listAll();
    expect(all.some((u) => u.unit.ucumCode === "mg/dL")).toBe(true);
  });

  it("reference range repository loads contextual ranges", async () => {
    const { handle } = await seededDb();
    const analytes = new SqliteAnalyteRepository(handle.db);
    const tsh = await analytes.findByKey("tsh");
    const repo = new SqliteReferenceRangeRepository(handle.db);
    const ranges = await repo.findByAnalyte(tsh!.id);
    expect(ranges.length).toBeGreaterThanOrEqual(2);
    expect(ranges.some((r) => r.conditions.some((c) => c.field === "pregnant"))).toBe(true);
  });

  it("observation repository CRUD and duplicates", async () => {
    const { handle } = await seededDb();
    const analytes = new SqliteAnalyteRepository(handle.db);
    const units = new SqliteUnitRepository(handle.db);
    const users = new SqliteUserRepository(handle.db);
    const tsh = await analytes.findByKey("tsh");
    const unit = await units.findByCode("mU/L");

    await users.insert({
      id: "u1",
      name: "local-user",
      createdAt: "2026-01-01T00:00:00.000Z"
    });

    const repo = new SqliteObservationRepository(handle.db);
    const created = await repo.insert({
      id: "o1",
      userId: "u1",
      analyteId: tsh!.id,
      valueNumeric: 2.31,
      unitId: unit!.id,
      measuredAt: "2026-08-15T00:00:00.000Z",
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
      provenance: {
        sourceType: "ocr",
        originalName: "Thyreotropin",
        originalValue: "2,31",
        originalUnit: "mU/l",
        confidence: 0.98,
        createdAt: "2026-08-16T00:00:00.000Z"
      }
    });

    const loaded = await repo.findById("u1", "o1");
    expect(loaded?.valueNumeric).toBe(2.31);
    expect(loaded?.provenance?.sourceType).toBe("ocr");

    const list = await repo.list("u1", { analyteId: tsh!.id });
    expect(list).toHaveLength(1);

    const latest = await repo.latest("u1", tsh!.id);
    expect(latest?.id).toBe("o1");

    const duplicates = await repo.findPotentialDuplicates("u1", [
      {
        analyteId: tsh!.id,
        valueNumeric: 2.31,
        unitId: unit!.id,
        measuredAt: "2026-08-15T00:00:00.000Z"
      }
    ]);
    expect(duplicates).toHaveLength(1);
  });

  it("enforces foreign keys", async () => {
    const { handle } = await seededDb();
    const users = new SqliteUserRepository(handle.db);
    await users.insert({
      id: "u1",
      createdAt: "2026-01-01T00:00:00.000Z"
    });
    const repo = new SqliteObservationRepository(handle.db);
    expect(() =>
      repo.insert({
        id: "o_bad",
        userId: "u1",
        analyteId: "nonexistent",
        valueNumeric: 1,
        measuredAt: "2026-08-15T00:00:00.000Z",
        createdAt: "2026-08-16T00:00:00.000Z",
        updatedAt: "2026-08-16T00:00:00.000Z"
      })
    ).toThrow();
  });
});

describe("transactions", () => {
  it("rolls back on failure", async () => {
    const { handle } = await seededDb();
    const users = new SqliteUserRepository(handle.db);
    await users.insert({ id: "u1", createdAt: "2026-01-01T00:00:00.000Z" });
    const transactions = handle.transactions;
    const repo = new SqliteObservationRepository(handle.db);
    const analytes = new SqliteAnalyteRepository(handle.db);
    const tsh = await analytes.findByKey("tsh");

    await expect(
      transactions.run(async () => {
        await repo.insert({
          id: "tx1",
          userId: "u1",
          analyteId: tsh!.id,
          valueNumeric: 1,
          measuredAt: "2026-08-15T00:00:00.000Z",
          createdAt: "2026-08-16T00:00:00.000Z",
          updatedAt: "2026-08-16T00:00:00.000Z"
        });
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    const list = await repo.list("u1", {});
    expect(list).toHaveLength(0);
  });
});
