import { createNodeDatabase } from "@lablens/data/node";

const handle = createNodeDatabase("/tmp/kilo/lablens-seed.db");

const conn = handle.connection as import("better-sqlite3").Database;

const counts = (conn.prepare(
  `SELECT
     (SELECT COUNT(*) FROM analyte) analytes,
     (SELECT COUNT(*) FROM unit) units,
     (SELECT COUNT(*) FROM unit_name) unit_names,
     (SELECT COUNT(*) FROM loinc) loinc,
     (SELECT COUNT(*) FROM test_group) groups`
).get() as Record<string, number>);
console.log("counts:", counts);

const tsh = conn.prepare(
  `SELECT code, component, property, time_aspect, system, example_ucum_units, display_name
   FROM loinc WHERE code = '3016-3'`
).get() as Record<string, unknown>;
console.log("LOINC 3016-3 (TSH):", tsh);

const ferritin = conn.prepare(
  `SELECT code, example_ucum_units, display_name FROM loinc WHERE code = '2276-4'`
).get() as Record<string, unknown>;
console.log("LOINC 2276-4 (Ferritin):", ferritin);

const units = conn.prepare(`SELECT ucum_code, display_name FROM unit ORDER BY ucum_code`).all() as { ucum_code: string; display_name: string }[];
console.log(`\nunits (${units.length}):`, units.map((u) => u.ucum_code).join(", "));

handle.connection.close();
