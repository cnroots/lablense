import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LoincImporter } from "@lablens/data/node";
import { createNodeDatabase } from "@lablens/data/node";

const csv = [
  'LOINC_NUM,COMPONENT,PROPERTY,TIME_ASPCT,SYSTEM,SCALE_TYP,METHOD_TYP,STATUS,EXAMPLE_UNITS,EXAMPLE_UCUM_UNITS,LONG_COMMON_NAME',
  '2345-7,Glucose,MCnc,Pt,Bld,Qn,,ACTIVE,mg/dL,mg/dL,"Glucose [Mass/volume] in Blood"',
  '3016-3,Thyrotropin,ACnc,Pt,Ser,Qn,,ACTIVE,mU/L,mU/L,"Thyrotropin [Units/volume] in Serum"',
  "MALFORMED"
].join("\n");

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    tempDirs.map((d) => rm(d, { recursive: true, force: true }))
  );
  tempDirs.length = 0;
});

async function writeFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "loinc-"));
  tempDirs.push(dir);
  const file = join(dir, "Loinc.csv");
  await writeFile(file, csv);
  return file;
}

describe("LoincImporter", () => {
  it("imports rows idempotently with statistics", async () => {
    const file = await writeFixture();
    const handle = createNodeDatabase(":memory:");
    const importer = new LoincImporter(handle.db, handle.transactions);

    const first = await importer.import({ sourcePath: file, version: "2.80" });
    expect(first.inserted).toBe(2);
    expect(first.skipped).toBe(1);
    expect(first.errors.length).toBe(1);

    const second = await importer.import({ sourcePath: file, version: "2.80" });
    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(2);

    const row = handle.connection
      .prepare("SELECT code, display_name, version FROM loinc WHERE code = '3016-3'")
      .get() as { code: string; display_name: string; version: string };
    expect(row.code).toBe("3016-3");
    expect(row.display_name).toBe("Thyrotropin [Units/volume] in Serum");
    expect(row.version).toBe("2.80");
  });
});
