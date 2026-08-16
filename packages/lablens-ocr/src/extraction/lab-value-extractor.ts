import type { ExtractedLabValue, ValueParser } from "@lablens/core";
import type { OcrResult } from "./ocr-result";
import { parseRow } from "../parsing/row-parser";

export class LabValueExtractor {
  private readonly valueParser: ValueParser;

  constructor(valueParser: ValueParser) {
    this.valueParser = valueParser;
  }

  extract(result: OcrResult): ExtractedLabValue[] {
    const lines = result.text.split(/\r?\n/);
    const values: ExtractedLabValue[] = [];

    for (const line of lines) {
      const row = parseRow(line);
      if (!row) continue;
      if (!row.name || !row.value) continue;

      const parsed = this.valueParser.parse(row.value);

      values.push({
        rawName: row.name,
        rawValue: row.value,
        rawUnit: row.unit,
        rawReference: row.reference,
        value: parsed.value,
        comparator: parsed.comparator,
        confidence: result.confidence
      });
    }

    return values;
  }
}
