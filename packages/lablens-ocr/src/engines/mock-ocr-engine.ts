import type { OcrEngine, OcrInput } from "./ocr-engine";
import type { OcrResult } from "../extraction/ocr-result";

export interface MockOcrEngineOptions {
  text?: string;
  confidence?: number;
}

export class MockOcrEngine implements OcrEngine {
  readonly name = "mock-ocr";
  readonly version = "1.0.0";

  private readonly text: string;
  private readonly confidence: number;

  constructor(options: MockOcrEngineOptions = {}) {
    this.text = options.text ?? "";
    this.confidence = options.confidence ?? 0.95;
  }

  async recognize(input: OcrInput): Promise<OcrResult> {
    const text = input.kind === "text" ? input.text : this.text;
    const lines = text
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "")
      .map((line) => ({
        text: line,
        confidence: this.confidence,
        words: line.split(/\s+/).map((word) => ({
          text: word,
          confidence: this.confidence
        }))
      }));

    return {
      text,
      confidence: this.confidence,
      lines
    };
  }
}
