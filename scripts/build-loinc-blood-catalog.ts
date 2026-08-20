import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { iterateCsvRows } from "@lablens/data/node";

// Builds the bundled blood-value LOINC catalog from the official LOINC
// distribution (`data/loinc/Loinc.csv` + `data/loinc/LoincTableCore.csv`).
//
// The two CSV files carry the same LOINC release (LoincTableCore is the
// reduced "core" view); the full `Loinc.csv` supplies the example-unit
// columns while `LoincTableCore.csv` backs the core columns, so entries are
// merged by LOINC_NUM and either file can fill a missing field.
//
// Only LOINC rows whose SYSTEM is a blood matrix (whole blood, serum, plasma,
// buffy coat/RBC, PPP, ...) are included. For each entry a **default metric**
// (primary UCUM unit) is derived from EXAMPLE_UCUM_UNITS, and the set of
// default metrics is emitted as a unit catalog so the app can register and
// match those units offline.
//
// Output:
//   data/app/loinc-blood.json        canonical build artifact
//   apps/mobile/src/loinc-data.json  bundled copy consumed by the app
//
// Usage: npx tsx scripts/build-loinc-blood-catalog.ts

const loincPath = fileURLToPath(
  new URL("../data/loinc/Loinc.csv", import.meta.url)
);
const loincCorePath = fileURLToPath(
  new URL("../data/loinc/LoincTableCore.csv", import.meta.url)
);
const dataOutPath = fileURLToPath(
  new URL("../data/app/loinc-blood.json", import.meta.url)
);
const bundleOutPath = fileURLToPath(
  new URL("../apps/mobile/src/loinc-data.json", import.meta.url)
);

const LOINC_VERSION = process.env.LOINC_VERSION ?? "2.82";

/** Blood matrices considered "blood values" for the app's catalog. */
const BLOOD_SYSTEM_RE =
  /^(Bld|BldA|BldV|BldC|Bld\.dot|Bld\/Tiss|Bld\.pos\s+growth|Bld\/Tiss\^Donor|Bld\^Donor|Ser|Plas|Ser\/Plas|Ser\/Plas\/Bld|Ser\/Bld|Plas\/Bld|RBC|WBC|PPP|Blood)$/;

interface BloodEntry {
  code: string;
  name: string | null;
  component: string | null;
  property: string | null;
  time: string | null;
  system: string | null;
  scale: string | null;
  method: string | null;
  status: string | null;
  units: string | null;
  ucum: string | null;
  default: string | null;
}

/** Serialized entry: compact keys keep the mobile bundle small. */
interface SerializedEntry {
  c: string;
  n: string | null;
  comp: string | null;
  p: string | null;
  t: string | null;
  sys: string | null;
  sc: string | null;
  m: string | null;
  st: string | null;
  eu: string | null;
  uu: string | null;
  def: string | null;
}

interface UnitEntry {
  code: string;
  names: string[];
}

function splitTokens(value: string): string[] {
  return value
    .split(/[;|,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function cell(
  row: string[] | undefined,
  header: string[],
  name: string
): string | null {
  if (!row) return null;
  const idx = header.indexOf(name);
  if (idx === -1) return null;
  const value = (row[idx] ?? "").trim();
  return value || null;
}

/** Loads the (smaller) LoincTableCore.csv into memory as a lookup table. */
async function loadCore(path: string): Promise<{ rows: Map<string, string[]>; header: string[] }> {
  const rows = new Map<string, string[]>();
  let header: string[] | null = null;
  for await (const row of iterateCsvRows(path)) {
    if (header === null) {
      header = row;
      continue;
    }
    const codeIdx = header.indexOf("LOINC_NUM");
    if (codeIdx === -1) continue;
    const code = (row[codeIdx] ?? "").trim();
    if (!/^\d+-\d+$/.test(code)) continue;
    rows.set(code, row);
  }
  return { rows, header: header ?? [] };
}

async function main(): Promise<void> {
  const { rows: coreRows, header: coreHeader } = await loadCore(loincCorePath);

  const entries: BloodEntry[] = [];
  const unitMap = new Map<string, UnitEntry>();
  let loincHeader: string[] | null = null;

  for await (const row of iterateCsvRows(loincPath)) {
    if (loincHeader === null) {
      loincHeader = row;
      continue;
    }
    const header = loincHeader;

    const code = cell(row, header, "LOINC_NUM");
    if (!code || !/^\d+-\d+$/.test(code)) continue;

    const system = cell(row, header, "SYSTEM");
    if (!system || !BLOOD_SYSTEM_RE.test(system)) continue;

    const coreRow = coreRows.get(code);

    const ucum = cell(row, header, "EXAMPLE_UCUM_UNITS");
    const exampleUnits = cell(row, header, "EXAMPLE_UNITS");
    const defaultMetric = ucum ? splitTokens(ucum)[0] ?? null : null;

    entries.push({
      c: code,
      n: cell(row, header, "LONG_COMMON_NAME") ?? cell(coreRow, coreHeader, "LONG_COMMON_NAME"),
      comp: cell(row, header, "COMPONENT") ?? cell(coreRow, coreHeader, "COMPONENT"),
      p: cell(row, header, "PROPERTY") ?? cell(coreRow, coreHeader, "PROPERTY"),
      t: cell(row, header, "TIME_ASPCT") ?? cell(coreRow, coreHeader, "TIME_ASPCT"),
      sys: system,
      sc: cell(row, header, "SCALE_TYP") ?? cell(coreRow, coreHeader, "SCALE_TYP"),
      m: cell(row, header, "METHOD_TYP") ?? cell(coreRow, coreHeader, "METHOD_TYP"),
      st: cell(row, header, "STATUS") ?? cell(coreRow, coreHeader, "STATUS"),
      eu: exampleUnits,
      uu: ucum,
      def: defaultMetric
    } satisfies BloodEntry);

    if (ucum) {
      for (const token of splitTokens(ucum)) {
        if (!unitMap.has(token)) {
          unitMap.set(token, { code: token, names: [token] });
        }
      }
    }
  }

  entries.sort((a, b) => a.c.localeCompare(b.c));

  const output = {
    version: LOINC_VERSION,
    source: "LOINC " + LOINC_VERSION + " (Loinc.csv + LoincTableCore.csv)",
    filter: "blood matrices (Bld, Ser, Plas, RBC, WBC, PPP, ...)",
    entries,
    units: [...unitMap.values()].sort((a, b) => a.code.localeCompare(b.code))
  };

  const json = JSON.stringify(output) + "\n";
  await writeFile(dataOutPath, json, "utf8");
  await writeFile(bundleOutPath, json, "utf8");

  const withDefault = entries.filter((e) => e.def).length;
  console.log(
    `Wrote ${entries.length} blood LOINC entries (${withDefault} with default metric, ` +
      `${unitMap.size} default metric units, ${(json.length / 1024 / 1024).toFixed(2)} MiB)`
  );
  console.log(`  ${dataOutPath}`);
  console.log(`  ${bundleOutPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});