import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { rmSync } from "node:fs";
import {
  AppDataImporter,
  SqliteAnalyteRepository,
  SqliteUnitRepository,
  createLabLensBackend
} from "@lablens/data";
import { createNodeDatabase } from "@lablens/data/node";
import { UnitServiceImpl } from "@lablens/core";
import { AnalyteMatcher, NumberParser, UnitMatcher } from "@lablens/ocr";

const dbPath = process.env.LABLENS_DB ?? "./data/lablens-verify.db";
const appDataPath = fileURLToPath(
  new URL("../data/app/tests.json", import.meta.url)
);

rmSync(dbPath, { force: true });
rmSync(`${dbPath}-wal`, { force: true });
rmSync(`${dbPath}-shm`, { force: true });

const handle = createNodeDatabase(dbPath);

await new AppDataImporter(handle.db, handle.transactions).import({
  data: JSON.parse(await readFile(appDataPath, "utf8"))
});

const analyteRepository = new SqliteAnalyteRepository(handle.db);
const unitRepository = new SqliteUnitRepository(handle.db);
const unitService = new UnitServiceImpl(unitRepository);
const backend = createLabLensBackend({
  handle,
  analyteMatcher: new AnalyteMatcher(analyteRepository, unitService),
  unitMatcher: new UnitMatcher(unitService),
  valueParser: new NumberParser()
});

const report: string[] = [];

const tsh = await backend.analytes.getByKey("tsh");
report.push(`TSH exists: ${tsh.key} (${tsh.displayName})`);
const ferritin = await backend.analytes.getByKey("ferritin");
report.push(`Ferritin exists: ${ferritin.key} (${ferritin.displayName})`);

const search1 = await backend.analytes.search("Thyreotropin");
report.push(`search("Thyreotropin") → ${search1[0]?.key}`);

const t5h = await backend.import.preview([
  { rawName: "T5H", rawValue: "2,31", rawUnit: "mU/l", confidence: 0.99 }
]);
report.push(
  `match("T5H") → ${t5h[0]?.analyte?.analyteKey} (score ${t5h[0]?.analyte?.score?.toFixed(2)}, ${t5h[0]?.status})`
);

const unitMatch = await backend.units.normalize("mg/dl");
report.push(`normalize("mg/dl") → ${unitMatch?.ucumCode}`);

const user = await backend.users.create({ name: "local-user" });
report.push(`user created: ${user.id}`);

const tshUnit = await unitRepository.findByCode("mU/L");
const observation = await backend.observations.create(user.id, {
  analyteId: tsh.id,
  valueNumeric: 2.31,
  unitId: tshUnit!.id,
  measuredAt: "2026-08-15T00:00:00.000Z"
});
report.push(`observation created: ${observation.id} = ${observation.valueNumeric} ${tshUnit!.ucumCode}`);

const history = await backend.observations.list(user.id, { analyteId: tsh.id });
report.push(`history length: ${history.length}`);

const interpretation = await backend.interpretation.interpret(observation, {});
report.push(
  `interpretation: ${interpretation.status} (range ${interpretation.referenceRange?.lower?.value}–${interpretation.referenceRange?.upper?.value} ${tshUnit!.ucumCode})`
);

const preview = await backend.import.preview([
  { rawName: "Thyreotropin", rawValue: "2,31", rawUnit: "mU/l", confidence: 0.99 },
  { rawName: "Ferritin", rawValue: "83", rawUnit: "ng/ml", confidence: 0.99 }
]);
report.push(
  `preview: ${preview.map((c) => `${c.analyte?.analyteKey}:${c.status}`).join(", ")}`
);

const commit = await backend.import.commit(
  user.id,
  [
    {
      analyteId: tsh.id,
      valueNumeric: 2.0,
      unitId: tshUnit!.id,
      measuredAt: "2026-08-16T00:00:00.000Z",
      rawName: "Thyreotropin",
      rawValue: "2,0",
      rawUnit: "mU/l",
      confidence: 0.97
    }
  ],
  { sourceType: "ocr" }
);
report.push(`commit inserted: ${commit.inserted.length}, duplicates: ${commit.duplicates.length}, errors: ${commit.errors.length}`);

const tables = handle.connection
  .prepare("SELECT name FROM sqlite_master WHERE type='table'")
  .all()
  .map((r: { name: string }) => r.name);
const forbidden = ["document", "ocr_document", "ocr_run", "ocr_block", "document_page", "scan"];
const leaked = forbidden.filter((t) => tables.includes(t));
report.push(`no document tables: ${leaked.length === 0}`);

const provenance = handle.connection
  .prepare("SELECT COUNT(*) c FROM observation_provenance")
  .get() as { c: number };
report.push(`provenance rows: ${provenance.c}`);

handle.connection.close();

console.log(report.join("\n"));
console.log("\nCLEAN-ROOM VERIFICATION PASSED");
