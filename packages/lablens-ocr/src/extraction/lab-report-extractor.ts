import type { ExtractedLabValue, ValueParser } from "@lablens/core";
import type { OcrCell, OcrResult } from "./ocr-result";
import { reconstructTable } from "../layout/table-detect";
import { parseRow } from "../parsing/row-parser";
import { parseUnit } from "../parsing/unit-parser";
import { isUnitLike, isComparatorNumber, isRange } from "../parsing/row-parser-tokens";

export type ColumnRole = "name" | "reference" | "unit" | "value";

function classifyCell(text: string): ColumnRole | "empty" {
  const t = text.trim();
  if (!t) return "empty";
  if (isRange(t) || isComparatorNumber(t)) return "reference";
  if (isUnitLike(t)) return "unit";
  if (/^[<>≤≥=]?\s*[-+]?\d+(?:[.,]\d+)?(?:\s*\([^)]*\))?$/.test(t)) return "value";
  return "name";
}

function classifyColumns(rows: string[][]): (ColumnRole | null)[] {
  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const roles: (ColumnRole | null)[] = [];
  for (let c = 0; c < width; c++) {
    const counts: Record<string, number> = {
      name: 0,
      reference: 0,
      unit: 0,
      value: 0,
      empty: 0
    };
    for (const row of rows) {
      counts[classifyCell(row[c] ?? "")]++;
    }
    const nonEmpty = counts.name + counts.reference + counts.unit + counts.value;
    if (nonEmpty === 0) {
      roles.push(null);
      continue;
    }
    const dominant = ["value", "reference", "unit", "name"].reduce(
      (best, kind) => (counts[kind]! > counts[best]! ? kind : best),
      "name"
    );
    roles.push(dominant as ColumnRole);
  }

  let lastStructural = -1;
  for (let i = 0; i < roles.length; i++) {
    if (roles[i] === "reference" || roles[i] === "unit") lastStructural = i;
  }
  for (let i = lastStructural + 1; i < roles.length; i++) {
    roles[i] = "value";
  }

  return roles;
}

function estimateImageWidth(cells: OcrCell[][]): number {
  let max = 0;
  for (const line of cells) {
    for (const cell of line) {
      max = Math.max(max, cell.box.x + cell.box.width);
    }
  }
  return max || 1000;
}

const DATE_TOKEN = /\d{1,2}[.,]\d{1,2}[.,]\d{2,4}/g;

function extractDates(text: string): string[] {
  return text.match(DATE_TOKEN) ?? [];
}

function isDateHeader(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const withoutDates = t.replace(DATE_TOKEN, "").trim();
  return withoutDates.length === 0 || /^[\s.,;:()\-]+$/.test(withoutDates);
}

export function toIsoDate(date: string): string | null {
  const m = /^(\d{1,2})[.,](\d{1,2})[.,](\d{2,4})$/.exec(date);
  if (!m) return null;
  const day = m[1]!.padStart(2, "0");
  const month = m[2]!.padStart(2, "0");
  let year = m[3]!;
  if (year.length === 2) year = `20${year}`;
  return `${year}-${month}-${day}`;
}

export class LabReportExtractor {
  private readonly valueParser: ValueParser;

  constructor(valueParser: ValueParser) {
    this.valueParser = valueParser;
  }

  extract(result: OcrResult): ExtractedLabValue[] {
    if (result.cells && result.cells.length > 0) {
      const width = estimateImageWidth(result.cells);
      const table = reconstructTable(result.cells, width);
      if (table.columns.length >= 3) {
        return this.extractFromTable(
          table.rows,
          table.columns,
          result.cells,
          result.confidence
        );
      }
    }
    return this.extractFromText(result.text, result.confidence);
  }

  extractFromText(text: string, confidence: number): ExtractedLabValue[] {
    const values: ExtractedLabValue[] = [];
    for (const line of text.split(/\r?\n/)) {
      const row = parseRow(line);
      if (!row || !row.name || !row.value) continue;
      const parsed = this.valueParser.parse(row.value);
      values.push({
        rawName: row.name,
        rawValue: row.value,
        rawUnit: row.unit,
        rawReference: row.reference,
        value: parsed.value,
        comparator: parsed.comparator,
        confidence
      });
    }
    return values;
  }

