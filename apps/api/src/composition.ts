import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { DatabaseHandle, LabLensBackend } from "@lablens/data";
import {
  AppDataImporter,
  SqliteAnalyteRepository,
  SqliteUnitRepository,
  createLabLensBackend
} from "@lablens/data";
import { createNodeDatabase } from "@lablens/data/node";
import { UnitServiceImpl } from "@lablens/core";
import {
  AnalyteMatcher,
  NumberParser,
  UnitMatcher
} from "@lablens/ocr";

export interface BackendOptions {
  dbPath?: string;
  appDataPath?: string;
}

export interface BuiltBackend {
  backend: LabLensBackend;
  handle: DatabaseHandle;
}

function resolveRepoPath(relative: string): string {
  return fileURLToPath(new URL(`../../../${relative}`, import.meta.url));
}

export async function buildBackend(
  options: BackendOptions = {}
): Promise<BuiltBackend> {
  const dbPath = options.dbPath ?? ":memory:";
  const appDataPath =
    options.appDataPath ?? resolveRepoPath("data/app/tests.json");

  const handle = createNodeDatabase(dbPath);

  const importer = new AppDataImporter(handle.db, handle.transactions);
  await importer.import({
    data: JSON.parse(await readFile(appDataPath, "utf8"))
  });

  const analyteRepository = new SqliteAnalyteRepository(handle.db);
  const unitRepository = new SqliteUnitRepository(handle.db);
  const unitService = new UnitServiceImpl(unitRepository);
  const valueParser = new NumberParser();
  const analyteMatcher = new AnalyteMatcher(analyteRepository, unitService);
  const unitMatcher = new UnitMatcher(unitService);

  const backend = createLabLensBackend({
    handle,
    analyteMatcher,
    unitMatcher,
    valueParser
  });

  return { backend, handle };
}
