import { sqliteTable, text, real, primaryKey } from "drizzle-orm/sqlite-core";

export const testGroup = sqliteTable("test_group", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description")
});

export const analyte = sqliteTable("analyte", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  displayName: text("display_name").notNull(),
  groupId: text("group_id").references(() => testGroup.id),
  description: text("description")
});

export const analyteName = sqliteTable("analyte_name", {
  id: text("id").primaryKey(),
  analyteId: text("analyte_id")
    .notNull()
    .references(() => analyte.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  normalized: text("normalized").notNull(),
  language: text("language"),
  type: text("type").notNull(),
  source: text("source")
});

export const loinc = sqliteTable("loinc", {
  code: text("code").primaryKey(),
  displayName: text("display_name"),
  version: text("version").notNull(),
  status: text("status"),
  component: text("component"),
  property: text("property"),
  timeAspect: text("time_aspect"),
  system: text("system"),
  scaleType: text("scale_type"),
  method: text("method"),
  exampleUnits: text("example_units"),
  exampleUcumUnits: text("example_ucum_units"),
  defaultUnit: text("default_unit")
});

export const analyteLoinc = sqliteTable(
  "analyte_loinc",
  {
    analyteId: text("analyte_id")
      .notNull()
      .references(() => analyte.id, { onDelete: "cascade" }),
    loincCode: text("loinc_code")
      .notNull()
      .references(() => loinc.code, { onDelete: "cascade" })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.analyteId, table.loincCode] })
  })
);

export const unit = sqliteTable("unit", {
  id: text("id").primaryKey(),
  ucumCode: text("ucum_code").notNull().unique(),
  displayName: text("display_name").notNull()
});

export const unitName = sqliteTable("unit_name", {
  id: text("id").primaryKey(),
  unitId: text("unit_id")
    .notNull()
    .references(() => unit.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  normalized: text("normalized").notNull()
});

export const analyteUnit = sqliteTable(
  "analyte_unit",
  {
    analyteId: text("analyte_id")
      .notNull()
      .references(() => analyte.id, { onDelete: "cascade" }),
    unitId: text("unit_id")
      .notNull()
      .references(() => unit.id, { onDelete: "cascade" })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.analyteId, table.unitId] })
  })
);

export const source = sqliteTable("source", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url"),
  version: text("version"),
  accessedAt: text("accessed_at")
});

export const referenceRange = sqliteTable("reference_range", {
  id: text("id").primaryKey(),
  analyteId: text("analyte_id")
    .notNull()
    .references(() => analyte.id, { onDelete: "cascade" }),
  unitId: text("unit_id").references(() => unit.id),
  type: text("type").notNull(),
  lowerValue: real("lower_value"),
  lowerOperator: text("lower_operator"),
  upperValue: real("upper_value"),
  upperOperator: text("upper_operator"),
  categoricalValue: text("categorical_value"),
  sourceId: text("source_id").references(() => source.id)
});

export const referenceCondition = sqliteTable("reference_condition", {
  id: text("id").primaryKey(),
  referenceRangeId: text("reference_range_id")
    .notNull()
    .references(() => referenceRange.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  operator: text("operator").notNull(),
  value: text("value").notNull(),
  valueType: text("value_type").notNull()
});

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  ageYears: real("age_years"),
  sex: text("sex"),
  createdAt: text("created_at").notNull()
});

export const observation = sqliteTable("observation", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  analyteId: text("analyte_id")
    .notNull()
    .references(() => analyte.id),
  valueNumeric: real("value_numeric"),
  valueText: text("value_text"),
  comparator: text("comparator"),
  unitId: text("unit_id").references(() => unit.id),
  measuredAt: text("measured_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const observationProvenance = sqliteTable("observation_provenance", {
  id: text("id").primaryKey(),
  observationId: text("observation_id")
    .notNull()
    .unique()
    .references(() => observation.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  originalName: text("original_name"),
  originalValue: text("original_value"),
  originalUnit: text("original_unit"),
  extractionMethod: text("extraction_method"),
  extractionEngine: text("extraction_engine"),
  extractionEngineVersion: text("extraction_engine_version"),
  confidence: real("confidence"),
  createdAt: text("created_at").notNull()
});

export const dataImport = sqliteTable("data_import", {
  id: text("id").primaryKey(),
  dataset: text("dataset").notNull(),
  version: text("version").notNull(),
  importedAt: text("imported_at").notNull(),
  status: text("status").notNull()
});
