import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  AppDataImporter,
  SqliteAnalyteRepository,
  SqliteUnitRepository,
  UcumImporter
} from "@lablens/data";
import { createNodeDatabase } from "@lablens/data/node";
import { UnitServiceImpl } from "@lablens/core";
import {
  AnalyteMatcher,
  LabReportExtractor,
  NumberParser,
  UnitMatcher
} from "@lablens/ocr";

const appDataPath = fileURLToPath(new URL("../data/app/tests.json", import.meta.url));
const ucumPath = fileURLToPath(new URL("../data/ucum/units.json", import.meta.url));
const fixturesDir = fileURLToPath(new URL("../packages/lablens-ocr/test/fixtures", import.meta.url));

async function main(): Promise<void> {
  const handle = createNodeDatabase(":memory:");
  await new AppDataImporter(handle.db, handle.transactions).import({
    data: JSON.parse(await readFile(appDataPath, "utf8"))
  });
  await new UcumImporter(handle.db, handle.transactions).import({
    data: JSON.parse(await readFile(ucumPath, "utf8"))
  });

  const unitRepository = new SqliteUnitRepository(handle.db);
  const unitService = new UnitServiceImpl(unitRepository);
  const analyteRepository = new SqliteAnalyteRepository(handle.db);
  const unitMatcher = new UnitMatcher(unitService);
  const analyteMatcher = new AnalyteMatcher(analyteRepository, unitService);
  const extractor = new LabReportExtractor(new NumberParser());

  const analyteUnits = new Map<string, string[]>();
  for (const a of await analyteRepository.list()) {
    analyteUnits.set(a.key, a.units.map((u) => u.unitId));
  }
  const unitsById = new Map((await unitRepository.listAll()).map((e) => [e.unit.id, e.unit.ucumCode]));

  const unresolved = new Map<string, number>();
  const mismatched = new Map<string, number>();

  for (const f of (await readdir(fixturesDir)).filter((x) => x.endsWith(".json")).sort()) {
    const fx = JSON.parse(await readFile(`${fixturesDir}/${f}`, "utf8"));
    const res = {
      text: fx.text,
      confidence: fx.confidence,
      cells: fx.lines.map((l: any[]) => l.map((c: any) => ({ text: c.text, confidence: c.confidence, box: c.box })))
    };
    for (const v of extractor.extract(res)) {
      if (v.value === undefined || !v.rawUnit) continue;
      const a = await analyteMatcher.match(v);
      if (!a) continue;
      const u = await unitMatcher.match(v.rawUnit, { analyte: a });
      const allowed = analyteUnits.get(a.analyteKey) ?? [];
      const allowedCodes = allowed.map((id) => unitsById.get(id) ?? id);
      if (!u) {
        const k = `${a.analyteKey} | ${JSON.stringify(v.rawUnit)} | allowed=${allowedCodes.join(",")}`;
        unresolved.set(k, (unresolved.get(k) ?? 0) + 1);
      } else if (!allowed.includes(u.unitId)) {
        const k = `${a.analyteKey} | ${JSON.stringify(v.rawUnit)} -> ${u.ucumCode} | allowed=${allowedCodes.join(",")}`;
        mismatched.set(k, (mismatched.get(k) ?? 0) + 1);
      }
    }
  }

  console.log("=== UNRESOLVED units ===");
  for (const [k, c] of [...unresolved.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c}x ${k}`);
  }
  console.log("\n=== MISMATCHED units (resolved but not analyte-compatible) ===");
  for (const [k, c] of [...mismatched.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c}x ${k}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
