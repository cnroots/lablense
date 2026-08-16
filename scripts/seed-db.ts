import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AppDataImporter, UcumImporter } from "@lablens/data";
import { createNodeDatabase, LoincImporter } from "@lablens/data/node";

// Seeds a full database from the LOINC 2.82 distribution artifact plus the
// LabLens application terminology:
//
//   1. LOINC        (LoincTable/Loinc.csv)          — full code catalog
//   2. application  (data/app/tests.json)           — analytes/groups/units,
//                                                     reference ranges, and
//                                                     curated LOINC links
//   3. UCUM         (data/ucum/units.json)          — unit alias catalog
//
// German metric names come from the LOINC de-DE linguistic variant, which is
// harvested into the application seed at build time by
// `scripts/enrich-seed-with-loinc.ts` (so the app matches German lab reports
// without bundling the full variant).
//
// Usage:
//   npx tsx scripts/seed-db.ts [dbPath]
//   LABLENS_DB=./data/lablens.db LOINC=1 npx tsx scripts/seed-db.ts

const dbPath = process.argv[2] ?? process.env.LABLENS_DB ?? "./data/lablens.db";
const withLoinc = process.env.LOINC === "1";
const loincVersion = process.env.LOINC_VERSION ?? "2.82";

const appDataPath = fileURLToPath(new URL("../data/app/tests.json", import.meta.url));
const ucumPath = fileURLToPath(new URL("../data/ucum/units.json", import.meta.url));
const loincPath = fileURLToPath(new URL("../data/loinc/Loinc.csv", import.meta.url));

const handle = createNodeDatabase(dbPath);

// LOINC first so the application-data import can link analytes to LOINC codes.
if (withLoinc) {
  const loinc = await new LoincImporter(handle.db, handle.transactions).import({
    sourcePath: loincPath,
    version: loincVersion
  });
  console.log(
    `LOINC: inserted=${loinc.inserted} updated=${loinc.updated} skipped=${loinc.skipped} errors=${loinc.errors.length}`
  );
} else {
  console.log("LOINC: skipped (set LOINC=1 to import)");
}

const app = await new AppDataImporter(handle.db, handle.transactions).import({
  data: JSON.parse(await readFile(appDataPath, "utf8"))
});
console.log(
  `app data: inserted=${app.inserted} updated=${app.updated} skipped=${app.skipped} errors=${app.errors.length}`
);

const ucum = await new UcumImporter(handle.db, handle.transactions).import({
  data: JSON.parse(await readFile(ucumPath, "utf8"))
});
console.log(
  `UCUM: inserted=${ucum.inserted} updated=${ucum.updated} skipped=${ucum.skipped} errors=${ucum.errors.length}`
);

handle.connection.close();
console.log(`\nSeeded ${dbPath}`);
