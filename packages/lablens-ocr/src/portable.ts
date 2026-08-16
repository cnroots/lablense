// Portable OCR surface for runtimes without Node-specific engines (e.g.
// React Native / Expo). Re-exports everything except the Node-only
// `PaddleOcrEngine` (which pulls in `ppu-paddle-ocr`, `ppu-ocv/canvas` and
// `onnxruntime-node`). Mobile runtimes provide their own `OcrEngine`
// implementation instead.

export * from "./engines/ocr-engine";
export * from "./engines/mock-ocr-engine";

export * from "./extraction/ocr-result";
export * from "./extraction/lab-value-extractor";
export * from "./extraction/lab-report-extractor";

export * from "./layout/table-detect";

export * from "./parsing/number-parser";
export * from "./parsing/unit-parser";
export * from "./parsing/row-parser";
export * from "./parsing/row-parser-tokens";

export * from "./matching/confidence";
export * from "./matching/analyte-matcher";
export * from "./matching/unit-matcher";
