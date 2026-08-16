import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Adds the remaining analytes found in the full BlutLaborOCR sample set
// (coagulation, proteins, lipids, iron status, thyroid antibodies, ESR) so
// that every value in the sample reports can be matched.

const seedPath = fileURLToPath(new URL("../data/app/tests.json", import.meta.url));

type Name = { name: string; type: "canonical" | "synonym" | "abbreviation"; language?: string };
type Unit = { ucum: string; display: string; aliases: string[] };
type Range = {
  type: "numeric";
  unit: string;
  lower?: { value: number; operator: ">" | ">=" };
  upper?: { value: number; operator: "<" | "<=" };
};
interface Test {
  key: string;
  displayName: string;
  group: string;
  loinc?: string;
  names: Name[];
  units: Unit[];
  referenceRanges: Range[];
}

function noRange(): Range[] {
  return [];
}
function upper(unit: string, v: number): Range[] {
  return [{ type: "numeric", unit, upper: { value: v, operator: "<=" } }];
}
function lower(unit: string, v: number): Range[] {
  return [{ type: "numeric", unit, lower: { value: v, operator: ">" } }];
}
function range(unit: string, lo: number, hi: number): Range[] {
  return [{ type: "numeric", unit, lower: { value: lo, operator: ">=" }, upper: { value: hi, operator: "<=" } }];
}

const U_PER_L: Unit = { ucum: "U/L", display: "U/L", aliases: ["U/l", "UI"] };
const PCT: Unit = { ucum: "%", display: "%", aliases: ["Prozent"] };
const MG_DL: Unit = { ucum: "mg/dL", display: "mg/dL", aliases: ["mg/dl"] };
const MG_L: Unit = { ucum: "mg/L", display: "mg/L", aliases: ["mg/l"] };
const G_L: Unit = { ucum: "g/L", display: "g/L", aliases: ["g/l"] };
const UG_DL: Unit = { ucum: "µg/dL", display: "µg/dL", aliases: ["ug/dL", "µg/dl", "ug/dl"] };
const NG_ML: Unit = { ucum: "ng/mL", display: "ng/mL", aliases: ["ng/ml"] };
const SEC: Unit = { ucum: "s", display: "s", aliases: ["sec", "Sekunde"] };
const MM: Unit = { ucum: "mm", display: "mm", aliases: [] };
const U_ML: Unit = { ucum: "IU/mL", display: "U/mL", aliases: ["U/ml", "IU/mL", "IU/ml"] };

