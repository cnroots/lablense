import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LabReportExtractor, NumberParser, toIsoDate } from "@lablens/ocr";
import type { ExtractedLabValue } from "@lablens/core";

const fixtureDir = fileURLToPath(new URL("./fixtures", import.meta.url));
const extractor = new LabReportExtractor(new NumberParser());

function extract(name: string): ExtractedLabValue[] {
  const f = JSON.parse(readFileSync(`${fixtureDir}/${name}.json`, "utf8")) as {
    text: string;
    confidence: number;
    lines: { text: string; confidence: number; box: { x: number; y: number; width: number; height: number } }[][];
  };
  return extractor.extract({
    text: f.text,
    confidence: f.confidence,
    cells: f.lines.map((l) =>
      l.map((c) => ({ text: c.text, confidence: c.confidence, box: c.box }))
    )
  });
}

function byDate(values: ExtractedLabValue[], namePattern: RegExp): Map<string, number> {
  const map = new Map<string, number>();
  for (const v of values) {
    if (namePattern.test(v.rawName) && v.measuredAt && v.value !== undefined) {
      map.set(v.measuredAt, v.value);
    }
  }
  return map;
}

describe("toIsoDate", () => {
  it("converts German dates to ISO", () => {
    expect(toIsoDate("05.03.2025")).toBe("2025-03-05");
    expect(toIsoDate("18.02.2026")).toBe("2026-02-18");
    expect(toIsoDate("6.3.25")).toBe("2025-03-06");
    expect(toIsoDate("not a date")).toBeNull();
  });
});

describe("multi-date report extraction", () => {
  it("extracts every value of a time-series analyte with its date (sample010)", () => {
    const values = extract("sample010");
    const ferritin = byDate(values, /^Ferritin$/);
    expect(ferritin.size).toBe(2);
    expect(ferritin.get("2026-03-06")).toBe(176);
    expect(ferritin.get("2026-02-18")).toBe(121);

    const tsh = byDate(values, /^TSH$/);
    expect(tsh.get("2026-03-06")).toBeCloseTo(1.94);
    expect(tsh.get("2026-02-18")).toBeCloseTo(0.26);
  });

  it("associates single-date and multi-date columns correctly (sample013)", () => {
    const values = extract("sample013");
    const tsh = byDate(values, /Schilddrüse TSH$/);
    expect(tsh.get("2025-03-05")).toBeCloseTo(0.56);
    expect(tsh.get("2025-01-03")).toBeCloseTo(2.24);

    const freiesT3 = byDate(values, /freies T3/);
    expect(freiesT3.get("2025-01-03")).toBeCloseTo(2.98);
  });

  it("assigns each column of a two-date ALBIS report to its own date (sample002)", () => {
    const values = extract("sample002");
    const ferritin = byDate(values, /^Ferritin$/);
    expect(ferritin.get("2026-08-07")).toBe(96);

    const natrium = byDate(values, /^Natrium$/);
    expect(natrium.get("2026-08-06")).toBe(141);
  });
});
