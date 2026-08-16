import { describe, expect, it } from "vitest";
import { ImportServiceImpl, ObservationServiceImpl } from "@lablens/core";
import type {
  AnalyteMatcher,
  UnitMatcher,
  ValueParser
} from "@lablens/core";
import {
  InMemoryAnalyteRepository,
  InMemoryObservationRepository,
  InMemoryUnitRepository,
  InMemoryUserRepository,
  fakeClock,
  fakeIds,
  immediateTransaction
} from "./fakes";

const valueParser: ValueParser = {
  parse(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return { ok: false, error: "empty" };
    const n = Number.parseFloat(trimmed.replace(",", "."));
    if (!Number.isNaN(n)) return { ok: true, value: n };
    return { ok: true, valueText: trimmed };
  }
};

const analyteMatcher: AnalyteMatcher = {
  async match(value) {
    const name = value.rawName.toLowerCase();
    if (name.includes("thyreotropin") || name.includes("tsh")) {
      return { analyteKey: "tsh", score: 0.95, confidence: "high", strategies: ["exact"] };
    }
    if (name.includes("ferritin")) {
      return { analyteKey: "ferritin", score: 0.99, confidence: "high", strategies: ["exact"] };
    }
    if (name.includes("t5h")) {
      return { analyteKey: "tsh", score: 0.65, confidence: "low", strategies: ["fuzzy"] };
    }
    return null;
  }
};

const unitMatcher: UnitMatcher = {
  async match(rawUnit) {
    if (rawUnit.toLowerCase() === "mu/l") {
      return { unitId: "u_mul", ucumCode: "mU/L", score: 0.98, confidence: "high", strategies: ["alias"] };
    }
    if (rawUnit.toLowerCase() === "ng/ml") {
      return { unitId: "u_ugl", ucumCode: "µg/L", score: 0.98, confidence: "high", strategies: ["alias"] };
    }
    return null;
  }
};

function buildImportService() {
  const users = new InMemoryUserRepository();
  users.users.push({ id: "u1", name: "local-user", createdAt: "2026-01-01T00:00:00.000Z" });
  const observationService = new ObservationServiceImpl({
    repository: new InMemoryObservationRepository(),
    analytes: new InMemoryAnalyteRepository(),
    units: new InMemoryUnitRepository(),
    users,
    clock: fakeClock,
    ids: fakeIds,
    transactions: immediateTransaction
  });
  const importService = new ImportServiceImpl({
    observationService,
    analyteMatcher,
    unitMatcher,
    valueParser,
    analytes: new InMemoryAnalyteRepository(),
    units: new InMemoryUnitRepository(),
    clock: fakeClock
  });
  return importService;
}

describe("ImportServiceImpl.preview", () => {
  it("produces a matched candidate for a clean value", async () => {
    const service = buildImportService();
    const candidates = await service.preview([
      { rawName: "Thyreotropin", rawValue: "2,31", rawUnit: "mU/l", confidence: 0.99 }
    ]);
    expect(candidates[0]?.status).toBe("matched");
    expect(candidates[0]?.analyte?.analyteKey).toBe("tsh");
    expect(candidates[0]?.parsedValue).toBeCloseTo(2.31);
    expect(candidates[0]?.unit?.ucumCode).toBe("mU/L");
  });

  it("marks a low-confidence match as needs_review", async () => {
    const service = buildImportService();
    const candidates = await service.preview([
      { rawName: "T5H", rawValue: "2,30", rawUnit: "mU/l", confidence: 0.99 }
    ]);
    expect(candidates[0]?.status).toBe("needs_review");
    expect(candidates[0]?.analyte?.analyteKey).toBe("tsh");
  });

  it("marks an unknown name as unmatched", async () => {
    const service = buildImportService();
    const candidates = await service.preview([
      { rawName: "SomethingUnknown", rawValue: "12", confidence: 0.9 }
    ]);
    expect(candidates[0]?.status).toBe("unmatched");
  });

  it("marks an empty value as invalid", async () => {
    const service = buildImportService();
    const candidates = await service.preview([
      { rawName: "TSH", rawValue: "  ", confidence: 0.9 }
    ]);
    expect(candidates[0]?.status).toBe("invalid");
  });

  it("keeps component confidence in the breakdown", async () => {
    const service = buildImportService();
    const candidates = await service.preview([
      { rawName: "Thyreotropin", rawValue: "2,31", rawUnit: "mU/l", confidence: 0.99 }
    ]);
    const c = candidates[0]!;
    expect(c.confidence.analyte?.key).toBe("tsh");
    expect(c.confidence.unit?.ucum).toBe("mU/L");
    expect(c.confidence.value?.numeric).toBeCloseTo(2.31);
    expect(c.confidence.overallConfidence).toBeGreaterThan(0);
  });
});

describe("ImportServiceImpl.commit", () => {
  it("commits confirmed values and detects duplicates", async () => {
    const service = buildImportService();
    const first = await service.commit(
      "u1",
      [
        {
          analyteId: "a_tsh",
          valueNumeric: 2.31,
          unitId: "u_mul",
          measuredAt: "2026-08-15T00:00:00.000Z",
          rawName: "Thyreotropin",
          rawValue: "2,31",
          rawUnit: "mU/l",
          confidence: 0.98
        }
      ],
      { sourceType: "ocr" }
    );
    expect(first.inserted).toHaveLength(1);
    expect(first.duplicates).toHaveLength(0);
    expect(first.errors).toHaveLength(0);

    const second = await service.commit(
      "u1",
      [
        {
          analyteId: "a_tsh",
          valueNumeric: 2.31,
          unitId: "u_mul",
          measuredAt: "2026-08-15T00:00:00.000Z"
        }
      ],
      { sourceType: "ocr" }
    );
    expect(second.inserted).toHaveLength(0);
    expect(second.duplicates).toHaveLength(1);
  });

  it("reports errors for unknown analytes", async () => {
    const service = buildImportService();
    const result = await service.commit("u1", [
      {
        analyteId: "a_missing",
        valueNumeric: 1,
        measuredAt: "2026-08-15T00:00:00.000Z"
      }
    ]);
    expect(result.inserted).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe("ANALYTE_NOT_FOUND");
  });
});
