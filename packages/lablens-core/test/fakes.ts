import type {
  Analyte,
  AnalyteRepository,
  Clock,
  IdGenerator,
  NewObservation,
  Observation,
  ObservationInsert,
  ObservationQuery,
  ObservationRepository,
  ObservationUpdate,
  ReferenceRange,
  ReferenceRangeRepository,
  TransactionRunner,
  Unit,
  UnitRepository,
  UnitWithNames,
  User,
  UserInsert,
  UserRepository
} from "@lablens/core";

export const fakeClock: Clock = { nowISO: () => "2026-08-16T00:00:00.000Z" };
export const fakeIds: IdGenerator = (() => {
  let n = 0;
  return { generate: () => `id_${++n}` };
})();

export const immediateTransaction: TransactionRunner = {
  async run<T>(op: () => Promise<T>): Promise<T> {
    return op();
  }
};

export const tshAnalyte: Analyte = {
  id: "a_tsh",
  key: "tsh",
  displayName: "TSH",
  names: [
    { name: "TSH", normalized: "tsh", type: "abbreviation" },
    { name: "Thyreotropin", normalized: "thyreotropin", type: "canonical" }
  ],
  loinc: [],
  units: [{ unitId: "u_mul" }]
};

export const ferritinAnalyte: Analyte = {
  id: "a_ferritin",
  key: "ferritin",
  displayName: "Ferritin",
  names: [{ name: "Ferritin", normalized: "ferritin", type: "canonical" }],
  loinc: [],
  units: [{ unitId: "u_ugl" }]
};

export const mUPerL: Unit = { id: "u_mul", ucumCode: "mU/L", displayName: "mU/L" };
export const ugPerL: Unit = { id: "u_ugl", ucumCode: "µg/L", displayName: "µg/L" };

export class InMemoryAnalyteRepository implements AnalyteRepository {
  constructor(private analytes: Analyte[] = [tshAnalyte, ferritinAnalyte]) {}
  findById(id: string) {
    return Promise.resolve(this.analytes.find((a) => a.id === id) ?? null);
  }
  findByKey(key: string) {
    return Promise.resolve(this.analytes.find((a) => a.key === key) ?? null);
  }
  search() {
    return Promise.resolve([...this.analytes]);
  }
  list() {
    return Promise.resolve([...this.analytes]);
  }
  listByGroup() {
    return Promise.resolve([...this.analytes]);
  }
}

export class InMemoryUnitRepository implements UnitRepository {
  constructor(private units: Unit[] = [mUPerL, ugPerL]) {}
  findById(id: string) {
    return Promise.resolve(this.units.find((u) => u.id === id) ?? null);
  }
  findByCode(code: string) {
    return Promise.resolve(this.units.find((u) => u.ucumCode === code) ?? null);
  }
  list() {
    return Promise.resolve([...this.units]);
  }
  listAll(): Promise<UnitWithNames[]> {
    return Promise.resolve(
      this.units.map((u) => ({ unit: u, names: [] }))
    );
  }
}

export class InMemoryUserRepository implements UserRepository {
  users: User[] = [];
  findById(id: string) {
    return Promise.resolve(this.users.find((u) => u.id === id) ?? null);
  }
  insert(user: UserInsert) {
    const created: User = {
      id: user.id,
      name: user.name,
      ageYears: user.ageYears,
      sex: user.sex,
      createdAt: user.createdAt
    };
    this.users.push(created);
    return Promise.resolve(created);
  }
  update(id: string, patch: Partial<NewObservation>) {
    const user = this.users.find((u) => u.id === id)!;
    Object.assign(user, patch);
    return Promise.resolve(user);
  }
}

export class InMemoryObservationRepository implements ObservationRepository {
  observations: Observation[] = [];
  findById(userId: string, id: string) {
    return Promise.resolve(
      this.observations.find((o) => o.id === id && o.userId === userId) ?? null
    );
  }
  list(userId: string, query: ObservationQuery) {
    let rows = this.observations.filter((o) => o.userId === userId);
    if (query.analyteId) rows = rows.filter((o) => o.analyteId === query.analyteId);
    if (query.from) rows = rows.filter((o) => o.measuredAt >= query.from!);
    if (query.to) rows = rows.filter((o) => o.measuredAt <= query.to!);
    rows = [...rows].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
    if (query.sort === "desc") rows.reverse();
    return Promise.resolve(rows);
  }
  latest(userId: string, analyteId: string) {
    const rows = this.observations
      .filter((o) => o.userId === userId && o.analyteId === analyteId)
      .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
    return Promise.resolve(rows[0] ?? null);
  }
  insert(input: ObservationInsert) {
    const observation: Observation = { ...input, userId: input.userId };
    this.observations.push(observation);
    return Promise.resolve(observation);
  }
  insertMany(inputs: ObservationInsert[]) {
    const created = inputs.map((input) => {
      const observation: Observation = { ...input, userId: input.userId };
      this.observations.push(observation);
      return observation;
    });
    return Promise.resolve(created);
  }
  update(userId: string, id: string, patch: ObservationUpdate) {
    const observation = this.observations.find(
      (o) => o.id === id && o.userId === userId
    )!;
    Object.assign(observation, patch);
    observation.updatedAt = "2026-08-16T00:00:00.000Z";
    return Promise.resolve(observation);
  }
  delete(userId: string, id: string) {
    this.observations = this.observations.filter(
      (o) => !(o.id === id && o.userId === userId)
    );
    return Promise.resolve();
  }
  findPotentialDuplicates(userId: string, checks: Array<{
    analyteId: string;
    valueNumeric?: number;
    valueText?: string;
    unitId?: string;
    measuredAt: string;
  }>) {
    const results = this.observations.filter((o) =>
      checks.some(
        (c) =>
          o.userId === userId &&
          o.analyteId === c.analyteId &&
          o.measuredAt === c.measuredAt &&
          o.valueNumeric === c.valueNumeric &&
          o.unitId === c.unitId
      )
    );
    return Promise.resolve(results);
  }
}

export class InMemoryReferenceRangeRepository
  implements ReferenceRangeRepository
{
  constructor(private ranges: ReferenceRange[] = []) {}
  findByAnalyte(id: string) {
    return Promise.resolve(this.ranges.filter((r) => r.analyteId === id));
  }
  findById(id: string) {
    return Promise.resolve(this.ranges.find((r) => r.id === id) ?? null);
  }
}
