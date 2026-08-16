import { describe, expect, it } from "vitest";
import { NumberParser, parseNumber } from "@lablens/ocr";

const parser = new NumberParser();

describe("parseNumber", () => {
  it("parses German and English decimal separators", () => {
    expect(parseNumber("2,31")).toBeCloseTo(2.31);
    expect(parseNumber("2.31")).toBeCloseTo(2.31);
    expect(parseNumber("1,0")).toBeCloseTo(1.0);
    expect(parseNumber("0,069")).toBeCloseTo(0.069);
    expect(parseNumber("1.000")).toBeCloseTo(1.0);
  });

  it("parses combined thousands and decimal separators", () => {
    expect(parseNumber("1.234,56")).toBeCloseTo(1234.56);
    expect(parseNumber("1,234.56")).toBeCloseTo(1234.56);
  });

  it("rejects non-numeric input", () => {
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
  });
});

describe("NumberParser.parse", () => {
  it("parses plain values", () => {
    expect(parser.parse("2,31")).toMatchObject({ ok: true, value: 2.31 });
    expect(parser.parse("2.31")).toMatchObject({ ok: true, value: 2.31 });
  });

  it("parses comparators", () => {
    expect(parser.parse("<5")).toMatchObject({ ok: true, value: 5, comparator: "<" });
    expect(parser.parse("< 5")).toMatchObject({ ok: true, value: 5, comparator: "<" });
    expect(parser.parse("<=5")).toMatchObject({ ok: true, value: 5, comparator: "<=" });
    expect(parser.parse("≤5")).toMatchObject({ ok: true, value: 5, comparator: "<=" });
    expect(parser.parse(">10")).toMatchObject({ ok: true, value: 10, comparator: ">" });
    expect(parser.parse("≥10")).toMatchObject({ ok: true, value: 10, comparator: ">=" });
  });

  it("falls back to text for categorical values", () => {
    expect(parser.parse("not detected")).toMatchObject({
      ok: true,
      valueText: "not detected"
    });
  });

  it("rejects empty values", () => {
    expect(parser.parse("  ")).toMatchObject({ ok: false });
  });
});
