import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Fixes the group keys introduced by add-analytes.ts (German keys) and maps
// every analyte to a canonical English group key, matching the original seed.

const seedPath = fileURLToPath(new URL("../data/app/tests.json", import.meta.url));

// Canonical group key -> German display name (original + new).
const GROUPS: { key: string; name: string }[] = [
  { key: "muscle", name: "Muskeln" },
  { key: "pancreas", name: "Bauchspeicheldrüse" },
  { key: "thyroid", name: "Schilddrüse" },
  { key: "tumor-marker", name: "Tumormarker" },
  { key: "inflammation", name: "Entzündung" },
  { key: "electrolytes", name: "Elektrolyte" },
  { key: "metabolism", name: "Stoffwechsel" },
  { key: "blood-count", name: "Blutbild" },
  { key: "differential", name: "Differentialblutbild" },
  { key: "iron", name: "Eisenstoffwechsel" },
  { key: "vitamins", name: "Vitamine" },
  { key: "trace-elements", name: "Spurenelemente" },
  { key: "fatty-acids", name: "Fettsäuren" },
  { key: "liver", name: "Leber" },
  { key: "enzymes", name: "Enzyme" },
  { key: "heart", name: "Herz" },
  { key: "kidney", name: "Niere" }
];

// German group-name (or old key) -> canonical key.
const GROUP_ALIASES: Record<string, string> = {
  Spurenelemente: "trace-elements",
  Vitamine: "vitamins",
  Schilddrüse: "thyroid",
  Fettsäuren: "fatty-acids",
  Leber: "liver",
  Enzyme: "enzymes",
  Herz: "heart",
  Niere: "kidney"
};

async function main(): Promise<void> {
  const seed = JSON.parse(await readFile(seedPath, "utf8"));

  seed.groups = GROUPS.map((g) => ({ ...g }));

  for (const test of seed.tests) {
    if (!test.group) continue;
    const canonical = GROUP_ALIASES[test.group];
    if (canonical) test.group = canonical;
  }

  await writeFile(seedPath, JSON.stringify(seed, null, 2) + "\n", "utf8");

  const groups = new Set(seed.groups.map((g: { key: string }) => g.key));
  const refs = new Set(seed.tests.map((t: { group?: string }) => t.group));
  const dangling = [...refs].filter((r) => r && !groups.has(r));
  console.log(`groups: ${seed.groups.length}, analytes: ${seed.tests.length}`);
  if (dangling.length) console.log("dangling group refs:", dangling.join(", "));
  else console.log("all group refs resolve");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