  extractFromTable(
    rows: string[][],
    columns: number[],
    cells: OcrCell[][],
    confidence: number
  ): ExtractedLabValue[] {
    const roles = classifyColumns(rows);
    const nameCols: number[] = [];
    const refCols: number[] = [];
    const unitCols: number[] = [];
    const valueCols: number[] = [];
    roles.forEach((role, i) => {
      if (role === "name") nameCols.push(i);
      else if (role === "reference") refCols.push(i);
      else if (role === "unit") unitCols.push(i);
      else if (role === "value") valueCols.push(i);
    });

    if (nameCols.length === 0 || valueCols.length === 0) {
      return [];
    }

    const sectionCols = this.detectSectionColumns(rows, nameCols);
    const activeNameCols = nameCols.filter((c) => !sectionCols.has(c));
    const dateByColumn = detectDates(cells, valueCols, columns);

    interface ParsedRow {
      name: string;
      reference: string;
      unit: string;
      values: Map<number, string>;
    }

    const parsedRows: ParsedRow[] = [];
    for (const row of rows) {
      const name = activeNameCols
        .map((c) => (row[c] ?? "").trim())
        .filter(Boolean)
        .join(" ");
      const values = new Map<number, string>();
      for (const vc of valueCols) {
        const t = (row[vc] ?? "").trim();
        if (t && !isDateHeader(t)) values.set(vc, t);
      }
      parsedRows.push({
        name,
        reference: this.pick(refCols, row),
        unit: this.pick(unitCols, row),
        values
      });
    }

    for (const vc of valueCols) {
      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i]!;
        const rawValue = row.values.get(vc);
        if (row.name || !rawValue) continue;
        const prev = i > 0 ? parsedRows[i - 1]! : null;
        const next = i + 1 < parsedRows.length ? parsedRows[i + 1]! : null;
        if (prev && prev.name && !prev.values.has(vc)) {
          prev.values.set(vc, rawValue);
          row.values.delete(vc);
        } else if (next && next.name && !next.values.has(vc)) {
          next.values.set(vc, rawValue);
          row.values.delete(vc);
        }
      }
    }

    const values: ExtractedLabValue[] = [];
    for (const row of parsedRows) {
      if (!row.name) continue;
      for (const [vc, rawValue] of row.values) {
        const parsed = this.valueParser.parse(rawValue);
        if (!parsed.ok) continue;
        values.push({
          rawName: row.name,
          rawValue,
          rawUnit: row.unit ? parseUnit(row.unit)?.cleaned : undefined,
          rawReference: row.reference || undefined,
          value: parsed.value,
          comparator: parsed.comparator,
          measuredAt: dateByColumn.get(vc),
          confidence
        });
      }
    }
    return values;
  }

  private pick(columns: number[], row: string[]): string {
    for (const c of columns) {
      const t = (row[c] ?? "").trim();
      if (t) return t;
    }
    return "";
  }

  private detectSectionColumns(
    rows: string[][],
    nameCols: number[]
  ): Set<number> {
    const sections = new Set<number>();
    if (nameCols.length < 2) return sections;
    for (const c of nameCols) {
      let nonEmpty = 0;
      let totalWords = 0;
      for (const row of rows) {
        const t = (row[c] ?? "").trim();
        if (t) {
          nonEmpty++;
          totalWords += t.split(/\s+/).length;
        }
      }
      const density = rows.length ? nonEmpty / rows.length : 0;
      const avgWords = nonEmpty ? totalWords / nonEmpty : 0;
      if (density < 0.25 && avgWords <= 2) {
        sections.add(c);
      }
    }
    return sections;
  }
}

function detectDates(
  cells: OcrCell[][],
  valueCols: number[],
  columnXs: number[]
): Map<number, string> {
  const map = new Map<number, string>();
  const tolerance = Math.max(20, 0.03 * (estimateImageWidth(cells) || 1000));

  for (const line of cells) {
    for (const cell of line) {
      if (!isDateHeader(cell.text)) continue;
      const dates = extractDates(cell.text);
      if (dates.length === 0) continue;

      const spanStart = cell.box.x;
      const spanEnd = cell.box.x + cell.box.width;
      const inSpan = valueCols.filter((vc) => {
        const cx = columnXs[vc];
        return cx >= spanStart - tolerance && cx <= spanEnd + tolerance;
      });
      if (inSpan.length === 0) continue;

      const dateXs = dates.map(
        (_, i) => spanStart + ((i + 0.5) * cell.box.width) / dates.length
      );
      for (let i = 0; i < dates.length; i++) {
        let bestCol = -1;
        let bestDist = Infinity;
        for (const vc of inSpan) {
          const dist = Math.abs(columnXs[vc] - dateXs[i]!);
          if (dist < bestDist) {
            bestDist = dist;
            bestCol = vc;
          }
        }
        if (bestCol >= 0 && !map.has(bestCol)) {
          const iso = toIsoDate(dates[i]!);
          if (iso) map.set(bestCol, iso);
        }
      }
    }
  }

  return map;
}
