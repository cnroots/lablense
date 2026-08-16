export interface ParsedUnit {
  raw: string;
  cleaned: string;
}

export function parseUnit(rawUnit: string | undefined): ParsedUnit | null {
  if (!rawUnit) return null;
  let cleaned = rawUnit.trim();
  if (!cleaned) return null;
  cleaned = cleaned
    .replace(/^[[\](]/, "")
    .replace(/[\])]$/, "")
    .trim();
  if (!cleaned) return null;
  // The extractor occasionally merges the numeric value into the unit cell
  // (e.g. "16.75 g/dL" -> "g/dL", "3.52 x103/μL" -> "x103/μL"). Strip a
  // leading value so the unit still resolves.
  cleaned = cleaned.replace(/^[0-9]+([.,][0-9]+)?\s+/, "").trim();
  if (!cleaned) return null;
  return { raw: rawUnit, cleaned };
}
