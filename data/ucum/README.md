# UCUM data

The official UCUM (Unified Code for Units of Measure) specification and
essence file are not bundled here. LabLens uses UCUM codes as the canonical
unit representation and does **not** invent a competing unit ontology.

The `UcumImporter` accepts a JSON file of the shape:

```json
{
  "version": "1.0",
  "units": [
    { "code": "mg/dL", "names": ["milligram per deciliter", "mg/dl"] },
    { "code": "mmol/L", "names": ["millimole per liter", "mmol/l"] }
  ]
}
```

This format is a simplified projection of the official UCUM essence
(<https://ucum.org/>) suitable for the LabLens unit alias table. Full parsing
of the official `ucum-essence.xml` is out of scope; the importer interface is
the integration point for richer UCUM data later.

Every application unit imported via `data/app/tests.json` already carries a
canonical UCUM code, a display representation, and aliases.
