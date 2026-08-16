import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// One-time migration: folds the OCR unit variants (previously hardcoded in
// `packages/lablens-ocr/src/parsing/unit-parser.ts`) into the UCUM catalog so
// the catalog becomes the single source of unit alias data.

const catalogPath = fileURLToPath(new URL("../data/ucum/units.json", import.meta.url));

// canonical unit code -> OCR/display variants (from the former UNIT_VARIANTS map).
const VARIANTS: Record<string, string[]> = {
  "mU/L": ["mU/l", "mU/", "mU/I", "uIU/mL", "uiU/ml", "uIU/ml", "uIU/l", "μU/ml", "µU/ml", "μIU/mL", "µIU/mL", "ulU/ml", "piU/ml", "mIU/L", "mIU/l"],
  "U/L": ["U/l", "U/I", "U/A", "UAI", "UA", "UI", "UΛ", "U/", "u/l", "IU/L", "IU/l", "IU/A", "IUA", "IUI", "VUI", "W/"],
  "IU/mL": ["IU/ml", "U/mL", "U/ml"],
  "kIU/L": ["kIU/l", "kU/L", "kU/l"],
  "10*9/L": ["G/l", "G/L", "G/", "G/I", "G//", "G", "Tsd/ul", "Tsd/μl", "Tsd/µl", "x10e3/uL", "x10e3/μL", "x10e3/µL", "x10³/μL", "x103/μL"],
  "10*12/L": ["T/l", "T/L", "TA", "Mio/ul", "Mio/μl", "Mio/µl", "x10e6/uL", "x10e6/μL", "x10e6/µL"],
  "10*3/uL": ["10*3/µl", "10*3/μl", "10*3/ul", "/uL", "cells/uL"],
  "g/dL": ["g/dl", "g/cl", "g/100ml"],
  "fL": ["fl"],
  "pg": ["pg"],
  "%": ["%", "Prozent"],
  "mg/dL": ["mg/dl", "mg/100ml"],
  "mg/L": ["mg/l", "mg/"],
  "µg/L": ["µg/l", "μg/L", "μg/l", "ug/L", "ug/l"],
  "µg/dL": ["μg/dL", "ug/dL", "ug/dl", "mcg/dL"],
  "µg/mL": ["μg/mL", "ug/mL", "ug/ml", "mcg/mL"],
  "ng/mL": ["ng/ml"],
  "ng/dL": ["ng/dl", "ng/di"],
  "ng/L": ["ng/l"],
  "pg/mL": ["pg/ml", "ng/L", "ng/l"],
  "pg/dL": ["pg/dl"],
  "mmol/L": ["mmol/l", "mmol/", "mval/l"],
  "µmol/L": ["μmol/L", "umol/L", "umol/l"],
  "nmol/L": ["nmol/l"],
  "pmol/L": ["pmol/l"],
  "µkat/L": ["μkat/L", "ukat/L", "ukat/l"],
  "mL/min": ["ml/min"],
  "s": ["sec"],
  "mm": ["mm"],
  "mmHg": ["mmHG", "mm Hg"],
  "kPa": ["kpa"],
  "mL": ["ml"]
};

async function main(): Promise<void> {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  const byCode = new Map<string, { code: string; names: string[] }>(
    catalog.units.map((u: { code: string; names: string[] }) => [u.code, u])
  );

  let added = 0;
  for (const [code, variants] of Object.entries(VARIANTS)) {
    let entry = byCode.get(code);
    if (!entry) {
      entry = { code, names: [] };
      byCode.set(code, entry);
      catalog.units.push(entry);
    }
    const names = new Set(entry.names);
    for (const v of variants) {
      if (!names.has(v)) {
        names.add(v);
        entry.names.push(v);
        added++;
      }
    }
  }

  await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  console.log(`Merged ${added} OCR unit variants into the catalog (${byCode.size} units)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
