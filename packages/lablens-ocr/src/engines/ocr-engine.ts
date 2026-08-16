import type { OcrResult } from "../extraction/ocr-result";

export type OcrInput =
  | { kind: "image"; data: Uint8Array; mimeType?: string }
  | { kind: "pdf"; data: Uint8Array }
  | { kind: "text"; text: string };

export interface OcrEngine {
  readonly name: string;
  readonly version?: string;

  recognize(input: OcrInput): Promise<OcrResult>;
}
