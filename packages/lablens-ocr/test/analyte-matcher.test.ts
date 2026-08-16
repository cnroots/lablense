import { describe, expect, it } from "vitest";
import { AnalyteMatcher, MockOcrEngine, LabValueExtractor, NumberParser } from "@lablens/ocr";
import type { Analyte } from "@lablens/core";
import { normalizeTerm } from "@lablens/core";

const tsh: Analyte = {
  id: "a_tsh",
  key: "tsh",
  displayName: "TSH",
  names: [
    { name: "TSH", normalized: normalizeTerm("TSH"), type: "abbreviation" },
    { name: "Thyreotropin", normalized: normalizeTerm("Thyreotropin"), type: "canonical" },
    { name: "Thyrotropin", normalized: normalizeTerm("Thyrotropin"), type: "synonym" }
  ],
  loinc: [],
  units: [{ unitId: "u_mul" }]
};

const ferritin: Analyte = {
  id: "a_ferritin",
  key: "ferritin",
  displayName: "Ferritin",
  names: [
    { name: "Ferritin", normalized: normalizeTerm("Ferritin"), type: "canonical" }
  ],
  loinc: [],
  units: [{ unitId: "u_ugl" }]
};

const lister = {
  list: () => Promise.resolve([tsh, ferritin])
};

const matcher = new AnalyteMatcher(lister);

describe("AnalyteMatcher", () => {
  it("matches exact key", async () => {
    const match = await matcher.match({ rawName: "TSH", rawValue: "2", confidence: 1 });
    expect(match?.analyteKey).toBe("tsh");
    expect(match?.confidence).toBe("high");
  });

  it("matches canonical name", async () => {
    const match = await matcher.match({ rawName: "Thyreotropin", rawValue: "2", confidence: 1 });
    expect(match?.analyteKey).toBe("tsh");
  });

  it("matches synonym", async () => {
    const match = await matcher.match({ rawName: "Thyrotropin", rawValue: "2", confidence: 1 });
    expect(match?.analyteKey).toBe("tsh");
  });

  it("matches OCR-distorted T5H via fuzzy folding", async () => {
    const match = await matcher.match({ rawName: "T5H", rawValue: "2,31", rawUnit: "mU/l", confidence: 1 });
    expect(match?.analyteKey).toBe("tsh");
  });

  it("handles a trailing colon", async () => {
    const match = await matcher.match({ rawName: "TSH:", rawValue: "2", confidence: 1 });
    expect(match?.analyteKey).toBe("tsh");
  });

  it("handles parenthesized forms", async () => {
    const match = await matcher.match({ rawName: "Thyreotropin (TSH)", rawValue: "2", confidence: 1 });
    expect(match?.analyteKey).toBe("tsh");
  });

  it("returns null for unknown names", async () => {
    const match = await matcher.match({ rawName: "ZZZQ", rawValue: "2", confidence: 1 });
    expect(match).toBeNull();
  });
});

describe("LabValueExtractor", () => {
  const extractor = new LabValueExtractor(new NumberParser());

  it("extracts lab values from OCR text", () => {
    const engine = new MockOcrEngine();
    return engine
      .recognize({
        kind: "text",
        text: "Thyreotropin 2,31 mU/l 0,2–4,0\nFerritin 83 ng/ml"
      })
      .then((result) => {
        const values = extractor.extract(result);
        expect(values).toHaveLength(2);
        expect(values[0]?.rawName).toBe("Thyreotropin");
        expect(values[0]?.value).toBeCloseTo(2.31);
        expect(values[0]?.rawUnit).toBe("mU/l");
        expect(values[0]?.rawReference).toContain("0,2");
        expect(values[1]?.rawName).toBe("Ferritin");
      });
  });
});
