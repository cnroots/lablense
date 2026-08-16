import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { iterateCsvRows } from "@lablens/data/node";

// Enriches the application seed (data/app/tests.json) with:
//   1. a curated `loinc` code per analyte (for LOINC linkage), and
//   2. German display names harvested from the LOINC de-DE linguistic variant,
//      added as `synonym` names so OCR'd German lab reports match reliably.
//
// Usage: npx tsx scripts/enrich-seed-with-loinc.ts
//
// Requires the LOINC 2.82 distribution (the deDE15 linguistic variant).

const seedPath = fileURLToPath(new URL("../data/app/tests.json", import.meta.url));
const variantPath = process.env.LOINC_DE_DE_VARIANT ??
  "/home/cevin/Downloads/Loinc_2.82/AccessoryFiles/LinguisticVariants/deDE15LinguisticVariant.csv";

interface GermanNames {
  component?: string;
  shortname?: string;
  relatedNames?: string;
}

async function loadGermanVariant(path: string): Promise<Map<string, GermanNames>> {
  const map = new Map<string, GermanNames>();
  let header: string[] | null = null;
  for await (const row of iterateCsvRows(path)) {
    if (header === null) {
      header = row;
      continue;
    }
    const idx = (name: string) => header!.indexOf(name);
    const code = row[idx("LOINC_NUM")]?.trim();
    if (!code) continue;
    map.set(code, {
      component: row[idx("COMPONENT")]?.trim() || undefined,
      shortname: row[idx("SHORTNAME")]?.trim() || undefined,
      relatedNames: row[idx("RELATEDNAMES2")]?.trim() || undefined
    });
  }
  return map;
}

async function main(): Promise<void> {
  const seed = JSON.parse(await readFile(seedPath, "utf8"));
  const variant = await loadGermanVariant(variantPath);
  console.log(`German variant: ${variant.size} LOINC codes loaded`);

  // Generic LOINC "part" names that are not useful (or actively misleading)
  // as analyte synonyms.
  const BLOCK = new Set([
    "beobachtung",
    "hämoglobin",
    "haemoglobin",
    "erythrozyt",
    "erythrozyt/blut",
    "thrombozyt",
    "leukozyt",
    "rbc"
  ]);

  let enriched = 0;
  for (const test of seed.tests) {
    const loincCode: string | undefined = test.loinc;
    if (!loincCode) {
      console.warn(`  no LOINC mapping for ${test.key}`);
      continue;
    }
    test.loinc = loincCode;

    // Remove previously-enriched German synonyms (idempotent re-runs).
    test.names = test.names.filter(
      (n: { source?: string }) => n.source !== "LOINC deDE"
    );

    const de = variant.get(loincCode);
    if (!de) continue;

    const synonyms = new Set<string>();
    if (de.component) synonyms.add(de.component);
    for (const rel of (de.relatedNames ?? "").split(";")) {
      const t = rel.trim();
      if (t) synonyms.add(t);
    }

    const existing = new Set(
      test.names.map((n: { name: string }) => n.name.toLowerCase())
    );

    for (const name of synonyms) {
      if (BLOCK.has(name.toLowerCase())) continue;
      if (existing.has(name.toLowerCase())) continue;
      test.names.push({
        name,
        type: "synonym",
        language: "de",
        source: "LOINC deDE"
      });
      enriched++;
    }
  }

  await writeFile(seedPath, JSON.stringify(seed, null, 2) + "\n", "utf8");
  console.log(`Enriched ${enriched} German synonyms across ${seed.tests.length} tests`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
