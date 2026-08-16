import { z } from "zod";

export const idSchema = z.string().min(1).max(200);

export const analyteKeySchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "Analyte key must be a slug");

export const comparatorSchema = z.enum(["<", "<=", "=", ">=", ">"]);

export function isValidIso(value: string): boolean {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export const timestampSchema = z
  .string()
  .min(1)
  .refine(isValidIso, "Invalid ISO timestamp");

export const sexSchema = z.enum(["male", "female", "other"]);

export const provenanceSchema = z.object({
  sourceType: z.enum(["manual", "ocr", "import"]),
  originalName: z.string().optional(),
  originalValue: z.string().optional(),
  originalUnit: z.string().optional(),
  extractionMethod: z.string().optional(),
  extractionEngine: z.string().optional(),
  extractionEngineVersion: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  createdAt: timestampSchema
});

export const newObservationSchema = z
  .object({
    userId: idSchema.optional(),
    analyteId: idSchema,
    valueNumeric: z.number().finite().optional(),
    valueText: z.string().min(1).optional(),
    comparator: comparatorSchema.optional(),
    unitId: idSchema.optional(),
    measuredAt: timestampSchema,
    provenance: provenanceSchema.optional()
  })
  .refine(
    (o) => o.valueNumeric !== undefined || o.valueText !== undefined,
    { message: "Either valueNumeric or valueText is required" }
  )
  .refine(
    (o) => o.comparator === undefined || o.valueNumeric !== undefined,
    { message: "comparator requires a numeric valueNumeric" }
  );

export const patientContextSchema = z.object({
  ageYears: z.number().finite().nonnegative().optional(),
  sex: sexSchema.optional(),
  pregnant: z.boolean().optional(),
  fasting: z.boolean().optional(),
  conditions: z
    .record(z.union([z.string(), z.number(), z.boolean()]))
    .optional()
});

export const newUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  ageYears: z.number().finite().nonnegative().optional(),
  sex: sexSchema.optional()
});

export const confirmedLabValueSchema = z
  .object({
    analyteId: idSchema,
    valueNumeric: z.number().finite().optional(),
    valueText: z.string().min(1).optional(),
    comparator: comparatorSchema.optional(),
    unitId: idSchema.optional(),
    measuredAt: timestampSchema,
    rawName: z.string().optional(),
    rawValue: z.string().optional(),
    rawUnit: z.string().optional(),
    confidence: z.number().min(0).max(1).optional()
  })
  .refine(
    (o) => o.valueNumeric !== undefined || o.valueText !== undefined,
    { message: "Either valueNumeric or valueText is required" }
  )
  .refine(
    (o) => o.comparator === undefined || o.valueNumeric !== undefined,
    { message: "comparator requires a numeric valueNumeric" }
  );