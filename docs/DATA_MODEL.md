# Data model

## Entities

### `test_group`
A terminology category. `key` is a stable ASCII slug, `name` is the localized
display name (e.g. `Schilddrüse`).

### `analyte`
The fundamental terminology entity (TSH, Glucose, Ferritin, …). An analyte is
**not** an observation and **not** a single LOINC code. `key` is a stable,
language-independent identifier; `displayName` is localized.

### `analyte_name`
Synonyms/abbreviations for an analyte. `type` is `canonical | synonym |
abbreviation`; `normalized` is a deterministic normalization of `name`
(Unicode NFC/NFD folding, lowercase, German diacritics, whitespace,
punctuation). The original name is never modified.

### `loinc`
A LOINC concept (code, display name, version, component, property, time
aspect, system, scale type, method, example units). Imported from an official
distribution; LabLens never fabricates LOINC codes.

### `analyte_loinc`
Many-to-many between `analyte` and `loinc`. One analyte may map to many LOINC
codes (serum glucose, blood glucose, urine glucose, …).

### `unit`
A canonical unit with a UCUM code (`mg/dL`, `mmol/L`, …). UCUM is the single
canonical representation; LabLens does not create a competing ontology.

### `unit_name`
Unit aliases (`mg/dl`, `mg per dl` → `mg/dL`), stored normalized.

### `analyte_unit`
Which units an analyte can be expressed in.

### `source`
Metadata for externally supplied terminology/reference data (name, url,
version, access date). Never fabricated.

### `reference_range`
A context-dependent interval or categorical value for an analyte.
`type` is `numeric` (lower/upper `Bound`s with operators `<`, `<=`, `>`, `>=`)
or `categorical` (e.g. `negative`, `not detected`). A display string like
`"0,2–4,0"` is never the authoritative representation.

### `reference_condition`
A condition that qualifies a reference range: `sex = female`, `age >= 18`,
`pregnant = true`, `specimen = serum`, `method = …`. `value` is stored as text
plus a `value_type` (`string`/`number`/`boolean`) so new contextual factors do
not require schema migrations.

### `user`
A local profile. There is **no authentication**. The schema allows multiple
profiles; the initial app uses a single default profile.

### `observation`
An actual measurement for a user. Has `valueNumeric` and/or `valueText`, an
optional `comparator` (`<`, `<=`, `=`, `>=`, `>`), a `unitId`, and a full
`measuredAt` timestamp. `analyte_id + measured_at` is **not** unique: two TSH
measurements on the same date are legitimate.

### `observation_provenance`
Minimal provenance for an observation (`sourceType`, original name/value/unit,
extraction engine, confidence). Documents, images, PDFs, OCR pages and
bounding boxes are **never** stored.

### `data_import`
Terminology/data version tracking (e.g. `LOINC/2.82`, `UCUM/…`,
`application/1.0`) for reproducibility.

## Interpretation is derived, not stored

```
Observation + PatientContext + ReferenceRangeResolver → Interpretation
```

`isNormal`/`isHigh` are never stored as observation properties. The same value
can be interpreted differently by age, sex, pregnancy, laboratory, method or
reference dataset.