const NEW: Test[] = [
  {
    key: "gamma-globulin", displayName: "Gamma-Globulin", group: "proteins", loinc: "1394-6",
    names: [{ name: "Gamma-Globulin", type: "canonical", language: "de" }, { name: "γ-Globulin", type: "synonym" }],
    units: [PCT], referenceRanges: noRange()
  },
  {
    key: "beta-2-mikroglobulin", displayName: "Beta-2-Mikroglobulin", group: "proteins", loinc: "1952-1",
    names: [{ name: "Beta-2-Mikroglobulin", type: "canonical", language: "de" }, { name: "β2-Mikroglobulin", type: "synonym" }],
    units: [MG_L], referenceRanges: range("mg/L", 0.8, 2.2)
  },
  {
    key: "gesamteiweiss", displayName: "Gesamteiweiß", group: "proteins", loinc: "2885-2",
    names: [
      { name: "Gesamteiweiß", type: "canonical", language: "de" },
      { name: "Gesamteiweiss", type: "synonym", language: "de" },
      { name: "Gesamtprotein", type: "synonym", language: "de" },
      { name: "Total Protein", type: "synonym" }
    ],
    units: [G_L], referenceRanges: range("g/L", 66, 83)
  },
  {
    key: "igg", displayName: "Immunglobulin G (IgG)", group: "proteins", loinc: "2465-3",
    names: [
      { name: "Immunglobulin G", type: "canonical", language: "de" },
      { name: "Immunglobulin G (IgG)", type: "synonym" },
      { name: "IgG", type: "abbreviation" }
    ],
    units: [G_L], referenceRanges: range("g/L", 7, 16)
  },
  {
    key: "iga", displayName: "Immunglobulin A (IgA)", group: "proteins", loinc: "2458-8",
    names: [
      { name: "Immunglobulin A", type: "canonical", language: "de" },
      { name: "Immunglobulin A (IgA)", type: "synonym" },
      { name: "IgA", type: "abbreviation" }
    ],
    units: [G_L], referenceRanges: range("g/L", 0.7, 4.0)
  },
  {
    key: "igm", displayName: "Immunglobulin M (IgM)", group: "proteins", loinc: "2472-9",
    names: [
      { name: "Immunglobulin M", type: "canonical", language: "de" },
      { name: "Immunglobulin M (IgM)", type: "synonym" },
      { name: "IgM", type: "abbreviation" }
    ],
    units: [G_L], referenceRanges: range("g/L", 0.4, 2.3)
  },
  {
    key: "haptoglobin", displayName: "Haptoglobin", group: "proteins", loinc: "4542-7",
    names: [{ name: "Haptoglobin", type: "canonical", language: "de" }],
    units: [G_L], referenceRanges: range("g/L", 0.3, 2.0)
  },
  {
    key: "freie-kappa-ketten", displayName: "Freie Kappa-Leichtketten", group: "proteins", loinc: "36916-4",
    names: [
      { name: "Freie Kappa-Leichtketten", type: "canonical", language: "de" },
      { name: "Freie Kappa-Ketten", type: "synonym", language: "de" },
      { name: "Kappa-Leichtketten", type: "synonym", language: "de" }
    ],
    units: [MG_L], referenceRanges: noRange()
  },
  {
    key: "freie-lambda-ketten", displayName: "Freie Lambda-Leichtketten", group: "proteins", loinc: "36915-6",
    names: [
      { name: "Freie Lambda-Leichtketten", type: "canonical", language: "de" },
      { name: "Freie Lambda-Ketten", type: "synonym", language: "de" },
      { name: "Lambda-Leichtketten", type: "synonym", language: "de" }
    ],
    units: [MG_L], referenceRanges: noRange()
  },
  {
    key: "quick", displayName: "Quick", group: "coagulation", loinc: "5959-8",
    names: [{ name: "Quick", type: "canonical" }, { name: "Thromboplastinzeit", type: "synonym", language: "de" }, { name: "TPZ", type: "abbreviation" }],
    units: [PCT], referenceRanges: range("%", 70, 120)
  },
  {
    key: "inr", displayName: "INR", group: "coagulation", loinc: "34714-6",
    names: [{ name: "INR", type: "canonical" }, { name: "International Normalized Ratio", type: "synonym" }],
    units: [{ ucum: "", display: "", aliases: [] }], referenceRanges: range("", 0.9, 1.1)
  },
  {
    key: "aptt", displayName: "aPTT", group: "coagulation", loinc: "3173-2",
    names: [{ name: "aPTT", type: "canonical" }, { name: "aktivierte partielle Thromboplastinzeit", type: "synonym", language: "de" }, { name: "PTT", type: "abbreviation" }],
    units: [SEC], referenceRanges: range("s", 26, 36)
  },
  {
    key: "fibrinogen", displayName: "Fibrinogen", group: "coagulation", loinc: "3255-7",
    names: [{ name: "Fibrinogen", type: "canonical", language: "de" }],
    units: [MG_DL], referenceRanges: range("mg/dL", 180, 350)
  },
  {
    key: "plasminogen", displayName: "Plasminogen", group: "coagulation", loinc: "46542-5",
    names: [{ name: "Plasminogen", type: "canonical", language: "de" }],
    units: [PCT], referenceRanges: range("%", 75, 140)
  },
  {
    key: "thrombinzeit", displayName: "Thrombinzeit", group: "coagulation", loinc: "3243-3",
    names: [{ name: "Thrombinzeit", type: "canonical", language: "de" }, { name: "TZ", type: "abbreviation" }],
    units: [SEC], referenceRanges: upper("s", 21)
  },
  {
    key: "antithrombin", displayName: "Antithrombin III", group: "coagulation", loinc: "3174-0",
    names: [
      { name: "Antithrombin III", type: "canonical", language: "de" },
      { name: "Antithrombin", type: "synonym", language: "de" },
      { name: "AT III", type: "abbreviation" }
    ],
    units: [PCT], referenceRanges: range("%", 80, 120)
  },
  {
    key: "d-dimer", displayName: "D-Dimer", group: "coagulation", loinc: "48065-5",
    names: [{ name: "D-Dimer", type: "canonical" }, { name: "D-Dimer (FEU)", type: "synonym" }, { name: "D-Dimere", type: "synonym", language: "de" }],
    units: [NG_ML], referenceRanges: upper("ng/mL", 500)
  },
  {
    key: "eisen", displayName: "Eisen", group: "iron", loinc: "2498-4",
    names: [{ name: "Eisen", type: "canonical", language: "de" }, { name: "Serumeisen", type: "synonym", language: "de" }, { name: "Fe", type: "abbreviation" }],
    units: [UG_DL], referenceRanges: range("µg/dL", 60, 180)
  },
  {
    key: "transferrin", displayName: "Transferrin", group: "iron", loinc: "3034-2",
    names: [{ name: "Transferrin", type: "canonical", language: "de" }],
    units: [MG_DL], referenceRanges: range("mg/dL", 200, 360)
  },
  {
    key: "transferrinsaettigung", displayName: "Transferrinsättigung", group: "iron", loinc: "2502-3",
    names: [
      { name: "Transferrinsättigung", type: "canonical", language: "de" },
      { name: "Transferrin-Sättigung", type: "synonym", language: "de" },
      { name: "Transferrinsaettigung", type: "synonym", language: "de" },
      { name: "Transferrin-Saettigung", type: "synonym", language: "de" }
    ],
    units: [PCT], referenceRanges: range("%", 16, 45)
  },
  {
    key: "loeslicher-transferrinrezeptor", displayName: "Löslicher Transferrin-Rezeptor", group: "iron", loinc: "49628-1",
    names: [
      { name: "Löslicher Transferrin-Rezeptor", type: "canonical", language: "de" },
      { name: "Löslicher Transferrinrezeptor", type: "synonym", language: "de" },
      { name: "Transferrinrezeptor", type: "synonym", language: "de" },
      { name: "sTfR", type: "abbreviation" }
    ],
    units: [MG_L], referenceRanges: noRange()
  },
  {
    key: "tpo-ak", displayName: "TPO-Antikörper", group: "thyroid", loinc: "5351-2",
    names: [
      { name: "TPO-Antikörper", type: "canonical", language: "de" },
      { name: "TPO-AK", type: "synonym", language: "de" },
      { name: "Anti-TPO", type: "synonym" },
      { name: "TPO-AK LIA", type: "synonym" }
    ],
    units: [U_ML], referenceRanges: upper("IU/mL", 34)
  },
  {
    key: "omega-6-omega-3-quotient", displayName: "Omega-6/Omega-3-Quotient", group: "fatty-acids",
    names: [
      { name: "Omega-6/Omega-3-Quotient", type: "canonical", language: "de" },
      { name: "Omega-6-/Omega-3-Quotient", type: "synonym", language: "de" }
    ],
    units: [{ ucum: "", display: "", aliases: [] }], referenceRanges: noRange()
  },
  {
    key: "triglyceride", displayName: "Triglyceride", group: "lipids", loinc: "2571-8",
    names: [{ name: "Triglyceride", type: "canonical", language: "de" }, { name: "Triglyceride", type: "synonym" }],
    units: [MG_DL], referenceRanges: upper("mg/dL", 150)
  },
  {
    key: "cholesterin", displayName: "Cholesterin", group: "lipids", loinc: "2093-3",
    names: [
      { name: "Cholesterin", type: "canonical", language: "de" },
      { name: "Gesamtcholesterin", type: "synonym", language: "de" },
      { name: "Gesamt-Cholesterin", type: "synonym", language: "de" }
    ],
    units: [MG_DL], referenceRanges: upper("mg/dL", 200)
  },
  {
    key: "hdl-cholesterin", displayName: "HDL-Cholesterin", group: "lipids", loinc: "2085-9",
    names: [
      { name: "HDL-Cholesterin", type: "canonical", language: "de" },
      { name: "HDL-gebundenes Cholesterin", type: "synonym", language: "de" },
      { name: "HDL-geb. Cholesterin", type: "synonym", language: "de" },
      { name: "HDL", type: "abbreviation" }
    ],
    units: [MG_DL], referenceRanges: lower("mg/dL", 40)
  },
  {
    key: "ldl-cholesterin", displayName: "LDL-Cholesterin", group: "lipids", loinc: "13457-7",
    names: [
      { name: "LDL-Cholesterin", type: "canonical", language: "de" },
      { name: "LDL-gebundenes Cholesterin", type: "synonym", language: "de" },
      { name: "LDL-geb. Cholesterin", type: "synonym", language: "de" },
      { name: "LDL", type: "abbreviation" }
    ],
    units: [MG_DL], referenceRanges: upper("mg/dL", 130)
  },
  {
    key: "non-hdl-cholesterin", displayName: "Non-HDL-Cholesterin", group: "lipids", loinc: "43396-1",
    names: [
      { name: "Non-HDL-Cholesterin", type: "canonical", language: "de" },
      { name: "Non-HDL", type: "synonym" }
    ],
    units: [MG_DL], referenceRanges: upper("mg/dL", 160)
  },
  {
    key: "bks", displayName: "Blutsenkungsgeschwindigkeit", group: "inflammation", loinc: "4537-7",
    names: [
      { name: "Blutsenkungsgeschwindigkeit", type: "canonical", language: "de" },
      { name: "Blutkörperchensenkungsgeschwindigkeit", type: "synonym", language: "de" },
      { name: "BKS", type: "abbreviation" },
      { name: "BSG", type: "abbreviation" }
    ],
    units: [MM], referenceRanges: upper("mm", 15)
  }
];

async function main(): Promise<void> {
  const seed = JSON.parse(await readFile(seedPath, "utf8"));

  const groupKeys = new Set(seed.groups.map((g: { key: string }) => g.key));
  for (const key of ["coagulation", "proteins", "lipids"]) {
    if (!groupKeys.has(key)) {
      const name = key === "coagulation" ? "Gerinnung" : key === "proteins" ? "Eiweiß" : "Blutfette";
      seed.groups.push({ key, name });
    }
  }

  const existing = new Set(seed.tests.map((t: { key: string }) => t.key));
  let added = 0;
  for (const test of NEW) {
    if (existing.has(test.key)) continue;
    seed.tests.push(test);
    added++;
  }

  await writeFile(seedPath, JSON.stringify(seed, null, 2) + "\n", "utf8");
  console.log(`Added ${added} analytes; total ${seed.tests.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
