import { describe, expect, it } from "vitest";
import {
  ReferenceRangeResolverImpl,
  evaluateCondition
} from "@lablens/core";
import type {
  ReferenceCondition,
  ReferenceRange,
  ReferenceRangeRepository
} from "@lablens/core";

function range(
  id: string,
  analyteId: string,
  opts: {
    lower?: { value: number; operator: "<" | "<=" | ">" | ">=" };
    upper?: { value: number; operator: "<" | "<=" | ">" | ">=" };
    unitId?: string;
    conditions?: ReferenceCondition[];
  } = {}
): ReferenceRange {
  return {
    id,
    analyteId,
    type: "numeric",
    lower: opts.lower,
    upper: opts.upper,
    unitId: opts.unitId,
    conditions: opts.conditions ?? []
  };
}

function condition(
  id: string,
  field: string,
  operator: ReferenceCondition["operator"],
  value: string | number | boolean
): ReferenceCondition {
  return { id, field, operator, value };
}

class FakeRepo implements ReferenceRangeRepository {
  constructor(private readonly ranges: ReferenceRange[]) {}
  findByAnalyte(id: string): Promise<ReferenceRange[]> {
    return Promise.resolve(this.ranges.filter((r) => r.analyteId === id));
  }
  findById(id: string): Promise<ReferenceRange | null> {
    return Promise.resolve(this.ranges.find((r) => r.id === id) ?? null);
  }
}

describe("evaluateCondition", () => {
  it("evaluates eq/ne/gt/gte/lt/lte", () => {
    expect(evaluateCondition(condition("c", "sex", "eq", "female"), { sex: "female" })).toBe(true);
    expect(evaluateCondition(condition("c", "sex", "eq", "female"), { sex: "male" })).toBe(false);
    expect(evaluateCondition(condition("c", "sex", "ne", "female"), { sex: "male" })).toBe(true);
    expect(evaluateCondition(condition("c", "age", "gte", 18), { ageYears: 18 })).toBe(true);
    expect(evaluateCondition(condition("c", "age", "gt", 18), { ageYears: 18 })).toBe(false);
    expect(evaluateCondition(condition("c", "age", "lt", 50), { ageYears: 49 })).toBe(true);
    expect(evaluateCondition(condition("c", "age", "lte", 50), { ageYears: 50 })).toBe(true);
    expect(evaluateCondition(condition("c", "pregnant", "eq", true), { pregnant: true })).toBe(true);
  });

  it("returns false when the context field is absent", () => {
    expect(evaluateCondition(condition("c", "sex", "eq", "female"), {})).toBe(false);
    expect(evaluateCondition(condition("c", "pregnant", "eq", true), {})).toBe(false);
  });

  it("resolves custom conditions from the conditions record", () => {
    expect(
      evaluateCondition(condition("c", "specimen", "eq", "serum"), {
        conditions: { specimen: "serum" }
      })
    ).toBe(true);
  });
});

describe("ReferenceRangeResolverImpl", () => {
  it("resolves a single generic range", async () => {
    const repo = new FakeRepo([
      range("r1", "tsh", { lower: { value: 0.27, operator: ">=" }, upper: { value: 4.2, operator: "<=" } })
    ]);
    const resolver = new ReferenceRangeResolverImpl(repo);
    const result = await resolver.resolve("tsh", undefined, {});
    expect(result.status).toBe("resolved");
    expect(result.referenceRange?.id).toBe("r1");
  });

  it("prefers a more specific range", async () => {
    const repo = new FakeRepo([
      range("generic", "tsh", { lower: { value: 0.27, operator: ">=" }, upper: { value: 4.2, operator: "<=" } }),
      range("pregnant", "tsh", {
        lower: { value: 0.1, operator: ">=" },
        upper: { value: 2.5, operator: "<=" },
        conditions: [condition("c1", "pregnant", "eq", true)]
      })
    ]);
    const resolver = new ReferenceRangeResolverImpl(repo);
    const result = await resolver.resolve("tsh", undefined, { pregnant: true });
    expect(result.status).toBe("resolved");
    expect(result.referenceRange?.id).toBe("pregnant");
  });

  it("prefers sex-specific over unspecified", async () => {
    const repo = new FakeRepo([
      range("generic", "ck", { upper: { value: 200, operator: "<" } }),
      range("female", "ck", {
        upper: { value: 170, operator: "<" },
        conditions: [condition("c1", "sex", "eq", "female")]
      }),
      range("male", "ck", {
        upper: { value: 190, operator: "<" },
        conditions: [condition("c2", "sex", "eq", "male")]
      })
    ]);
    const resolver = new ReferenceRangeResolverImpl(repo);
    const female = await resolver.resolve("ck", undefined, { sex: "female" });
    expect(female.referenceRange?.id).toBe("female");
    const male = await resolver.resolve("ck", undefined, { sex: "male" });
    expect(male.referenceRange?.id).toBe("male");
  });

  it("ignores non-applicable ranges", async () => {
    const repo = new FakeRepo([
      range("female", "ck", {
        upper: { value: 170, operator: "<" },
        conditions: [condition("c1", "sex", "eq", "female")]
      })
    ]);
    const resolver = new ReferenceRangeResolverImpl(repo);
    const result = await resolver.resolve("ck", undefined, { sex: "male" });
    expect(result.status).toBe("none");
  });

  it("returns ambiguous when two equally specific ranges conflict", async () => {
    const repo = new FakeRepo([
      range("labA", "tsh", {
        lower: { value: 0.27, operator: ">=" },
        upper: { value: 4.2, operator: "<=" },
        conditions: [condition("c1", "laboratory", "eq", "labA")]
      }),
      range("labB", "tsh", {
        lower: { value: 0.4, operator: ">=" },
        upper: { value: 4.5, operator: "<=" },
        conditions: [condition("c2", "laboratory", "eq", "labB")]
      })
    ]);
    const resolver = new ReferenceRangeResolverImpl(repo);
    const result = await resolver.resolve("tsh", undefined, {
      conditions: { laboratory: "labB" }
    });
    expect(result.status).toBe("resolved");
    expect(result.referenceRange?.id).toBe("labB");

    const ambiguous = new FakeRepo([
      range("r1", "tsh", { lower: { value: 0.27, operator: ">=" }, upper: { value: 4.2, operator: "<=" } }),
      range("r2", "tsh", { lower: { value: 0.5, operator: ">=" }, upper: { value: 4.0, operator: "<=" } })
    ]);
    const resolver2 = new ReferenceRangeResolverImpl(ambiguous);
    const result2 = await resolver2.resolve("tsh", undefined, {});
    expect(result2.status).toBe("ambiguous");
    expect(result2.candidates?.length).toBe(2);
  });

  it("deduplicates identical intervals", async () => {
    const repo = new FakeRepo([
      range("r1", "tsh", { lower: { value: 0.27, operator: ">=" }, upper: { value: 4.2, operator: "<=" } }),
      range("r2", "tsh", { lower: { value: 0.27, operator: ">=" }, upper: { value: 4.2, operator: "<=" } })
    ]);
    const resolver = new ReferenceRangeResolverImpl(repo);
    const result = await resolver.resolve("tsh", undefined, {});
    expect(result.status).toBe("resolved");
  });
});
