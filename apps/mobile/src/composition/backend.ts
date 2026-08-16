import type {
  AnalyteService,
  Clock,
  ExtractedLabValue,
  IdGenerator,
  ImportService,
  InterpretationService,
  ObservationService,
  ReferenceRangeResolver,
  UnitService,
  UserService,
  ValueParser
} from "@lablens/core";
import { UnitServiceImpl } from "@lablens/core";
import type {
  DatabaseHandle,
  LabLensBackend
} from "@lablens/data";
import {
  SqliteAnalyteRepository,
  SqliteUnitRepository,
  createLabLensBackend
} from "@lablens/data";
import type {
  OcrEngine,
  OcrInput
} from "@lablens/ocr/portable";
import {
  AnalyteMatcher,
  LabReportExtractor,
  NumberParser,
  UnitMatcher
} from "@lablens/ocr/portable";
import type { OcrProgress } from "../ocr/paddle-mobile-engine";

export interface OcrFacade {
  engine: OcrEngine;
  recognize(
    input: OcrInput,
    onProgress?: (progress: OcrProgress) => void
  ): Promise<ExtractedLabValue[]>;
}

export interface MobileBackend extends LabLensBackend {
  ocr: OcrFacade;
}

export interface ComposeMobileOptions {
  handle: DatabaseHandle;
  ocrEngine: OcrEngine;
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Composes the shared `@lablens/data` services (which are driver-agnostic)
 * with an on-device OCR engine. The `handle` is created by
 * `createExpoDatabase` from `@lablens/data/expo`.
 */
export function createMobileBackend(
  options: ComposeMobileOptions
): MobileBackend {
  const analyteRepository = new SqliteAnalyteRepository(options.handle.db);
  const unitRepository = new SqliteUnitRepository(options.handle.db);
  const unitService = new UnitServiceImpl(unitRepository);
  const valueParser: ValueParser = new NumberParser();

  const backend = createLabLensBackend({
    handle: options.handle,
    analyteMatcher: new AnalyteMatcher(analyteRepository, unitService),
    unitMatcher: new UnitMatcher(unitService),
    valueParser,
    clock: options.clock,
    ids: options.ids
  });

  const extractor = new LabReportExtractor(valueParser);

  return {
    ...backend,
    ocr: {
      engine: options.ocrEngine,
      async recognize(
        input: OcrInput,
        onProgress?: (progress: OcrProgress) => void
      ): Promise<ExtractedLabValue[]> {
        const engine = options.ocrEngine as OcrEngine & {
          recognize(
            input: OcrInput,
            onProgress?: (progress: OcrProgress) => void
          ): ReturnType<OcrEngine["recognize"]>;
        };
        const result = await engine.recognize(input, onProgress);
        return extractor.extract(result);
      }
    }
  };
}

export type {
  AnalyteService,
  ImportService,
  InterpretationService,
  ObservationService,
  ReferenceRangeResolver,
  UnitService,
  UserService
};
