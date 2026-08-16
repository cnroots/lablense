# Architecture

LabLens is a **reusable local application platform** for storing and
interpreting personal laboratory values. It is designed to run on an Android
phone, fully offline, after its terminology/reference database is initialized.

## Layers

```
LabLens Mobile (React Native + Expo)
      │
      ▼
lablens-core          (domain, services, repository ports)
      ▲
      ├── lablens-data   (shared Drizzle schema + repositories + platform drivers)
      └── lablens-ocr    (OCR engine abstraction, parsing, matching)
```

```
apps/mobile     (React Native + Expo app: screens, expo-sqlite driver, on-device OCR)
apps/api        (Hono REST adapter over core + data + ocr)
```

## Dependency direction

`lablens-core` has **no** dependency on infrastructure:

- no SQLite, no Drizzle, no Hono, no Android, no React Native/Expo
- no `node:sqlite`, `node:fs`, `node:http`, no filesystem APIs, no HTTP
- no PaddleOCR / ML Kit / Tesseract

It only defines domain models, application services, repository interfaces and
ports (clock, id generator, transaction runner, value parser, matchers).

`lablens-data` implements the repository interfaces once, against a shared
Drizzle schema, and adds two thin platform drivers (`@lablens/data/expo` with
expo-sqlite, `@lablens/data/node` with better-sqlite3). The repositories,
loaders and composition are identical on both platforms; only the driver and
the transaction runner differ.
`lablens-ocr` implements parsing and matching and depends only on `lablens-core`.

| Package          | Depends on                          |
| ---------------- | ----------------------------------- |
| lablens-core     | (nothing)                           |
| lablens-data     | lablens-core                        |
| lablens-ocr      | lablens-core                        |
| apps/mobile      | core, data, data/expo, ocr          |
| apps/api         | core, data, data/node, ocr          |

`apps/api` depends on `lablens-ocr` only to wire the matchers/value parser into
the core `ImportService` for the OCR import endpoints.

## Why REST is an adapter

The REST API (`apps/api`) is **optional infrastructure**. It exposes the same
application services the Android app calls in-process. It contains no domain
logic: every route goes

```
route → Zod validation → application service → repository → database
```

The Android app never talks HTTP; it composes the same services directly. This
is the reverse of a classic cloud client/server design: the services are the
product, REST is one adapter over them.

## Runtime strategy

```
core/domain         → portable TypeScript
shared repositories → lablens-data (once, driver-agnostic)
database driver     → runtime-specific (expo-sqlite on mobile, better-sqlite3 in dev)
OCR engine adapter  → runtime-specific (on-device PaddleOCR in the app)
REST API adapter    → runtime-specific (Hono + node:http in dev)
```

Only the `lablens-data` drivers and the adapters use platform-specific APIs.
The domain, services, schema and repository logic are portable TypeScript.
