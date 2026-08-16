import type {
  DuplicateCheck,
  NewObservation,
  Observation,
  ObservationInsert,
  ObservationQuery,
  ObservationUpdate
} from "../domain/observation";
import type { ObservationRepository } from "../repositories/observation-repository";
import type { AnalyteRepository } from "../repositories/analyte-repository";
import type { UnitRepository } from "../repositories/unit-repository";
import type { UserRepository } from "../repositories/user-repository";
import type { Clock } from "../ports/clock";
import type { IdGenerator } from "../ports/id-generator";
import type { TransactionRunner } from "../ports/transaction";
import { AppError } from "../errors";
import { newObservationSchema } from "../validation";

export interface ObservationService {
  create(userId: string, input: NewObservation): Promise<Observation>;
  createMany(userId: string, inputs: NewObservation[]): Promise<Observation[]>;
  get(userId: string, id: string): Promise<Observation>;
  list(userId: string, query: ObservationQuery): Promise<Observation[]>;
  latest(userId: string, analyteId: string): Promise<Observation | null>;
  update(
    userId: string,
    id: string,
    update: ObservationUpdate
  ): Promise<Observation>;
  delete(userId: string, id: string): Promise<void>;
  findDuplicates(
    userId: string,
    checks: DuplicateCheck[]
  ): Promise<Observation[]>;
}

export class ObservationServiceImpl implements ObservationService {
  private readonly repository: ObservationRepository;
  private readonly analytes: AnalyteRepository;
  private readonly units: UnitRepository;
  private readonly users: UserRepository;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private readonly transactions: TransactionRunner;

  constructor(deps: {
    repository: ObservationRepository;
    analytes: AnalyteRepository;
    units: UnitRepository;
    users: UserRepository;
    clock: Clock;
    ids: IdGenerator;
    transactions: TransactionRunner;
  }) {
    this.repository = deps.repository;
    this.analytes = deps.analytes;
    this.units = deps.units;
    this.users = deps.users;
    this.clock = deps.clock;
    this.ids = deps.ids;
    this.transactions = deps.transactions;
  }

  private async assertUser(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new AppError("USER_NOT_FOUND", `User "${userId}" not found`);
    }
  }

  private async assertAnalyte(analyteId: string): Promise<void> {
    const analyte = await this.analytes.findById(analyteId);
    if (!analyte) {
      throw new AppError(
        "ANALYTE_NOT_FOUND",
        `Analyte "${analyteId}" not found`
      );
    }
  }

  private async assertUnit(unitId: string | undefined): Promise<void> {
    if (!unitId) return;
    const unit = await this.units.findById(unitId);
    if (!unit) {
      throw new AppError("UNIT_NOT_FOUND", `Unit "${unitId}" not found`);
    }
  }

  private buildObservation(
    userId: string,
    input: NewObservation
  ): ObservationInsert {
    const parsed = newObservationSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(
        "INVALID_VALUE",
        parsed.error.issues.map((i) => i.message).join("; "),
        parsed.error.issues
      );
    }
    const now = this.clock.nowISO();
    return {
      ...parsed.data,
      id: this.ids.generate(),
      userId,
      createdAt: now,
      updatedAt: now
    };
  }

  async create(userId: string, input: NewObservation): Promise<Observation> {
    await this.assertUser(userId);
    await this.assertAnalyte(input.analyteId);
    await this.assertUnit(input.unitId);
    const observation = this.buildObservation(userId, input);
    return this.repository.insert(observation);
  }

  async createMany(
    userId: string,
    inputs: NewObservation[]
  ): Promise<Observation[]> {
    await this.assertUser(userId);
    const built: ObservationInsert[] = [];
    for (const input of inputs) {
      await this.assertAnalyte(input.analyteId);
      await this.assertUnit(input.unitId);
      built.push(this.buildObservation(userId, input));
    }
    return this.transactions.run(() => this.repository.insertMany(built));
  }

  async get(userId: string, id: string): Promise<Observation> {
    const observation = await this.repository.findById(userId, id);
    if (!observation) {
      throw new AppError(
        "ANALYTE_NOT_FOUND",
        `Observation "${id}" not found`
      );
    }
    return observation;
  }

  list(userId: string, query: ObservationQuery): Promise<Observation[]> {
    return this.repository.list(userId, query);
  }

  latest(userId: string, analyteId: string): Promise<Observation | null> {
    return this.repository.latest(userId, analyteId);
  }

  async update(
    userId: string,
    id: string,
    update: ObservationUpdate
  ): Promise<Observation> {
    const existing = await this.repository.findById(userId, id);
    if (!existing) {
      throw new AppError("ANALYTE_NOT_FOUND", `Observation "${id}" not found`);
    }
    if (update.unitId) {
      await this.assertUnit(update.unitId);
    }
    if (
      update.valueNumeric === undefined &&
      update.valueText === undefined &&
      existing.valueNumeric === undefined &&
      existing.valueText === undefined
    ) {
      throw new AppError("INVALID_VALUE", "A value is required");
    }
    return this.repository.update(userId, id, update);
  }

  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.repository.findById(userId, id);
    if (!existing) {
      throw new AppError("ANALYTE_NOT_FOUND", `Observation "${id}" not found`);
    }
    await this.repository.delete(userId, id);
  }

  findDuplicates(
    userId: string,
    checks: DuplicateCheck[]
  ): Promise<Observation[]> {
    return this.repository.findPotentialDuplicates(userId, checks);
  }
}
