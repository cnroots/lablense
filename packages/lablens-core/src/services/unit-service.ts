import type { Unit, UnitMatch, UnitService } from "../domain/unit";
import type { UnitRepository } from "../repositories/unit-repository";
import { AppError } from "../errors";
import { normalizeUnitExact, normalizeUnitFolded } from "../text";

const PREFIX: Record<string, number> = {
  Y: 1e24,
  Z: 1e21,
  E: 1e18,
  P: 1e15,
  T: 1e12,
  G: 1e9,
  M: 1e6,
  k: 1e3,
  h: 1e2,
  da: 1e1,
  "": 1,
  d: 1e-1,
  c: 1e-2,
  m: 1e-3,
  u: 1e-6,
  µ: 1e-6,
  μ: 1e-6,
  n: 1e-9,
  p: 1e-12,
  f: 1e-15,
  a: 1e-18,
  z: 1e-21,
  y: 1e-24
};

const BASES = ["mol", "kat", "IU", "g", "L", "l", "U", "m", "s", "%"];

function canonicalBase(base: string): string {
  if (base === "l") return "L";
  return base;
}

interface DecomposedToken {
  prefix: number;
  base: string;
}

function decomposeToken(token: string): DecomposedToken | null {
  if (token.length === 0) return null;
  if (BASES.includes(token)) {
    return { prefix: 1, base: canonicalBase(token) };
  }
  const sortedBases = [...BASES].sort((a, b) => b.length - a.length);
  for (const base of sortedBases) {
    if (token.length <= base.length) continue;
    if (!token.endsWith(base)) continue;
    const prefixStr = token.slice(0, token.length - base.length);
    const factor = PREFIX[prefixStr];
    if (factor === undefined) continue;
    return { prefix: factor, base: canonicalBase(base) };
  }
  return null;
}

interface Decomposed {
  factor: number;
  dimension: string;
}

function decompose(code: string): Decomposed | null {
  const parts = code.split("/");
  if (parts.length > 2) return null;
  const num = decomposeToken(parts[0] ?? "");
  if (!num) return null;
  let factor = num.prefix;
  let dimension = num.base;
  const denom = parts[1];
  if (denom) {
    const den = decomposeToken(denom);
    if (!den) return null;
    factor /= den.prefix;
    dimension += "/" + den.base;
  }
  return { factor, dimension };
}

export function convertUnitValue(value: number, from: string, to: string): number {
  if (from === to) return value;
  const f = decompose(from);
  const t = decompose(to);
  if (f && t && f.dimension === t.dimension) {
    return value * (f.factor / t.factor);
  }
  throw new AppError(
    "CONVERSION_UNSUPPORTED",
    `Cannot convert unit "${from}" to "${to}"`
  );
}

interface UnitIndex {
  exact: Map<string, Unit>;
  folded: Map<string, Unit>;
}

export class UnitServiceImpl implements UnitService {
  private readonly repository: UnitRepository;
  private index: Promise<UnitIndex> | null = null;

  constructor(repository: UnitRepository) {
    this.repository = repository;
  }

  private getIndex(): Promise<UnitIndex> {
    if (!this.index) {
      this.index = this.buildIndex();
    }
    return this.index;
  }

  private async buildIndex(): Promise<UnitIndex> {
    const exact = new Map<string, Unit>();
    const folded = new Map<string, Unit>();
    const all = await this.repository.listAll();
    for (const entry of all) {
      const exactCode = normalizeUnitExact(entry.unit.ucumCode);
      if (!exact.has(exactCode)) exact.set(exactCode, entry.unit);
      const foldedCode = normalizeUnitFolded(entry.unit.ucumCode);
      if (!folded.has(foldedCode)) folded.set(foldedCode, entry.unit);
      for (const name of entry.names) {
        const exactName = normalizeUnitExact(name.name);
        if (!exact.has(exactName)) exact.set(exactName, entry.unit);
        const foldedName = normalizeUnitFolded(name.name);
        if (!folded.has(foldedName)) folded.set(foldedName, entry.unit);
      }
    }
    return { exact, folded };
  }

  async normalize(input: string): Promise<UnitMatch | null> {
    const exactKey = normalizeUnitExact(input);
    if (!exactKey) return null;
    const index = await this.getIndex();

    // Case-preserving lookup first (disambiguates "G/l" giga/l from "g/l"
    // gram/l), then the case-insensitive fallback.
    const unit = index.exact.get(exactKey) ?? index.folded.get(normalizeUnitFolded(input));
    if (!unit) return null;

    const codeNorm = normalizeUnitFolded(unit.ucumCode);
    const isExact = codeNorm === normalizeUnitFolded(input);

    return {
      unitId: unit.id,
      ucumCode: unit.ucumCode,
      displayName: unit.displayName,
      score: isExact ? 1 : 0.95,
      confidence: "high",
      strategies: isExact ? ["exact-code"] : ["alias"],
      explanation: isExact
        ? `Matched canonical UCUM code "${unit.ucumCode}"`
        : `Matched unit alias for "${unit.ucumCode}"`
    };
  }

  convert(value: number, from: string, to: string): number {
    return convertUnitValue(value, from, to);
  }
}
