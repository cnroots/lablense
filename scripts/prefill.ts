import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { AppDataImporter } from "@lablens/data";
import { createNodeDatabase } from "@lablens/data/node";

const dbPath = process.env.LABLENS_DB ?? "./data/lablens.db";
const appDataPath = fileURLToPath(
  new URL("../data/app/tests.json", import.meta.url)
);

const handle = createNodeDatabase(dbPath);

const importer = new AppDataImporter(handle.db, handle.transactions);
const result = await importer.import({
  data: JSON.parse(await readFile(appDataPath, "utf8"))
});

handle.connection.close();

console.log(
  `Prefilled ${dbPath}: inserted=${result.inserted} updated=${result.updated} skipped=${result.skipped} errors=${result.errors.length}`
);
