import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { UcumImporter } from "@lablens/data";
import { createNodeDatabase } from "@lablens/data/node";

const dbPath = process.env.LABLENS_DB ?? "./data/lablens.db";
const sourcePath = fileURLToPath(new URL("../data/ucum/units.json", import.meta.url));

const handle = createNodeDatabase(dbPath);

const importer = new UcumImporter(handle.db, handle.transactions);
const result = await importer.import({
  data: JSON.parse(await readFile(sourcePath, "utf8"))
});

handle.connection.close();

console.log(
  `UCUM import: inserted=${result.inserted} updated=${result.updated} skipped=${result.skipped} errors=${result.errors.length}`
);
