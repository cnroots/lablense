import { describe, expect, it } from "vitest";
import {
  interpretCategoricalStatus,
  interpretNumericStatus,
  convertUnitValue,
  UnitServiceImpl
} from "@lablens/core";
import type { ReferenceRange, UnitWithNames } from "@lablens/core";
import { AppError } from "@lablens/core";

function numericRange(
  lower?: { value: number; operator: "<" | "<=" | ">" | ">=" },
  upper?: { value: number; operator: "<" | "<=" | ">" | ">=" }
): ReferenceRange {
  return {
    id: "r",
    analyteId: "a",
    type: "numeric",
    lower,
    upper,
    conditions: []
  };
}

describe("interpretNumericStatus", () => {
  it("classifies exact values as low/normal/high", () => {
    const range = numericRange(
      { value: 0.27, operator: ">=" },
      { value: 4.2, operator: "<=" }
    );
    expect(interpretNumericStatus(2.31, undefined, range)).toBe("normal");
    expect(interpretNumericStatus(0.1, undefined, range)).toBe("low");
    expect(interpretNumericStatus(5.0, undefined, range)).toBe("high");
  });

  it("respects exclusive upper bound", () => {
    const range = numericRange(undefined, { value: 5, operator: "<" });
    expect(interpretNumericStatus(4.9, undefined, range)).toBe("normal");
    expect(interpretNumericStatus(5.0, undefined, range)).toBe("high");
  });

  it("handles lower-only ranges", () => {
    const range = numericRange({ value: 4, operator: ">" });
    expect(interpretNumericStatus(5, undefined, range)).toBe("normal");
    expect(interpretNumericStatus(4, undefined, range)).toBe("low");
    expect(interpretNumericStatus(3, undefined, range)).toBe("low");
  });

  it("preserves < comparator semantics", () => {
    const crp = numericRange(undefined, { value: 5, operator: "<" });
    expect(interpretNumericStatus(5, "<", crp)).toBe("normal");

    const tsh = numericRange(
      { value: 0.27, operator: ">=" },
      { value: 4.2, operator: "<=" }
    );
    expect(interpretNumericStatus(0.01, "<", tsh)).toBe("low");
  });

  it("preserves > comparator semantics", () => {
    const folsaeure = numericRange({ value: 4.0, operator: ">" });
    expect(interpretNumericStatus(4.5, ">", folsaeure)).toBe("normal");
    expect(interpretNumericStatus(3.9, ">", folsaeure)).toBe("unknown");
  });

  it("returns unknown for missing bound", () => {
    expect(interpretNumericStatus(undefined, undefined, numericRange())).toBe("unknown");
  });
});

describe("interpretCategoricalStatus", () => {
  const range: ReferenceRange = {
    id: "r",
    analyteId: "a",
    type: "categorical",
    categoricalValue: "not detected",
    conditions: []
  };
  it("matches the categorical value", () => {
    expect(interpretCategoricalStatus("not detected", range)).toBe("normal");
    expect(interpretCategoricalStatus("Not Detected", range)).toBe("normal");
    expect(interpretCategoricalStatus("detected", range)).toBe("high");
  });
  it("returns unknown for empty value", () => {
    expect(interpretCategoricalStatus("", range)).toBe("unknown");
    expect(interpretCategoricalStatus(undefined, range)).toBe("unknown");
  });
});

describe("convertUnitValue", () => {
  it("converts same-dimension units", () => {
    expect(convertUnitValue(1, "mg/dL", "g/L")).toBeCloseTo(0.01);
    expect(convertUnitValue(1, "µg/L", "ng/mL")).toBeCloseTo(1);
    expect(convertUnitValue(1, "mmol/L", "µmol/L")).toBeCloseTo(1000);
    expect(convertUnitValue(1, "mU/L", "U/L")).toBeCloseTo(0.001);
    expect(convertUnitValue(100, "mg/dL", "mg/L")).toBeCloseTo(1000);
  });

  it("returns the same value for identical units", () => {
    expect(convertUnitValue(5, "mg/dL", "mg/dL")).toBe(5);
  });

  it("throws for unsupported conversions", () => {
    expect(() => convertUnitValue(5, "mg/dL", "mmol/L")).toThrow(AppError);
  });
});

describe("UnitServiceImpl.normalize", () => {
  const repo = {
    listAll(): Promise<UnitWithNames[]> {
      return Promise.resolve([
        {
          unit: { id: "u1", ucumCode: "mg/dL", displayName: "mg/dL" },
          names: [
            { unitId: "u1", name: "mg/dl", normalized: "mgdl" },
            { unitId: "u1", name: "mg per dl", normalized: "mgdl" }
          ]
        },
        {
          unit: { id: "u2", ucumCode: "mmol/L", displayName: "mmol/L" },
          names: [{ unitId: "u2", name: "mmol/l", normalized: "mmoll" }]
        }
      ]);
    },
    findById() {
      return Promise.resolve(null);
    },
    findByCode() {
      return Promise.resolve(null);
    },
    list() {
      return Promise.resolve([]);
    }
  };

  it("normalizes aliases to the canonical unit", async () => {
    const service = new UnitServiceImpl(repo);
    const a = await service.normalize("mg/dl");
    expect(a?.ucumCode).toBe("mg/dL");
    const b = await service.normalize("mg per dl");
    expect(b?.ucumCode).toBe("mg/dL");
    const c = await service.normalize("mmol/l");
    expect(c?.ucumCode).toBe("mmol/L");
  });

  it("returns null for unknown units", async () => {
    const service = new UnitServiceImpl(repo);
    expect(await service.normalize("xyz")).toBeNull();
  });
});
