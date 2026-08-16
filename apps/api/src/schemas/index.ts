import { z } from "zod";
import {
  comparatorSchema,
  idSchema,
  patientContextSchema,
  timestampSchema
} from "@lablens/core";

export const createUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  ageYears: z.number().finite().nonnegative().optional(),
  sex: z.enum(["male", "female", "other"]).optional()
});

export const createObservationSchema = z
  .object({
    analyteId: idSchema.optional(),
    analyte: z.string().min(1).optional(),
    valueNumeric: z.number().finite().optional(),
    valueText: z.string().min(1).optional(),
    comparator: comparatorSchema.optional(),
    unitId: idSchema.optional(),
    measuredAt: timestampSchema,
    provenance: z
      .object({
        sourceType: z.enum(["manual", "ocr", "import"]).optional(),
        originalName: z.string().optional(),
        originalValue: z.string().optional(),
        originalUnit: z.string().optional(),
        confidence: z.number().min(0).max(1).optional()
      })
      .optional()
  })
  .refine((o) => o.analyteId !== undefined || o.analyte !== undefined, {
    message: "Either analyteId or analyte (key) is required"
  })
  .refine(
    (o) => o.valueNumeric !== undefined || o.valueText !== undefined,
    { message: "Either valueNumeric or valueText is required" }
  )
  .refine((o) => o.comparator === undefined || o.valueNumeric !== undefined, {
    message: "comparator requires a numeric valueNumeric"
  });

export const updateObservationSchema = z
  .object({
    valueNumeric: z.number().finite().optional(),
    valueText: z.string().min(1).optional(),
    comparator: comparatorSchema.optional(),
    unitId: idSchema.optional(),
    measuredAt: timestampSchema.optional()
  })
  .refine(
    (o) =>
      o.valueNumeric !== undefined ||
      o.valueText !== undefined ||
      o.comparator !== undefined ||
      o.unitId !== undefined ||
      o.measuredAt !== undefined,
    { message: "At least one field is required" }
  );

export const observationQuerySchema = z.object({
  analyte: z.string().min(1).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  sort: z.enum(["asc", "desc"]).optional()
});

export const previewImportSchema = z.object({
  values: z
    .array(
      z.object({
        rawName: z.string().min(1),
        rawValue: z.string().min(1),
        rawUnit: z.string().optional()
      })
    )
    .min(1)
    .max(500)
});

export const commitImportSchema = z.object({
  values: z
    .array(
      z
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
    )
    .min(1)
    .max(500)
});

export const interpretQuerySchema = patientContextSchema.optional().default({});
