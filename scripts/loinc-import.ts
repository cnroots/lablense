import { createNodeDatabase, LoincImporter } from "@lablens/data/node";

const dbPath = process.env.LABLENS_DB ?? "./data/lablens.db";
const version = process.env.LOINC_VERSION ?? "2.80";
const sourcePath =
  process.env.LOINC_CSV ?? "./data/loinc/Loinc.csv";

const handle = createNodeDatabase(dbPath);

const importer = new LoincImporter(handle.db, handle.transactions);
const result = await importer.import({ sourcePath, version });

handle.connection.close();

console.log(
  `LOINC import: inserted=${result.inserted} updated=${result.updated} skipped=${result.skipped} errors=${result.errors.length}`
);
