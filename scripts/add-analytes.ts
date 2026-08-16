import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Extends the application seed with common analytes found in comprehensive
// German lab reports (trace elements, vitamin D, thyroid antibodies, and the
// fatty-acid profile), so OCR'd values for these metrics can be assigned.

const seedPath = fileURLToPath(new URL("../data/app/tests.json", import.meta.url));

interface Test {
  key: string;
  displayName: string;
  group: string;
  description?: string;
  loinc?: string;
  names: { name: string; type: "canonical" | "synonym" | "abbreviation"; language?: string }[];
  units: { ucum: string; display: string; aliases: string[] }[];
  referenceRanges: {
    type: "numeric" | "categorical";
    unit?: string;
    lower?: { value: number; operator: ">" | ">=" };
    upper?: { value: number; operator: "<" | "<=" };
  }[];
}

function pct(names: string[]): Test["referenceRanges"] {
  return [];
}

function numeric(
  unit: string,
  lower: number,
  upper: number
): Test["referenceRanges"] {
  return [{ type: "numeric", unit, lower: { value: lower, operator: ">=" }, upper: { value: upper, operator: "<=" } }];
}

function numericUpper(unit: string, upper: number): Test["referenceRanges"] {
  return [{ type: "numeric", unit, upper: { value: upper, operator: "<" } }];
}

