# OCR pipeline

```
image/PDF
    ↓
OCR engine          (OcrEngine — PaddleOCR / ML Kit / Tesseract / mock)
    ↓
OCR cells           (OcrResult.cells — transient text boxes with geometry)
    ↓
table reconstruction   (layout/table-detect: column clustering + cell refinement)
    ↓
laboratory row extraction  (lab-report-extractor → ExtractedLabValue[])
    ↓
analyte matching         (analyte-matcher)
    ↓
unit matching            (unit-matcher)
    ↓
confidence scoring       (confidence)
    ↓
ImportCandidate[]
    ↓
user review / correction
    ↓
confirmed values
    ↓
ImportService.commit → transactional observation insert
```

## Transience

The original document is discarded after processing. Nothing from the document
is persisted:

- no images, PDFs, or object storage
- no OCR pages, blocks, words or bounding boxes in the database
- no raw OCR text, no full pages, no document filenames as a substitute

Only the resulting observation plus minimal `ObservationProvenance` remain.

## Engines

- `MockOcrEngine` — deterministic text input for tests.
- `PaddleOcrEngine` — Node adapter over `ppu-paddle-ocr` (PP-OCRv6), with
  automatic 0/90/180/270° orientation detection. Loaded via dynamic import so
  the optional native dependency never blocks the portable core. On Android a
  local engine (ML Kit / PaddleOCR mobile) implements the same `OcrEngine`
  interface.

## Layout / table reconstruction

Real lab reports are tables. `reconstructTable` clusters detected text boxes
into x-columns (with cluster refinement and cell splitting) and aligns cells
into rows, so `name | reference | unit | value` are cleanly separated even when
a single OCR box spans two columns.

`LabReportExtractor` then:

1. classifies columns by content (name / reference / unit / value) plus a
   positional rule (everything right of the reference/unit columns is a value
   column, so sparse date columns are not lost),
2. drops sparse section-header columns,
3. detects the date header row and maps each value column to its measurement
   date (left-to-right, positional), so **multi-date reports** yield one
   `ExtractedLabValue` per date with `measuredAt` populated,
4. stitches orphaned values onto adjacent rows that lack a value,
5. parses each value with comparator + flag stripping.

A text-only fallback (`row-parser`) handles plain `name value unit reference`
lines when no geometry is present.

## Matching

Analyte matching combines, in priority order: exact key, exact canonical /
synonym / abbreviation, OCR-confusable folding, token (section + analyte),
space-collapsed, abbreviated-token, and strict fuzzy — plus a
unit-compatibility adjustment. It avoids matching antibody/receptor compounds
(e.g. `TSH-Rezeptor Ak` is not `TSH`).

Unit matching normalizes OC×R unit variants (`uIU/ml` → `mU/L`, `UAI` → `U/L`,
`Tsd/µl` → `10*9/L`, `g/cl` → `g/dL`, …) against canonical UCUM codes.

## Confidence

Confidence is tracked per component (OCR, parsing, analyte, unit) and combined
into `overallConfidence = min(components)`. Thresholds are configurable.

## Benchmark

`npm run ocr:benchmark` runs the full pipeline over the sample report fixtures
in `packages/lablens-ocr/test/fixtures/` and compares extraction against
`packages/lablens-ocr/test/ground-truth.json`, reporting per-sample and overall
precision/recall.
