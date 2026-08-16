export interface ParsedRow {
  name: string;
  value: string;
  unit?: string;
  reference?: string;
}

import {
  isComparatorNumber,
  isRange,
  isUnitLike,
  isValue,
  stripFlag
} from "./row-parser-tokens";

function cleanUnit(token: string | undefined): string | undefined {
  if (!token) return undefined;
  return token.replace(/^[\[(]/, "").replace(/[\])]$/, "").trim() || undefined;
}

function cleanName(tokens: string[]): string {
  return tokens.join(" ").replace(/[:;]\s*$/, "").trim();
}

export function parseRow(line: string): ParsedRow | null {
  const s = line.trim();
  if (!s) return null;

  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  let valueIndex = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (isValue(tokens[i]!) || isComparatorNumber(tokens[i]!)) {
      valueIndex = i;
      break;
    }
  }

  if (valueIndex < 0) {
    const categorical = /^([^:;]+?)[:;]\s*(.+)$/.exec(s);
    if (categorical) {
      return { name: categorical[1]!.trim(), value: categorical[2]!.trim() };
    }
    return null;
  }

  const value = stripFlag(tokens[valueIndex]!);

  let reference: string | undefined;
  let refIndex = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (i === valueIndex) continue;
    if (isRange(tokens[i]!) || isComparatorNumber(tokens[i]!)) {
      reference = tokens[i];
      refIndex = i;
      break;
    }
  }

  let unit: string | undefined;
  let unitIndex = -1;
  if (valueIndex > 0 && isUnitLike(tokens[valueIndex - 1]!)) {
    unit = tokens[valueIndex - 1];
    unitIndex = valueIndex - 1;
  } else if (valueIndex + 1 < tokens.length && isUnitLike(tokens[valueIndex + 1]!)) {
    unit = tokens[valueIndex + 1];
    unitIndex = valueIndex + 1;
  } else {
    for (let i = valueIndex - 1; i >= 0; i--) {
      if (isValue(tokens[i]!)) break;
      if (isUnitLike(tokens[i]!)) {
        unit = tokens[i];
        unitIndex = i;
        break;
      }
    }
  }

  const structural = [valueIndex, unitIndex, refIndex].filter((i) => i >= 0);
  const firstStructural = structural.length > 0 ? Math.min(...structural) : tokens.length;
  const nameTokens = tokens.slice(0, firstStructural);

  return {
    name: cleanName(nameTokens),
    value,
    unit: cleanUnit(unit),
    reference: reference ?? undefined
  };
}
