const NUM = String.raw`[-+]?\d+(?:[.,]\d+)?`;
const RANGE_RE = new RegExp(`^${NUM}\\s*(?:-|–|—)\\s*${NUM}$`);
const BIS_RE = new RegExp(`^bis\\s*${NUM}$`);
const CMP_NUM_RE = new RegExp(`^[<>≤≥]=?\\s*${NUM}$`);
const VALUE_RE = new RegExp(`^${NUM}(?:\\s*\\([^)]*\\))?$`);

export function isRange(token: string): boolean {
  return RANGE_RE.test(token) || BIS_RE.test(token);
}

export function isComparatorNumber(token: string): boolean {
  return CMP_NUM_RE.test(token);
}

export function isValue(token: string): boolean {
  return VALUE_RE.test(token);
}

export function isUnitLike(token: string): boolean {
  if (token.length > 10) return false;
  if (/[/%²³]/.test(token)) return true;
  if (/^[A-Za-zµμ]{1,3}$/.test(token)) return true;
  return false;
}

export function stripFlag(token: string): string {
  return token.replace(/\s*\([^)]*\)\s*$/, "").trim();
}
