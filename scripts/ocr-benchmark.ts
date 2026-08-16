import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  AppDataImporter,
  SqliteAnalyteRepository,
  SqliteUnitRepository,
  createLabLensBackend
} from "@lablens/data";
import { createNodeDatabase } from "@lablens/data/node";
import { UnitServiceImpl } from "@lablens/core";
import type { ExtractedLabValue } from "@lablens/core";
import {
  AnalyteMatcher,
  LabReportExtractor,
  NumberParser,
  UnitMatcher
} from "@lablens/ocr";

interface Fixture {
  file: string;
  angle: number;
  width: number;
  confidence: number;
  text: string;
  lines: {
    text: string;
    confidence: number;
    box: { x: number; y: number; width: number; height: number };
  }[][];
}

interface GroundTruth {
  [sample: string]: Record<string, number[]>;
}

const appDataPath = fileURLToPath(
  new URL("../data/app/tests.json", import.meta.url)
);
const fixturesDir = fileURLToPath(
  new URL("../packages/lablens-ocr/test/fixtures", import.meta.url)
);
const groundTruthPath = fileURLToPath(
  new URL("../packages/lablens-ocr/test/ground-truth.json", import.meta.url)
);

const handle = createNodeDatabase(":memory:");
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

const extractor = new LabReportExtractor(new NumberParser());
const analyteMatcher = new AnalyteMatcher(analyteRepository, unitService);
const unitMatcher = new UnitMatcher(unitService);

const groundTruth = JSON.parse(await readFile(groundTruthPath, "utf8")) as GroundTruth;
const fixtureFiles = (await readdir(fixturesDir)).filter((f) => f.endsWith(".json")).sort();

const TOL = 0.02;

interface Found {
  analyte: string;
  value: number;
}

async function matchValues(values: ExtractedLabValue[]): Promise<Found[]> {
  const found: Found[] = [];
  for (const value of values) {
    const match = await analyteMatcher.match(value);
    if (!match) continue;
    if (value.value === undefined) continue;
    const unit = value.rawUnit
      ? await unitMatcher.match(value.rawUnit, { analyte: match })
      : null;
    found.push({ analyte: match.analyteKey, value: value.value, unit: unit?.ucumCode ?? null } as Found & { unit: string | null });
  }
  return found;
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOL;
}

let totalExpected = 0;
let totalFound = 0;
let totalCorrect = 0;
let totalMatchedExpected = 0;

console.log("=== LabLens OCR benchmark ===\n");

for (const file of fixtureFiles) {
  const sample = file.replace(/\.json$/, "");
  const fixture = JSON.parse(await readFile(`${fixturesDir}/${file}`, "utf8")) as Fixture;
  const expected = groundTruth[sample] ?? {};

  const ocrResult = {
    text: fixture.text,
    confidence: fixture.confidence,
    cells: fixture.lines.map((line) =>
      line.map((cell) => ({
        text: cell.text,
        confidence: cell.confidence,
        box: cell.box
      }))
    )
  };

  const values = extractor.extract(ocrResult);
  const found = await matchValues(values);

  const expectedEntries = Object.entries(expected);
  let matchedExpected = 0;
  const missed: string[] = [];
  for (const [analyte, expectedValues] of expectedEntries) {
    const hit = found.some(
      (f) => f.analyte === analyte && expectedValues.some((v) => near(v, f.value))
    );
    if (hit) matchedExpected++;
    else missed.push(`${analyte}=${expectedValues.join("/")}`);
  }

  const expectedSet = new Set(
    expectedEntries.flatMap(([a, vs]) => vs.map((v) => `${a}:${v}`))
  );
  const correctFound = found.filter((f) =>
    expectedEntries.some(
      ([a, vs]) => a === f.analyte && vs.some((v) => near(v, f.value))
    )
  ).length;

  totalExpected += expectedEntries.length;
  totalMatchedExpected += matchedExpected;
  totalFound += found.length;
  totalCorrect += correctFound;

  const recall = expectedEntries.length ? matchedExpected / expectedEntries.length : null;
  const precision = found.length ? correctFound / found.length : null;

  console.log(
    `${sample}: expected=${expectedEntries.length} matched=${matchedExpected} found=${found.length} correct=${correctFound}` +
      (recall === null ? " (no in-dataset analytes)" : ` recall=${(recall * 100).toFixed(0)}% precision=${(precision! * 100).toFixed(0)}%`)
  );
  if (missed.length) console.log(`   missed: ${missed.join(", ")}`);
}

console.log("\n=== Overall ===");
console.log(
  `recall=${((totalMatchedExpected / totalExpected) * 100).toFixed(1)}% ` +
    `(${totalMatchedExpected}/${totalExpected})  ` +
    `precision=${((totalCorrect / totalFound) * 100).toFixed(1)}% ` +
    `(${totalCorrect}/${totalFound})`
);
