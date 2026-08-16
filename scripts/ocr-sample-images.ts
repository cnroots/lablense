import { readFile } from "node:fs/promises";
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
  PaddleOcrEngine
} from "@lablens/ocr";

const appDataPath = fileURLToPath(new URL("../data/app/tests.json", import.meta.url));
const ucumPath = fileURLToPath(new URL("../data/ucum/units.json", import.meta.url));
const detPath = "/tmp/kilo/med_det.ort";
const recPath = "/tmp/kilo/med_rec.ort";
const dictPath = "/tmp/kilo/med_dict.txt";

const SAMPLES = [
  "/home/cevin/Downloads/Laborwerte-0.4.2-ReBuild/sampledata/sampleA.jpg",
  "/home/cevin/Downloads/Laborwerte-0.4.2-ReBuild/sampledata/sampleB.jpg"
];

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

  const [det, rec, dict] = await Promise.all([
    readFile(detPath),
    readFile(recPath),
    readFile(dictPath)
  ]);

  const engine = new PaddleOcrEngine({
    model: {
      detection: det.buffer.slice(det.byteOffset, det.byteOffset + det.byteLength),
      recognition: rec.buffer.slice(rec.byteOffset, rec.byteOffset + rec.byteLength),
      charactersDictionary: dict.buffer.slice(dict.byteOffset, dict.byteOffset + dict.byteLength)
    }
  });

  for (const path of SAMPLES) {
    const bytes = await readFile(path);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    console.log(`\n=== ${path.split("/").pop()} ===`);
    const result = await engine.recognize({ kind: "image", data: new Uint8Array(buffer), mimeType: "image/jpeg" });
    const values = extractor.extract(result);
    for (const v of values) {
      if (v.value === undefined) continue;
      const a = await analyteMatcher.match(v);
      const status = a ? `MATCHED -> ${a.analyteKey}` : "UNMATCHED";
      console.log(`  ${status.padEnd(28)} | ${v.rawName} = ${v.value} ${v.rawUnit ?? ""}`);
    }
  }
  await engine.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
