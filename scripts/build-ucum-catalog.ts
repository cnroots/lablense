import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { iterateCsvRows } from "@lablens/data/node";

// Builds a UCUM unit catalog (code + display names) from the official LOINC
// distribution's EXAMPLE_UCUM_UNITS / EXAMPLE_UNITS columns. LOINC is the
// canonical source for the units that actually appear in laboratory reports,
// so this yields a comprehensive, real-world unit alias table without inventing
// a competing ontology.
//
// Usage: npx tsx scripts/build-ucum-catalog.ts
//
// Requires data/loinc/Loinc.csv (see data/loinc/README.md).

const loincPath = fileURLToPath(new URL("../data/loinc/Loinc.csv", import.meta.url));
const outPath = fileURLToPath(new URL("../data/ucum/units.json", import.meta.url));

const MIN_COUNT = 5;

interface Entry {
  code: string;
  names: Set<string>;
  count: number;
}

async function main(): Promise<void> {
  const entries = new Map<string, Entry>();
  let header: string[] | null = null;
  let ucumIdx = -1;
  let exampleIdx = -1;
  let rows = 0;

  for await (const row of iterateCsvRows(loincPath)) {
    if (header === null) {
      header = row;
      ucumIdx = header.indexOf("EXAMPLE_UCUM_UNITS");
      exampleIdx = header.indexOf("EXAMPLE_UNITS");
      if (ucumIdx === -1) {
        throw new Error("LOINC CSV missing EXAMPLE_UCUM_UNITS column");
      }
      continue;
    }
    rows++;
    const code = row[ucumIdx]?.trim();
    if (!code) continue;
    const example = exampleIdx >= 0 ? (row[exampleIdx]?.trim() ?? "") : "";

    let entry = entries.get(code);
    if (!entry) {
      entry = { code, names: new Set<string>(), count: 0 };
      entries.set(code, entry);
    }
    entry.count++;
    if (example) entry.names.add(example);
  }

  const catalog = [...entries.values()]
    .filter((e) => e.count >= MIN_COUNT)
    .sort((a, b) => b.count - a.count)
    .map((e) => ({
      code: e.code,
      names: [...e.names].filter((n) => n !== e.code)
    }));

  const output = {
    version: "1.0",
    source: "LOINC EXAMPLE_UCUM_UNITS / EXAMPLE_UNITS",
    units: catalog
  };

  await writeFile(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(
    `Wrote ${catalog.length} units (${rows} LOINC rows scanned) to ${outPath}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
