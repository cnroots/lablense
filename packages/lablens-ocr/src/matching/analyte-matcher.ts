import type {
  Analyte,
  AnalyteMatch,
  AnalyteMatcher as AnalyteMatcherPort,
  ExtractedLabValue,
  UnitService
} from "@lablens/core";
import { normalizeTerm } from "@lablens/core";
import {
  normalizeOcrConfusables,
  scoreToConfidence,
  similarity
} from "./confidence";

interface AnalyteLister {
  list(): Promise<Analyte[]>;
}

interface NameEntry {
  analyte: Analyte;
  normalized: string;
  type: Analyte["names"][number]["type"];
}

function tokenPrefixMatch(rawNorm: string, entryNorm: string): boolean {
  const rawWords = rawNorm.split(/\s+/).filter(Boolean);
  const entryWords = entryNorm.split(/\s+/).filter(Boolean);
  if (rawWords.length === 0 || rawWords.length !== entryWords.length) {
    return false;
  }
  for (let i = 0; i < rawWords.length; i++) {
    const r = rawWords[i]!;
    const e = entryWords[i]!;
    if (r === e) continue;
    const shorter = r.length < e.length ? r : e;
    const longer = r.length < e.length ? e : r;
    const isPrefix = longer.startsWith(shorter);
    if (!isPrefix || shorter.length < 3 || shorter.length / longer.length < 0.35) {
      return false;
    }
  }
  return true;
}

interface Index {
  byKey: Map<string, Analyte>;
  names: NameEntry[];
}

export class AnalyteMatcher implements AnalyteMatcherPort {
  private readonly analytes: AnalyteLister;
  private readonly units?: UnitService;
  private index: Promise<Index> | null = null;

  constructor(analytes: AnalyteLister, units?: UnitService) {
    this.analytes = analytes;
    this.units = units;
  }

  private getIndex(): Promise<Index> {
    if (!this.index) {
      this.index = this.buildIndex();
    }
    return this.index;
  }

  private async buildIndex(): Promise<Index> {
    const analytes = await this.analytes.list();
    const byKey = new Map<string, Analyte>();
    const names: NameEntry[] = [];
    for (const analyte of analytes) {
      byKey.set(analyte.key, analyte);
      byKey.set(normalizeTerm(analyte.key), analyte);
      for (const name of analyte.names) {
        names.push({
          analyte,
          normalized: name.normalized,
          type: name.type
        });
      }
    }
    return { byKey, names };
  }

