import type {
  DuplicateCheck,
  Observation,
  ObservationInsert,
  ObservationQuery,
  ObservationUpdate
} from "../domain/observation";

export interface ObservationRepository {
  findById(userId: string, observationId: string): Promise<Observation | null>;

  list(userId: string, query: ObservationQuery): Promise<Observation[]>;

  latest(userId: string, analyteId: string): Promise<Observation | null>;

  insert(observation: ObservationInsert): Promise<Observation>;

  insertMany(observations: ObservationInsert[]): Promise<Observation[]>;

  update(
    userId: string,
    observationId: string,
    update: ObservationUpdate
  ): Promise<Observation>;

  delete(userId: string, observationId: string): Promise<void>;

  findPotentialDuplicates(
    userId: string,
    checks: DuplicateCheck[]
  ): Promise<Observation[]>;
}
