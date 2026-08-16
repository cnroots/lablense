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
  NumberParser
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
  const analyteMatcher = new AnalyteMatcher(analyteRepository, unitService);
  const extractor = new LabReportExtractor(new NumberParser());

  let totalUnmatched = 0;
  for (const f of (await readdir(fixturesDir)).filter((x) => x.endsWith(".json")).sort()) {
    const fx = JSON.parse(await readFile(`${fixturesDir}/${f}`, "utf8"));
    const res = {
      text: fx.text,
      confidence: fx.confidence,
      cells: fx.lines.map((l: any[]) => l.map((c: any) => ({ text: c.text, confidence: c.confidence, box: c.box })))
    };
    for (const v of extractor.extract(res)) {
      if (v.value === undefined) continue;
      const a = await analyteMatcher.match(v);
      if (!a) {
        totalUnmatched++;
        console.log(`  UNMATCHED  ${f.replace(".json", "")}  ${v.rawName} = ${v.value} ${v.rawUnit ?? ""}`);
      }
    }
  }
  console.log(`\nTotal unmatched: ${totalUnmatched}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
