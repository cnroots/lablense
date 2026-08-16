import type { Comparator } from "../domain/observation";

export interface ParsedValue {
  ok: boolean;
  value?: number;
  valueText?: string;
  comparator?: Comparator;
  error?: string;
}

export interface ValueParser {
  parse(rawValue: string): ParsedValue;
}
