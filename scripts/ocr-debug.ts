import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  AppDataImporter,
  SqliteAnalyteRepository,
  SqliteUnitRepository
} from "@lablens/data";
import { createNodeDatabase } from "@lablens/data/node";
import { UnitServiceImpl } from "@lablens/core";
import {
  AnalyteMatcher,
  LabReportExtractor,
  NumberParser,
  UnitMatcher
} from "@lablens/ocr";

async function main(): Promise<void> {
  const app = fileURLToPath(new URL("../data/app/tests.json", import.meta.url));
  const fixturesDir = fileURLToPath(
    new URL("../packages/lablens-ocr/test/fixtures", import.meta.url)
  );

  const handle = createNodeDatabase(":memory:");
  await new AppDataImporter(handle.db, handle.transactions).import({
    data: JSON.parse(readFileSync(app, "utf8"))
  });

  const ar = new SqliteAnalyteRepository(handle.db);
  const ur = new SqliteUnitRepository(handle.db);
  const us = new UnitServiceImpl(ur);
  const matcher = new AnalyteMatcher(ar, us);
  const um = new UnitMatcher(us);
  const ex = new LabReportExtractor(new NumberParser());

  async function dump(sample: string): Promise<void> {
    const f = JSON.parse(
      readFileSync(`${fixturesDir}/${sample}.json`, "utf8")
    );
    const vals = ex.extract({
      text: f.text,
      confidence: f.confidence,
      cells: f.lines.map((l: any[]) =>
        l.map((c: any) => ({ text: c.text, confidence: c.confidence, box: c.box }))
      )
    });
    for (const v of vals) {
      const m = await matcher.match(v);
      if (m) {
        const u = v.rawUnit ? await um.match(v.rawUnit, { analyte: m }) : null;
        console.log(
          JSON.stringify(v.rawName),
          "val=" + v.value,
          "unit=" + (v.rawUnit ?? "-"),
          "=>",
          m.analyteKey,
          m.score.toFixed(2),
          m.strategies.join(","),
          "ucum=" + (u?.ucumCode ?? "-")
        );
      }
    }
  }

  for (const s of process.argv.slice(2)) {
    console.log(`=== ${s} ===`);
    await dump(s);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
