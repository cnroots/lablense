# LOINC data

The official LOINC distribution is **not** bundled in this repository because it
is third-party copyrighted material distributed under the LOINC Terms of Use.

To import LOINC:

1. Download the official `Loinc.csv` (and optionally `LoincCore.csv`) from
   <https://loinc.org/downloads/> after accepting the LOINC license terms.
2. Place the CSV file in this directory (e.g. `data/loinc/Loinc.csv`).
3. Run the import, e.g.:

```bash
npx tsx -e "import('./scripts/loinc-import.ts').then(m => m.default())"
```

or via a small script that instantiates `LoincImporter`:

```ts
import { createDatabase, LoincImporter } from "@lablens/data";

const { db } = createDatabase("./data/lablens.db");
const importer = new LoincImporter(db, transactions);
await importer.import({ sourcePath: "./data/loinc/Loinc.csv", version: "2.82" });
```

## License / attribution

LOINC is copyright Regenstrief Institute, Inc. and the LOINC Committee. LOINC
codes and content are distributed under the LOINC Terms of Use. Review and
comply with the license at <https://loinc.org/license/> before redistributing
any LOINC-derived material.

LabLens does not fabricate LOINC codes and only stores LOINC content that has
been imported from an official distribution under the applicable license.
