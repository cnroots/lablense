import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  AppDataImporter,
  SqliteUnitRepository
} from "@lablens/data";
import { createNodeDatabase, UcumImporter } from "@lablens/data/node";
import { UnitServiceImpl } from "@lablens/core";

const appDataPath = fileURLToPath(new URL("../data/app/tests.json", import.meta.url));
const ucumPath = fileURLToPath(new URL("../data/ucum/units.json", import.meta.url));

async function main(): Promise<void> {
  const handle = createNodeDatabase(":memory:");
  await new AppDataImporter(handle.db, handle.transactions).import({
    data: JSON.parse(await readFile(appDataPath, "utf8"))
  });
  await new UcumImporter(handle.db, handle.transactions).import({
    sourcePath: ucumPath
  });

  const repo = new SqliteUnitRepository(handle.db);
  const all = await repo.listAll();
  console.log("=== units + names (order) ===");
  for (const e of all) {
    const names = e.names.map((n) => n.name).join(", ");
    console.log(`  [${e.unit.ucumCode}] id=${e.unit.id.slice(0, 20)} names=${names}`);
  }

  const svc = new UnitServiceImpl(repo);
  for (const input of ["ng/ml", "ng/mL", "µg/L", "ug/L"]) {
    const m = await svc.normalize(input);
    console.log(`normalize(${JSON.stringify(input)}) -> ${m?.ucumCode ?? "null"} (id=${m?.unitId.slice(0, 20)})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
