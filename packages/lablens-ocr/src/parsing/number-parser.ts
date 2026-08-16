import type { Comparator } from "@lablens/core";
import type { ParsedValue, ValueParser } from "@lablens/core";

function mapComparator(token: string): Comparator | undefined {
  switch (token) {
    case "<":
      return "<";
    case "<=":
    case "≤":
      return "<=";
    case ">":
      return ">";
    case ">=":
    case "≥":
      return ">=";
    case "=":
      return undefined;
    default:
      return undefined;
  }
}

function stripTrailingFlags(input: string): string {
  let s = input;
  for (let i = 0; i < 3; i++) {
    const next = s.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

export function parseNumber(raw: string): number | null {
  let s = raw.trim().replace(/\s+/g, "");
  if (!s) return null;

  s = s.replace(/[.,]+\s*$/, "");

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    s = s.replace(",", ".");
  }

  if (!/^-?\d+(\.\d+)?$/.test(s) && !/^-?\.\d+$/.test(s)) {
    return null;
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

export class NumberParser implements ValueParser {
  parse(rawValue: string): ParsedValue {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return { ok: false, error: "empty value" };
    }

    let rest = trimmed;
    let comparator: Comparator | undefined;

    const comparatorMatch = /^(<=|>=|≤|≥|<|>|=)/.exec(rest);
    if (comparatorMatch) {
      comparator = mapComparator(comparatorMatch[1]);
      rest = rest.slice(comparatorMatch[1].length).trim();
    }

    rest = stripTrailingFlags(rest);

    const numeric = parseNumber(rest);
    if (numeric !== null) {
      return { ok: true, value: numeric, comparator };
    }

    return { ok: true, valueText: trimmed, comparator };
  }
}
