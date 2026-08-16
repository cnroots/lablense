import { beforeAll, describe, expect, it } from "vitest";
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
import type { DatabaseHandle } from "@lablens/data";
import {
  AnalyteMatcher,
  LabReportExtractor,
  NumberParser,
  UnitMatcher
} from "@lablens/ocr";

const appDataPath = fileURLToPath(
  new URL("../../../data/app/tests.json", import.meta.url)
);
const ucumPath = fileURLToPath(
  new URL("../../../data/ucum/units.json", import.meta.url)
);
const fixturesDir = fileURLToPath(new URL("./fixtures", import.meta.url));
const groundTruthPath = fileURLToPath(new URL("./ground-truth.json", import.meta.url));

let handle: DatabaseHandle;
let unitMatcher: UnitMatcher;
let analyteMatcher: AnalyteMatcher;
let extractor: LabReportExtractor;
let analyteUnitsByKey: Map<string, Set<string>>;

beforeAll(async () => {
  handle = createNodeDatabase(":memory:");
  await new AppDataImporter(handle.db, handle.transactions).import({
    data: JSON.parse(await readFile(appDataPath, "utf8"))
  });
  await new UcumImporter(handle.db, handle.transactions).import({
    data: JSON.parse(await readFile(ucumPath, "utf8"))
  });

  const unitRepository = new SqliteUnitRepository(handle.db);
  const unitService = new UnitServiceImpl(unitRepository);
  const analyteRepository = new SqliteAnalyteRepository(handle.db);
  unitMatcher = new UnitMatcher(unitService);
  analyteMatcher = new AnalyteMatcher(analyteRepository, unitService);
  extractor = new LabReportExtractor(new NumberParser());

  analyteUnitsByKey = new Map();
  for (const analyte of await analyteRepository.list()) {
    analyteUnitsByKey.set(analyte.key, new Set(analyte.units.map((u) => u.unitId)));
  }
});

describe("unit matching accuracy (UCUM catalog)", () => {
  // (raw OCR unit string, expected canonical UCUM code)
  const CASES: [string, string][] = [
    ["mU/L", "mU/L"],
    ["mU/l", "mU/L"],
    ["µU/ml", "mU/L"],
    ["ulU/ml", "mU/L"],
    ["piU/ml", "mU/L"],
    ["mIU/L", "mU/L"],
    ["U/L", "U/L"],
    ["U/l", "U/L"],
    ["IU/L", "U/L"],
    ["UA", "U/L"],
    ["G/l", "10*9/L"],
    ["Tsd/µl", "10*9/L"],
    ["Mio/µl", "10*12/L"],
    ["fL", "fL"],
    ["fl", "fL"],
    ["g/dL", "g/dL"],
    ["g/dl", "g/dL"],
    ["mg/dL", "mg/dL"],
    ["mg/dl", "mg/dL"],
    ["mg/L", "mg/L"],
    ["mg/l", "mg/L"],
    ["µg/L", "µg/L"],
    ["ug/L", "µg/L"],
    ["μg/L", "µg/L"],
    ["ng/mL", "ng/mL"],
    ["ng/ml", "ng/mL"],
    ["ng/dL", "ng/dL"],
    ["ng/dl", "ng/dL"],
    ["ng/di", "ng/dL"],
    ["pg/mL", "pg/mL"],
    ["pg/ml", "pg/mL"],
    ["mmol/L", "mmol/L"],
    ["mmol/l", "mmol/L"],
    ["pmol/L", "pmol/L"],
    ["nmol/L", "nmol/L"],
    ["µmol/L", "µmol/L"],
    ["umol/L", "µmol/L"],
    ["%", "%"],
    ["pg", "pg"],
    ["mL/min", "mL/min"],
    ["ml/min", "mL/min"],
    ["s", "s"],
    ["sec", "s"],
    ["mm", "mm"],
    ["mmHg", "mmHg"],
    ["kPa", "kPa"],
    ["µkat/L", "µkat/L"],
    ["ukat/L", "µkat/L"],
    ["IU/mL", "IU/mL"],
    ["kIU/L", "kIU/L"],
    ["kU/L", "kIU/L"],
    ["µg/dL", "µg/dL"],
    ["ug/dL", "µg/dL"],
    ["µg/mL", "µg/mL"],
    ["ug/mL", "µg/mL"]
  ];

  it("resolves >=95% of raw unit strings to the correct UCUM code", async () => {
    let correct = 0;
    const failures: string[] = [];
    for (const [raw, expected] of CASES) {
      const match = await unitMatcher.match(raw);
      if (match && match.ucumCode === expected) {
        correct++;
      } else {
        failures.push(`${raw} -> got ${match?.ucumCode ?? "null"}, want ${expected}`);
      }
    }
    const accuracy = correct / CASES.length;
    console.log(`\nunit accuracy: ${correct}/${CASES.length} (${(accuracy * 100).toFixed(1)}%)`);
    for (const f of failures) console.log(`  FAIL ${f}`);
    expect(accuracy).toBeGreaterThanOrEqual(0.95);
  });
});