  async match(value: ExtractedLabValue): Promise<AnalyteMatch | null> {
    const raw = value.rawName.trim();
    if (!raw) return null;

    const norm = normalizeTerm(raw);
    const normOcr = normalizeOcrConfusables(norm);
    const normCollapsed = norm.replace(/\s+/g, "");
    const index = await this.getIndex();

    interface Candidate {
      analyte: Analyte;
      score: number;
      strategy: string;
      explanation: string;
    }

    const candidates: Candidate[] = [];

    const keyAnalyte = index.byKey.get(norm);
    if (keyAnalyte) {
      candidates.push({
        analyte: keyAnalyte,
        score: 1.0,
        strategy: "key",
        explanation: `Matched analyte key "${keyAnalyte.key}"`
      });
    }

    const tokens = norm.split(/\s+/).filter((t) => t.length >= 2);
    const isAntibodyTest =
      /rezeptor|receptor|antikörper|antikorper|antibody|\bak\b/.test(norm);
    const edgeTokens =
      tokens.length > 0 ? [tokens[0]!, tokens[tokens.length - 1]!] : [];
    if (!isAntibodyTest && tokens.length > 1) {
      for (const token of edgeTokens) {
        const tokenAnalyte = index.byKey.get(token);
        if (tokenAnalyte) {
          candidates.push({
            analyte: tokenAnalyte,
            score: 0.8,
            strategy: "token-key",
            explanation: `Matched key token "${token}" of "${norm}"`
          });
        }
      }
    }
    const tokenSet = new Set(isAntibodyTest ? [] : edgeTokens);

    for (const entry of index.names) {
      if (entry.normalized === norm) {
        const score =
          entry.type === "canonical" ? 1.0 : entry.type === "synonym" ? 0.95 : 0.9;
        candidates.push({
          analyte: entry.analyte,
          score,
          strategy: `exact-${entry.type}`,
          explanation: `Exact ${entry.type} match`
        });
        continue;
      }

      const entryOcr = normalizeOcrConfusables(entry.normalized);
      if (entryOcr === normOcr && entry.normalized !== norm) {
        candidates.push({
          analyte: entry.analyte,
          score: 0.85,
          strategy: "ocr-folding",
          explanation: `OCR-confusable match for "${entry.analyte.key}"`
        });
        continue;
      }

      if (norm.length >= 3 && entry.normalized.startsWith(norm)) {
        candidates.push({
          analyte: entry.analyte,
          score: 0.75,
          strategy: "prefix",
          explanation: `Prefix match for "${entry.analyte.key}"`
        });
        continue;
      }

      const entryCollapsed = entry.normalized.replace(/\s+/g, "");
      if (normCollapsed.length >= 4 && entryCollapsed.length >= 4) {
        if (entryCollapsed === normCollapsed) {
          candidates.push({
            analyte: entry.analyte,
            score: 0.88,
            strategy: "collapsed",
            explanation: `Space-collapsed match for "${entry.analyte.key}"`
          });
          continue;
        }
        const shorter = Math.min(entryCollapsed.length, normCollapsed.length);
        const longer = Math.max(entryCollapsed.length, normCollapsed.length);
        const isPrefix =
          entryCollapsed.startsWith(normCollapsed) ||
          normCollapsed.startsWith(entryCollapsed);
        if (isPrefix && shorter >= 5 && shorter / longer >= 0.5) {
          candidates.push({
            analyte: entry.analyte,
            score: 0.72,
            strategy: "collapsed-prefix",
            explanation: `Space-collapsed prefix match for "${entry.analyte.key}"`
          });
          continue;
        }
      }

      // A longer synonym appears verbatim inside the raw name (e.g.
      // "TAK (Thyreoglobulin Ak)" contains "Thyreoglobulin Ak").
      if (
        entry.normalized.length >= 6 &&
        norm !== entry.normalized &&
        norm.includes(entry.normalized)
      ) {
        candidates.push({
          analyte: entry.analyte,
          score: 0.6,
          strategy: "contains",
          explanation: `Name appears within "${entry.analyte.key}"`
        });
        continue;
      }

      if (tokenSet.size > 1 && tokenSet.has(entry.normalized)) {
        candidates.push({
          analyte: entry.analyte,
          score: 0.82,
          strategy: "token",
          explanation: `Token match for "${entry.analyte.key}"`
        });
        continue;
      }

      const sim = similarity(normOcr, entryOcr);
      if (sim >= 0.88 && normOcr.length >= 6 && entryOcr.length >= 6) {
        candidates.push({
          analyte: entry.analyte,
          score: 0.6 * sim,
          strategy: "fuzzy",
          explanation: `Fuzzy match (${sim.toFixed(2)}) for "${entry.analyte.key}"`
        });
        continue;
      }

      if (tokenPrefixMatch(norm, entry.normalized)) {
        candidates.push({
          analyte: entry.analyte,
          score: 0.7,
          strategy: "token-prefix",
          explanation: `Abbreviated token match for "${entry.analyte.key}"`
        });
      }
    }

    if (candidates.length === 0) return null;

    let best = candidates[0]!;
    for (const candidate of candidates) {
      if (candidate.score > best.score) best = candidate;
    }

    const strategies = [best.strategy];
    let bestScore = best.score;

    if (value.rawUnit && this.units) {
      const unitMatch = await this.units.normalize(value.rawUnit);
      if (unitMatch) {
        const compatible = best.analyte.units.some(
          (u) => u.unitId === unitMatch.unitId
        );
        if (compatible) {
          bestScore = Math.min(1, bestScore + 0.05);
          strategies.push("unit-compatible");
        } else {
          bestScore = Math.max(0, bestScore - 0.05);
          strategies.push("unit-mismatch");
        }
      }
    }

    if (bestScore < 0.5) return null;

    return {
      analyteKey: best.analyte.key,
      analyteId: best.analyte.id,
      displayName: best.analyte.displayName,
      score: bestScore,
      confidence: scoreToConfidence(bestScore),
      strategies,
      explanation: best.explanation
    };
  }
}
