# LabLens

Offline-first laboratory-value platform with an Android application.

LabLens stores personal laboratory/blood-test values locally, provides
standardized terminology (LOINC + UCUM), context-dependent reference
intervals, historical observations, and an OCR import workflow that matches
scanned lab values against the terminology database — all **without ever
persisting the scanned document**.

## Architecture

```
LabLens Mobile (React Native + Expo)
      │
      ▼
lablens-core          domain + services + repository ports (portable TS)
      ▲
      ├── lablens-data    shared Drizzle schema + repositories
      │     ├── drivers/expo-sqlite   (Android/iOS, expo-sqlite)
      │     └── drivers/node-sqlite   (Node.js tooling/tests, better-sqlite3)
      └── lablens-ocr     OCR engine abstraction, parsing, matching, confidence
```

`lablens-core` defines the domain and repository interfaces and never knows
which SQLite driver is in use. `lablens-data` holds the shared Drizzle schema
and repository logic once, plus two thin platform drivers:

- `@lablens/data/expo` — `createExpoDatabase()` (expo-sqlite)
- `@lablens/data/node` — `createNodeDatabase()` (better-sqlite3) and the
  Node-only LOINC/UCUM importers

The mobile app imports `@lablens/data` and `@lablens/data/expo`; the
development tooling, the optional REST API and the test suite import
`@lablens/data` and `@lablens/data/node`.

`apps/api` is an optional Hono REST adapter over the same services the app uses
in-process. See `docs/ARCHITECTURE.md` for the dependency rules.

## Project structure

```
packages/
  lablens-core/    domain, services, repositories (interfaces), ports
  lablens-data/    shared schema + repositories, drivers (expo-sqlite / node-sqlite), importers
  lablens-ocr/     engines, extraction, parsing, matching, confidence
apps/
  mobile/          React Native + Expo app (Android/iOS)
  api/             Hono REST API (/api/v1)
data/
  app/tests.json   initial analytes, groups, units, reference ranges
  loinc/           LOINC import instructions (not bundled — see license)
  ucum/            UCUM import instructions
docs/              ARCHITECTURE, DATA_MODEL, OCR_PIPELINE
```

## Local-first model

- Everything runs locally; the terminology/reference database initializes
  once, then the app is fully offline.
- No authentication. Multiple local profiles are possible; one default profile
  is used initially.
- Observations are normalized (not a wide table); interpretation
  (`low/normal/high/unknown`) is computed dynamically from
  `Observation + PatientContext + ReferenceRangeResolver` — never stored.

## Setup

```bash
npm install
npm run typecheck
npm test
```

## Database

```bash
npm run db:migrate    # create/upgrade the SQLite schema
npm run db:prefill    # import data/app/tests.json (groups, analytes, units, ranges)
```

The default database file is `./data/lablens.db` (override with `LABLENS_DB`).

## Terminology import

- **Application data** — `npm run db:prefill` imports `data/app/tests.json`.
- **LOINC** — download the official `Loinc.csv` and `LoincTableCore.csv` from
  loinc.org after accepting its license, then use `LoincImporter` (streaming,
  idempotent, upsert). LabLens never fabricates LOINC codes. The mobile app
  ships a bundled blood-value subset (`npm run loinc:blood` → `LoincJsonImporter`)
  with a default metric per entry. See `data/loinc/README.md`.
- **UCUM** — UCUM codes are canonical; `UcumImporter` accepts a JSON unit list.
  See `data/ucum/README.md`.

## OCR workflow

`image → OcrEngine → OcrResult → lab-value-extractor → ExtractedLabValue[] →`
`analyte/unit matching + confidence → ImportCandidate[] → review → commit`.

Documents are transient and never persisted. See `docs/OCR_PIPELINE.md`.

## REST API

```bash
npm run api:dev    # http://localhost:3000/api/v1
```

Example:

```
GET /api/v1/tests/search?q=Thyreotropin
GET /api/v1/users/{id}/observations
POST /api/v1/users/{id}/import/preview
POST /api/v1/users/{id}/import
```

All request/response boundaries use Zod validation. Business logic lives in
application services, never in route handlers.

## Tests

```bash
npm test             # Vitest (core, data, ocr, api)
```

## Privacy

Offline, local-only by default. No cloud calls, no external OCR, no analytics
containing measurements, no logging of raw health values, no document
persistence.

## Disclaimer

LabLens organizes laboratory values and supports interpretation against
reference intervals. It does **not** provide diagnoses. Bundled reference
ranges are approximate adult defaults for development and must be replaced
with validated, laboratory-specific ranges before clinical use.
# lablense
