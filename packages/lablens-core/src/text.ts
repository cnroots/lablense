export function normalizeTerm(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Normalizes a unit token for case-insensitive comparison (folding). This is
 * the canonical key used to index unit aliases; OCR confusable glyphs are
 * folded too.
 */
export function normalizeUnit(input: string): string {
  return normalizeUnitFolded(input);
}

export function normalizeUnitFolded(input: string): string {
  return input
    .normalize("NFC")
    .toLowerCase()
    .replace(/[µμ]/g, "u")
    .replace(/[Λλ]/g, "l")
    .replace(/\|/g, "l")
    .replace(/ł/g, "l")
    .replace(/ı/g, "i")
    .replace(/\bper\b/g, "")
    .replace(/%/g, "percent")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Normalizes a unit token but PRESERVES case, so magnitude-prefix case
 * differences survive (e.g. "G/l" giga/l vs "g/l" gram/l). Used for the exact
 * lookup pass before the case-insensitive fallback.
 */
export function normalizeUnitExact(input: string): string {
  return input
    .normalize("NFC")
    .replace(/[µμ]/g, "u")
    .replace(/[Λλ]/g, "l")
    .replace(/\|/g, "l")
    .replace(/ł/g, "l")
    .replace(/ı/g, "i")
    .replace(/\bper\b/gi, "")
    .replace(/%/g, "percent")
    .replace(/[^a-zA-Z0-9]/g, "");
}