describe("end-to-end import accuracy", () => {
  const TOL = 0.02;
  const near = (a: number, b: number) => Math.abs(a - b) <= TOL;

  it("imports >=95% of analytes with correct values and units", async () => {
    const groundTruth = JSON.parse(
      await readFile(groundTruthPath, "utf8")
    ) as Record<string, Record<string, number[]>>;

    const files = (await readdir(fixturesDir))
      .filter((f) => f.endsWith(".json"))
      .sort();

    let totalExpected = 0;
    let totalAnalytesFound = 0;
    let totalWithUnit = 0;
    let totalUnitResolved = 0;
    let totalUnitCompatible = 0;
    const misses: string[] = [];

    for (const file of files) {
      const sample = file.replace(/\.json$/, "");
      const fixture = JSON.parse(await readFile(`${fixturesDir}/${file}`, "utf8"));
      const expected = groundTruth[sample] ?? {};

      const ocrResult = {
        text: fixture.text,
        confidence: fixture.confidence,
        cells: fixture.lines.map((line: any[]) =>
          line.map((c: any) => ({
            text: c.text,
            confidence: c.confidence,
            box: c.box
          }))
        )
      };

      const values = extractor.extract(ocrResult);

      const found: { key: string; value: number }[] = [];
      for (const value of values) {
        if (value.value === undefined) continue;
        const analyte = await analyteMatcher.match(value);
        if (!analyte) continue;
        found.push({ key: analyte.analyteKey, value: value.value });

        if (value.rawUnit && /[a-zA-Z]/.test(value.rawUnit)) {
          totalWithUnit++;
          const unit = await unitMatcher.match(value.rawUnit, { analyte });
          if (unit) {
            totalUnitResolved++;
            const allowed = analyteUnitsByKey.get(analyte.analyteKey);
            if (allowed?.has(unit.unitId)) totalUnitCompatible++;
          }
        }
      }

      const expectedEntries = Object.entries(expected);
      totalExpected += expectedEntries.length;
      for (const [analyteKey, expectedValues] of expectedEntries) {
        const hit = expectedValues.some((v) =>
          found.some((f) => f.key === analyteKey && near(f.value, v))
        );
        if (hit) totalAnalytesFound++;
        else misses.push(`${sample}/${analyteKey}`);
      }
    }

    const analyteRecall = totalExpected === 0 ? 1 : totalAnalytesFound / totalExpected;
    const unitRate = totalWithUnit === 0 ? 1 : totalUnitResolved / totalWithUnit;
    const unitCompatibleRate =
      totalWithUnit === 0 ? 1 : totalUnitCompatible / totalWithUnit;

    console.log(
      `\nend-to-end: analyte recall=${(analyteRecall * 100).toFixed(1)}% ` +
        `(${totalAnalytesFound}/${totalExpected})`
    );
    console.log(
      `unit resolve=${(unitRate * 100).toFixed(1)}% ` +
        `(${totalUnitResolved}/${totalWithUnit}), ` +
        `unit compatible=${(unitCompatibleRate * 100).toFixed(1)}% ` +
        `(${totalUnitCompatible}/${totalWithUnit})`
    );
    for (const m of misses) console.log(`  MISS ${m}`);

    expect(analyteRecall).toBeGreaterThanOrEqual(0.95);
    expect(unitRate).toBeGreaterThanOrEqual(0.95);
    expect(unitCompatibleRate).toBeGreaterThanOrEqual(0.95);
  });
});
