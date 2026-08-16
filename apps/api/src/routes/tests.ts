import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { LabLensBackend } from "@lablens/data";
import { toAnalyteDto, toReferenceRangeDto } from "../dto";
import { errorBody, statusForError } from "../errors";

const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export function testRoutes(backend: LabLensBackend): Hono {
  const app = new Hono();

  app.get("/tests", async (c) => {
    const analytes = await backend.analytes.list();
    return c.json(analytes.map(toAnalyteDto));
  });

  app.get("/tests/search", zValidator("query", searchQuerySchema), async (c) => {
    const { q, limit } = c.req.valid("query");
    const results = await backend.analytes.search(q, limit);
    return c.json(results.map(toAnalyteDto));
  });

  app.get("/tests/:key/reference-ranges", async (c) => {
    const key = c.req.param("key");
    try {
      const analyte = await backend.analytes.getByKey(key);
      const ranges = await backend.repositories.referenceRanges.findByAnalyte(
        analyte.id
      );
      return c.json(ranges.map(toReferenceRangeDto));
    } catch (error) {
      return c.json(errorBody(error), statusForError(error));
    }
  });

  app.get("/tests/:key", async (c) => {
    const key = c.req.param("key");
    try {
      const analyte = await backend.analytes.getByKey(key);
      return c.json(toAnalyteDto(analyte));
    } catch (error) {
      return c.json(errorBody(error), statusForError(error));
    }
  });

  return app;
}
