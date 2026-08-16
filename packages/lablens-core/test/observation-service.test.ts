import { describe, expect, it } from "vitest";
import { ObservationServiceImpl } from "@lablens/core";
import { AppError } from "@lablens/core";
import {
  InMemoryAnalyteRepository,
  InMemoryObservationRepository,
  InMemoryUnitRepository,
  InMemoryUserRepository,
  fakeClock,
  fakeIds,
  immediateTransaction,
  mUPerL
} from "./fakes";

function build() {
  const observations = new InMemoryObservationRepository();
  const users = new InMemoryUserRepository();
  users.users.push({
    id: "u1",
    name: "local-user",
    createdAt: "2026-01-01T00:00:00.000Z"
  });
  const service = new ObservationServiceImpl({
    repository: observations,
    analytes: new InMemoryAnalyteRepository(),
    units: new InMemoryUnitRepository(),
    users,
    clock: fakeClock,
    ids: fakeIds,
    transactions: immediateTransaction
  });
  return { service, observations, users };
}

describe("ObservationServiceImpl", () => {
  it("creates an observation", async () => {
    const { service } = build();
    const observation = await service.create("u1", {
      analyteId: "a_tsh",
      valueNumeric: 2.31,
      unitId: "u_mul",
      measuredAt: "2026-08-15T00:00:00.000Z"
    });
    expect(observation.id).toBeTruthy();
    expect(observation.valueNumeric).toBe(2.31);
  });

  it("rejects an unknown analyte", async () => {
    const { service } = build();
    await expect(
      service.create("u1", {
        analyteId: "a_missing",
        valueNumeric: 2.31,
        measuredAt: "2026-08-15T00:00:00.000Z"
      })
    ).rejects.toThrow(AppError);
  });

  it("rejects an unknown unit", async () => {
    const { service } = build();
    await expect(
      service.create("u1", {
        analyteId: "a_tsh",
        valueNumeric: 2.31,
        unitId: "u_missing",
        measuredAt: "2026-08-15T00:00:00.000Z"
      })
    ).rejects.toThrow(AppError);
  });

  it("rejects an observation without a value", async () => {
    const { service } = build();
    await expect(
      service.create("u1", {
        analyteId: "a_tsh",
        measuredAt: "2026-08-15T00:00:00.000Z"
      })
    ).rejects.toThrow(AppError);
  });

  it("rejects a comparator without a numeric value", async () => {
    const { service } = build();
    await expect(
      service.create("u1", {
        analyteId: "a_tsh",
        comparator: "<",
        valueText: "x",
        measuredAt: "2026-08-15T00:00:00.000Z"
      } as never)
    ).rejects.toThrow(AppError);
  });

  it("rejects an unknown user", async () => {
    const { service } = build();
    await expect(
      service.create("missing", {
        analyteId: "a_tsh",
        valueNumeric: 2.31,
        measuredAt: "2026-08-15T00:00:00.000Z"
      })
    ).rejects.toThrow(/not found/i);
  });

  it("inserts many observations", async () => {
    const { service } = build();
    const created = await service.createMany("u1", [
      {
        analyteId: "a_tsh",
        valueNumeric: 2.31,
        unitId: "u_mul",
        measuredAt: "2026-08-15T00:00:00.000Z"
      },
      {
        analyteId: "a_tsh",
        valueNumeric: 3.0,
        unitId: "u_mul",
        measuredAt: "2026-09-01T00:00:00.000Z"
      }
    ]);
    expect(created).toHaveLength(2);
  });

  it("detects duplicates", async () => {
    const { service } = build();
    await service.create("u1", {
      analyteId: "a_tsh",
      valueNumeric: 2.31,
      unitId: "u_mul",
      measuredAt: "2026-08-15T00:00:00.000Z"
    });
    const duplicates = await service.findDuplicates("u1", [
      {
        analyteId: "a_tsh",
        valueNumeric: 2.31,
        unitId: "u_mul",
        measuredAt: "2026-08-15T00:00:00.000Z"
      }
    ]);
    expect(duplicates).toHaveLength(1);
  });

  it("updates and deletes observations", async () => {
    const { service } = build();
    const created = await service.create("u1", {
      analyteId: "a_tsh",
      valueNumeric: 2.31,
      unitId: "u_mul",
      measuredAt: "2026-08-15T00:00:00.000Z"
    });
    const updated = await service.update("u1", created.id, {
      valueNumeric: 3.5
    });
    expect(updated.valueNumeric).toBe(3.5);
    await service.delete("u1", created.id);
    await expect(service.get("u1", created.id)).rejects.toThrow(AppError);
  });
});