const NEW: Test[] = [
  {
    key: "zink",
    displayName: "Zink",
    group: "Spurenelemente",
    loinc: "5763-8",
    names: [
      { name: "Zink", type: "canonical", language: "de" },
      { name: "Zink im Serum", type: "synonym", language: "de" },
      { name: "Zn", type: "abbreviation" }
    ],
    units: [{ ucum: "µg/L", display: "µg/L", aliases: ["µg/l", "ug/L", "ug/l"] }],
    referenceRanges: numeric("µg/L", 700, 1200)
  },
  {
    key: "vitamin-d3",
    displayName: "25-OH-Vitamin D",
    group: "Vitamine",
    loinc: "62292-8",
    names: [
      { name: "25-OH-Vitamin D", type: "canonical", language: "de" },
      { name: "Vitamin D3 (25-OH)", type: "synonym", language: "de" },
      { name: "25-Hydroxy-Vitamin D", type: "synonym", language: "de" },
      { name: "Vitamin D", type: "synonym", language: "de" },
      { name: "Calcidiol", type: "synonym" }
    ],
    units: [{ ucum: "µg/L", display: "µg/L", aliases: ["µg/l", "ug/L", "ug/l", "ng/mL", "ng/ml"] }],
    referenceRanges: numeric("µg/L", 20, 50)
  },
  {
    key: "thyreoglobulin-ak",
    displayName: "Thyreoglobulin-Antikörper",
    group: "Schilddrüse",
    loinc: "8099-4",
    names: [
      { name: "Thyreoglobulin-Antikörper", type: "canonical", language: "de" },
      { name: "TAK", type: "abbreviation" },
      { name: "Thyreoglobulin Ak", type: "synonym", language: "de" },
      { name: "Anti-Thyreoglobulin", type: "synonym", language: "de" }
    ],
    units: [{ ucum: "IU/mL", display: "U/mL", aliases: ["U/ml", "IU/mL", "IU/ml"] }],
    referenceRanges: numericUpper("IU/mL", 60)
  },
  {
    key: "omega-3-index",
    displayName: "Omega-3-Index",
    group: "Fettsäuren",
    names: [
      { name: "Omega-3-Index", type: "canonical", language: "de" },
      { name: "Omega-3-Index (EPA+DHA)", type: "synonym", language: "de" }
    ],
    units: [{ ucum: "%", display: "%", aliases: [] }],
    referenceRanges: pct([])
  },
  {
    key: "dha",
    displayName: "DHA (Docosahexaensäure)",
    group: "Fettsäuren",
    names: [
      { name: "DHA", type: "canonical" },
      { name: "Docosahexaensäure", type: "synonym", language: "de" },
      { name: "Docosahexaensaure", type: "synonym", language: "de" }
    ],
    units: [{ ucum: "%", display: "%", aliases: [] }],
    referenceRanges: pct([])
  },
  {
    key: "epa",
    displayName: "EPA (Eicosapentaensäure)",
    group: "Fettsäuren",
    names: [
      { name: "EPA", type: "canonical" },
      { name: "Eicosapentaensäure", type: "synonym", language: "de" },
      { name: "Eicosapentaensaeure", type: "synonym", language: "de" }
    ],
    units: [{ ucum: "%", display: "%", aliases: [] }],
    referenceRanges: pct([])
  },
  {
    key: "arachidonsaeure",
    displayName: "Arachidonsäure (AA)",
    group: "Fettsäuren",
    names: [
      { name: "Arachidonsäure", type: "canonical", language: "de" },
      { name: "Arachidonsaeure", type: "synonym", language: "de" },
      { name: "AA", type: "abbreviation" }
    ],
    units: [{ ucum: "%", display: "%", aliases: [] }],
    referenceRanges: pct([])
  },
  {
    key: "alpha-linolensaeure",
    displayName: "Alpha-Linolensäure (ALA)",
    group: "Fettsäuren",
    names: [
      { name: "Alpha-Linolensäure", type: "canonical", language: "de" },
      { name: "Alpha-Linolensaeure", type: "synonym", language: "de" },
      { name: "ALA", type: "abbreviation" }
    ],
    units: [{ ucum: "%", display: "%", aliases: [] }],
    referenceRanges: pct([])
  },
  {
    key: "gamma-linolensaeure",
    displayName: "Gamma-Linolensäure (GLA)",
    group: "Fettsäuren",
    names: [
      { name: "Gamma-Linolensäure", type: "canonical", language: "de" },
      { name: "Gamma-Linolensaeure", type: "synonym", language: "de" },
      { name: "GLA", type: "abbreviation" }
    ],
    units: [{ ucum: "%", display: "%", aliases: [] }],
    referenceRanges: pct([])
  },
  {
    key: "dihomo-gamma-linolensaeure",
    displayName: "Dihomo-gamma-Linolensäure",
    group: "Fettsäuren",
    names: [
      { name: "Dihomo-gamma-Linolensäure", type: "canonical", language: "de" },
      { name: "Dihomo-gamma-Linolensaeure", type: "synonym", language: "de" },
      { name: "DGLA", type: "abbreviation" }
    ],
    units: [{ ucum: "%", display: "%", aliases: [] }],
    referenceRanges: pct([])
  },
  {
    key: "linolsaeure",
    displayName: "Linolsäure",
    group: "Fettsäuren",
    names: [
      { name: "Linolsäure", type: "canonical", language: "de" },
      { name: "Linolsaeure", type: "synonym", language: "de" }
    ],
    units: [{ ucum: "%", display: "%", aliases: [] }],
    referenceRanges: pct([])
  },
  {
    key: "docosatetraensaeure",
    displayName: "Docosatetraensäure (DTA)",
    group: "Fettsäuren",
    names: [
      { name: "Docosatetraensäure", type: "canonical", language: "de" },
      { name: "Docosatetraensaeure", type: "synonym", language: "de" },
      { name: "DTA", type: "abbreviation" }
    ],
    units: [{ ucum: "%", display: "%", aliases: [] }],
    referenceRanges: pct([])
  },
  {
    key: "docosapentaensaeure",
    displayName: "Docosapentaensäure (DPA)",
    group: "Fettsäuren",
    names: [
      { name: "Docosapentaensäure", type: "canonical", language: "de" },
      { name: "Docosapentaensaeure", type: "synonym", language: "de" },
      { name: "DPA", type: "abbreviation" }
    ],
    units: [{ ucum: "%", display: "%", aliases: [] }],
    referenceRanges: pct([])
  },
  {
    key: "aa-epa-quotient",
    displayName: "AA/EPA-Quotient",
    group: "Fettsäuren",
    names: [
      { name: "AA/EPA-Quotient", type: "canonical", language: "de" },
      { name: "AA/EPA", type: "synonym" }
    ],
    units: [{ ucum: "%", display: "%", aliases: [] }],
    referenceRanges: pct([])
  },
  {
    key: "oelsaeure",
    displayName: "Ölsäure",
    group: "Fettsäuren",
    names: [
      { name: "Ölsäure", type: "canonical", language: "de" },
      { name: "Olsäure", type: "synonym", language: "de" },
      { name: "Ölsaeure", type: "synonym", language: "de" },
      { name: "Oleic acid", type: "synonym" }
    ],
    units: [{ ucum: "%", display: "%", aliases: [] }],
    referenceRanges: pct([])
  },
  {
    key: "tsh-rezeptor-ak",
    displayName: "TSH-Rezeptor-Antikörper",
    group: "Schilddrüse",
    loinc: "5385-0",
    names: [
      { name: "TSH-Rezeptor-Antikörper", type: "canonical", language: "de" },
      { name: "TSH-Rezeptor-AK", type: "synonym", language: "de" },
      { name: "TSH-Rezeptor Ak", type: "synonym", language: "de" },
      { name: "TRAK", type: "abbreviation" },
      { name: "TRAb", type: "abbreviation" }
    ],
    units: [{ ucum: "IU/L", display: "IU/L", aliases: ["IU/l", "U/l", "U/L"] }],
    referenceRanges: numericUpper("IU/L", 1.75)
  },
  {
    key: "got",
    displayName: "GOT (ASAT)",
    group: "Leber",
    loinc: "1920-8",
    names: [
      { name: "GOT", type: "abbreviation" },
      { name: "ASAT", type: "abbreviation" },
      { name: "Aspartat-Aminotransferase", type: "canonical", language: "de" },
      { name: "Glutamat-Oxalacetat-Transaminase", type: "synonym", language: "de" }
    ],
    units: [{ ucum: "U/L", display: "U/L", aliases: ["U/l", "UI", "UAI"] }],
    referenceRanges: numericUpper("U/L", 35)
  },
  {
    key: "gpt",
    displayName: "GPT (ALAT)",
    group: "Leber",
    loinc: "1742-6",
    names: [
      { name: "GPT", type: "abbreviation" },
      { name: "ALAT", type: "abbreviation" },
      { name: "Alanin-Aminotransferase", type: "canonical", language: "de" }
    ],
    units: [{ ucum: "U/L", display: "U/L", aliases: ["U/l", "UI"] }],
    referenceRanges: numericUpper("U/L", 35)
  },
  {
    key: "gamma-gt",
    displayName: "Gamma-GT",
    group: "Leber",
    loinc: "2324-2",
    names: [
      { name: "Gamma-GT", type: "canonical", language: "de" },
      { name: "GGT", type: "abbreviation" },
      { name: "Gamma-Glutamyltransferase", type: "synonym", language: "de" },
      { name: "γ-GT", type: "synonym" }
    ],
    units: [{ ucum: "U/L", display: "U/L", aliases: ["U/l", "UI"] }],
    referenceRanges: numericUpper("U/L", 40)
  },
  {
    key: "bilirubin-gesamt",
    displayName: "Bilirubin gesamt",
    group: "Leber",
    loinc: "1975-2",
    names: [
      { name: "Bilirubin gesamt", type: "canonical", language: "de" },
      { name: "Gesamt-Bilirubin", type: "synonym", language: "de" }
    ],
    units: [{ ucum: "mg/dL", display: "mg/dL", aliases: ["mg/dl"] }],
    referenceRanges: numericUpper("mg/dL", 1.2)
  },
  {
    key: "bilirubin-direkt",
    displayName: "Bilirubin direkt",
    group: "Leber",
    loinc: "1968-7",
    names: [
      { name: "Bilirubin direkt", type: "canonical", language: "de" },
      { name: "Direktes Bilirubin", type: "synonym", language: "de" },
      { name: "Bilirubin konjugiert", type: "synonym", language: "de" }
    ],
    units: [{ ucum: "mg/dL", display: "mg/dL", aliases: ["mg/dl"] }],
    referenceRanges: numericUpper("mg/dL", 0.3)
  },
  {
    key: "bilirubin-indirekt",
    displayName: "Bilirubin indirekt",
    group: "Leber",
    names: [
      { name: "Bilirubin indirekt", type: "canonical", language: "de" },
      { name: "Indirektes Bilirubin", type: "synonym", language: "de" }
    ],
    units: [{ ucum: "mg/dL", display: "mg/dL", aliases: ["mg/dl"] }],
    referenceRanges: numericUpper("mg/dL", 0.9)
  },
  {
    key: "ldh",
    displayName: "LDH",
    group: "Enzyme",
    loinc: "2532-0",
    names: [
      { name: "LDH", type: "canonical" },
      { name: "Laktatdehydrogenase", type: "synonym", language: "de" },
      { name: "Lactatdehydrogenase", type: "synonym" }
    ],
    units: [{ ucum: "U/L", display: "U/L", aliases: ["U/l", "UI"] }],
    referenceRanges: numericUpper("U/L", 250)
  },
  {
    key: "alk-phosphatase",
    displayName: "Alkalische Phosphatase",
    group: "Enzyme",
    loinc: "6768-6",
    names: [
      { name: "Alkalische Phosphatase", type: "canonical", language: "de" },
      { name: "Alk. Phosphatase", type: "synonym", language: "de" },
      { name: "AP", type: "abbreviation" }
    ],
    units: [{ ucum: "U/L", display: "U/L", aliases: ["U/l", "UI"] }],
    referenceRanges: numeric("U/L", 40, 130)
  },
  {
    key: "nt-pro-bnp",
    displayName: "NT-proBNP",
    group: "Herz",
    loinc: "33762-6",
    names: [
      { name: "NT-proBNP", type: "canonical" },
      { name: "NT-pro-BNP", type: "synonym" },
      { name: "N-terminales proBNP", type: "synonym", language: "de" }
    ],
    units: [{ ucum: "pg/mL", display: "pg/mL", aliases: ["pg/ml"] }],
    referenceRanges: numericUpper("pg/mL", 125)
  },
  {
    key: "harnsaeure",
    displayName: "Harnsäure",
    group: "Niere",
    loinc: "3084-7",
    names: [
      { name: "Harnsäure", type: "canonical", language: "de" },
      { name: "Harnsaeure", type: "synonym", language: "de" },
      { name: "Urat", type: "synonym", language: "de" }
    ],
    units: [{ ucum: "mg/dL", display: "mg/dL", aliases: ["mg/dl"] }],
    referenceRanges: numeric("mg/dL", 2.4, 7.0)
  },
  {
    key: "harnstoff",
    displayName: "Harnstoff",
    group: "Niere",
    loinc: "3094-6",
    names: [
      { name: "Harnstoff", type: "canonical", language: "de" },
      { name: "Urea", type: "synonym" }
    ],
    units: [{ ucum: "mg/dL", display: "mg/dL", aliases: ["mg/dl"] }],
    referenceRanges: numeric("mg/dL", 17, 43)
  },
  {
    key: "kreatinin",
    displayName: "Kreatinin",
    group: "Niere",
    loinc: "2160-0",
    names: [
      { name: "Kreatinin", type: "canonical", language: "de" },
      { name: "Creatinin", type: "synonym" },
      { name: "Kreatinin enzymatisch", type: "synonym", language: "de" }
    ],
    units: [{ ucum: "mg/dL", display: "mg/dL", aliases: ["mg/dl"] }],
    referenceRanges: numeric("mg/dL", 0.5, 1.2)
  },
  {
    key: "egfr",
    displayName: "eGFR (CKD-EPI)",
    group: "Niere",
    loinc: "62238-1",
    names: [
      { name: "eGFR", type: "canonical" },
      { name: "eGFR (CKD-EPI)", type: "synonym" },
      { name: "GFR", type: "synonym" },
      { name: "glomeruläre Filtrationsrate", type: "synonym", language: "de" }
    ],
    units: [{ ucum: "mL/min/1.73m²", display: "mL/min/1.73m²", aliases: ["ml/min/1.73m2", "mL/min"] }],
    referenceRanges: [{ type: "numeric", unit: "mL/min/1.73m²", lower: { value: 60, operator: ">" } }]
  }
];

async function main(): Promise<void> {
  const seed = JSON.parse(await readFile(seedPath, "utf8"));

  const existingGroups = new Set<string>(seed.groups.map((g: { key: string }) => g.key));
  const groupKeys = new Set<string>(NEW.map((t) => t.group));
  for (const key of groupKeys) {
    if (existingGroups.has(key.toLowerCase())) continue;
    seed.groups.push({ key, name: key });
    existingGroups.add(key.toLowerCase());
  }

  const existingTests = new Set<string>(seed.tests.map((t: { key: string }) => t.key));
  let added = 0;
  for (const test of NEW) {
    if (existingTests.has(test.key)) continue;
    seed.tests.push(test);
    added++;
  }

  await writeFile(seedPath, JSON.stringify(seed, null, 2) + "\n", "utf8");
  console.log(`Added ${added} analytes (groups: ${[...groupKeys].join(", ")})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
