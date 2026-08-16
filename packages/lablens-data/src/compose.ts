import type {
  AnalyteMatcher,
  AnalyteRepository,
  Clock,
  IdGenerator,
  UnitMatcher,
  UnitRepository,
  ValueParser,
  ReferenceRangeRepository,
  ObservationRepository,
  UserRepository,
  TransactionRunner,
  AnalyteService,
  UnitService,
  UserService,
  ObservationService,
  ReferenceRangeResolver,
  InterpretationService,
  ImportService
} from "@lablens/core";
import {
  AnalyteServiceImpl,
  InterpretationServiceImpl,
  ObservationServiceImpl,
  ReferenceRangeResolverImpl,
  UnitServiceImpl,
  UserServiceImpl,
  ImportServiceImpl,
  portableIdGenerator,
  systemClock
} from "@lablens/core";
import type { DatabaseClient, DatabaseHandle } from "./db/client";
import { SqliteAnalyteRepository } from "./repositories/sqlite-analyte-repository";
import { SqliteUnitRepository } from "./repositories/sqlite-unit-repository";
import { SqliteReferenceRangeRepository } from "./repositories/sqlite-reference-range-repository";
import { SqliteObservationRepository } from "./repositories/sqlite-observation-repository";
import { SqliteUserRepository } from "./repositories/sqlite-user-repository";

export interface Repositories {
  analytes: AnalyteRepository;
  units: UnitRepository;
  referenceRanges: ReferenceRangeRepository;
  observations: ObservationRepository;
  users: UserRepository;
}

export interface ComposeOptions {
  handle: DatabaseHandle;
  clock?: Clock;
  ids?: IdGenerator;
  analyteMatcher?: AnalyteMatcher;
  unitMatcher?: UnitMatcher;
  valueParser?: ValueParser;
}

export interface LabLensBackend {
  connection: unknown;
  db: DatabaseClient;
  transactions: TransactionRunner;
  repositories: Repositories;
  analytes: AnalyteService;
  units: UnitService;
  users: UserService;
  observations: ObservationService;
  referenceRanges: ReferenceRangeResolver;
  interpretation: InterpretationService;
  import: ImportService;
}

export function createLabLensBackend(options: ComposeOptions): LabLensBackend {
  const clock = options.clock ?? systemClock;
  const ids = options.ids ?? portableIdGenerator;
  const transactions = options.handle.transactions;

  const analyteRepository = new SqliteAnalyteRepository(options.handle.db);
  const unitRepository = new SqliteUnitRepository(options.handle.db);
  const referenceRangeRepository = new SqliteReferenceRangeRepository(
    options.handle.db
  );
  const observationRepository = new SqliteObservationRepository(
    options.handle.db
  );
  const userRepository = new SqliteUserRepository(options.handle.db);

  const analyteService = new AnalyteServiceImpl(analyteRepository);
  const unitService = new UnitServiceImpl(unitRepository);
  const referenceRangeResolver = new ReferenceRangeResolverImpl(
    referenceRangeRepository
  );
  const interpretationService = new InterpretationServiceImpl(
    referenceRangeResolver,
    unitService,
    unitRepository
  );
  const observationService = new ObservationServiceImpl({
    repository: observationRepository,
    analytes: analyteRepository,
    units: unitRepository,
    users: userRepository,
    clock,
    ids,
    transactions
  });
  const userService = new UserServiceImpl(userRepository, clock, ids);

  if (!options.analyteMatcher || !options.unitMatcher || !options.valueParser) {
    throw new Error(
      "analyteMatcher, unitMatcher and valueParser are required to compose the import service"
    );
  }

  const importService = new ImportServiceImpl({
    observationService,
    analyteMatcher: options.analyteMatcher,
    unitMatcher: options.unitMatcher,
    valueParser: options.valueParser,
    analytes: analyteRepository,
    units: unitRepository,
    clock
  });

  return {
    connection: options.handle.connection,
    db: options.handle.db,
    transactions,
    repositories: {
      analytes: analyteRepository,
      units: unitRepository,
      referenceRanges: referenceRangeRepository,
      observations: observationRepository,
      users: userRepository
    },
    analytes: analyteService,
    units: unitService,
    users: userService,
    observations: observationService,
    referenceRanges: referenceRangeResolver,
    interpretation: interpretationService,
    import: importService
  };
}
