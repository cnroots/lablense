import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { LabLensBackend } from "@lablens/data";
import type { ExtractedLabValue } from "@lablens/core";
import { toImportCandidateDto } from "../dto";
import { errorBody, statusForError } from "../errors";
import { commitImportSchema, previewImportSchema } from "../schemas";

export function importRoutes(backend: LabLensBackend): Hono {
  const app = new Hono();

  app.post(
    "/users/:userId/import/preview",
    zValidator("json", previewImportSchema),
    async (c) => {
      const body = c.req.valid("json");
      const values: ExtractedLabValue[] = body.values.map((v) => ({
        rawName: v.rawName,
        rawValue: v.rawValue,
        rawUnit: v.rawUnit,
        confidence: 1
      }));
      try {
        const candidates = await backend.import.preview(values);
        return c.json(candidates.map(toImportCandidateDto));
      } catch (error) {
        return c.json(errorBody(error), statusForError(error));
      }
    }
  );

  app.post(
    "/users/:userId/import",
    zValidator("json", commitImportSchema),
    async (c) => {
      const userId = c.req.param("userId");
      const body = c.req.valid("json");
      try {
        const result = await backend.import.commit(userId, body.values, {
          sourceType: "ocr"
        });
        return c.json(result);
      } catch (error) {
        return c.json(errorBody(error), statusForError(error));
      }
    }
  );

  return app;
}
