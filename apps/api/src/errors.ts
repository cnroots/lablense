import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppErrorCode } from "@lablens/core";
import { isAppError } from "@lablens/core";

const STATUS_BY_CODE: Partial<Record<AppErrorCode, number>> = {
  ANALYTE_NOT_FOUND: 404,
  UNIT_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  REFERENCE_RANGE_NOT_FOUND: 404,
  NO_REFERENCE_RANGE: 404,
  INVALID_VALUE: 400,
  INVALID_UNIT: 400,
  INVALID_IMPORT: 400,
  DUPLICATE_OBSERVATION: 409,
  AMBIGUOUS_REFERENCE_RANGE: 422,
  AMBIGUOUS_ANALYTE_MATCH: 422,
  CONVERSION_UNSUPPORTED: 422
};

export function statusForError(error: unknown): ContentfulStatusCode {
  if (isAppError(error)) {
    return (STATUS_BY_CODE[error.code] ?? 500) as ContentfulStatusCode;
  }
  return 500;
}

export function errorBody(error: unknown): {
  error: { code: string; message: string };
} {
  if (isAppError(error)) {
    return {
      error: { code: error.code, message: error.message }
    };
  }
  const message = error instanceof Error ? error.message : "Internal error";
  return { error: { code: "INTERNAL_ERROR", message } };
}
