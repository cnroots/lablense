export type AppErrorCode =
  | "ANALYTE_NOT_FOUND"
  | "UNIT_NOT_FOUND"
  | "INVALID_VALUE"
  | "INVALID_UNIT"
  | "NO_REFERENCE_RANGE"
  | "AMBIGUOUS_REFERENCE_RANGE"
  | "AMBIGUOUS_ANALYTE_MATCH"
  | "INVALID_IMPORT"
  | "DUPLICATE_OBSERVATION"
  | "USER_NOT_FOUND"
  | "CONVERSION_UNSUPPORTED"
  | "REFERENCE_RANGE_NOT_FOUND";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: unknown;

  constructor(code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toAppError(
  code: AppErrorCode,
  fallbackMessage: string
): (error: unknown) => AppError {
  return (error: unknown) => {
    if (isAppError(error)) return error;
    if (error instanceof Error) {
      return new AppError(code, error.message, error);
    }
    return new AppError(code, fallbackMessage, error);
  };
}
