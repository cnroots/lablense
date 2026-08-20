import { describe, expect, it } from "vitest";
import { LoincJsonImporter } from "@lablens/data";
import { createNodeDatabase } from "@lablens/data/node";

const bloodData = {
  version: "2.82",
  entries: [
    {
      c: "2345-7",
      n: "Glucose [Mass/volume] in Blood",
      comp: "Glucose",
      p: "MCnc",
      t: "Pt",
      sys: "Bld",
      sc: "Qn",
      m: null,
      st: "ACTIVE",
      eu: "mg/dL",
      uu: "mg/dL",
      def: "mg/dL"
    },
    {
      c: "3016-3",
      n: "Thyrotropin [Units/volume] in Serum",
      comp: "Thyrotropin",
      p: "ACnc",
      t: "Pt",
      sys: "Ser",
      sc: "Qn",
      m: null,
      st: "ACTIVE",
      eu: "mIU/L",
      uu: "m[IU]/L",
      def: "m[IU]/L"
    },
    {
      c: "50000-0",
      n: "No default metric (categorical)",
      comp: "Something",
      sys: "Bld",
      st: "ACTIVE"
    }
  ],
  units: [
    { code: "mg/dL", names: ["mg/dL"] },
    { code: "m[IU]/L", names: ["m[IU]/L", "mIU/L"] }
  ]
};

describe("LoincJsonImporter", () => {
  it("imports blood entries idempotently with default metrics", async () => {
    const handle = createNodeDatabase(":memory:");
    const importer = new LoincJsonImporter(handle.db, handle.transactions);

    const first = await importer.import({ data: bloodData });
    expect(first.inserted).toBe(3);
    expect(first.errors).toHaveLength(0);

    const second = await importer.import({ data: bloodData });
    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(3);

    const glucose = handle.connection
      .prepare("SELECT * FROM loinc WHERE code = '2345-7'")
      .get() as Record<string, unknown>;
    expect(glucose.display_name).toBe("Glucose [Mass/volume] in Blood");
    expect(glucose.default_unit).toBe("mg/dL");
    expect(glucose.system).toBe("Bld");

    const tsh = handle.connection
      .prepare("SELECT * FROM loinc WHERE code = '3016-3'")
      .get() as Record<string, unknown>;
    expect(tsh.default_unit).toBe("m[IU]/L");

    const categorical = handle.connection
      .prepare("SELECT * FROM loinc WHERE code = '50000-0'")
      .get() as Record<string, unknown>;
    expect(categorical.default_unit).toBeNull();
  });

  it("registers default metric units so they can be resolved", async () => {
    const handle = createNodeDatabase(":memory:");
    const importer = new LoincJsonImporter(handle.db, handle.transactions);
    await importer.import({ data: bloodData });

    const unit = handle.connection
      .prepare("SELECT * FROM unit WHERE ucum_code = 'm[IU]/L'")
      .get() as Record<string, unknown>;
    expect(unit).toBeTruthy();

    const alias = handle.connection
      .prepare("SELECT * FROM unit_name WHERE name = 'mIU/L'")
      .get() as Record<string, unknown>;
    expect(alias).toBeTruthy();
  });

  it("records the import so the app can gate on it", async () => {
    const handle = createNodeDatabase(":memory:");
    const importer = new LoincJsonImporter(handle.db, handle.transactions);
    await importer.import({ data: bloodData });

    const row = handle.connection
      .prepare("SELECT * FROM data_import WHERE dataset = 'LOINC.BLOOD'")
      .get() as Record<string, unknown>;
    expect(row).toBeTruthy();
    expect(row.version).toBe("2.82");
  });
});