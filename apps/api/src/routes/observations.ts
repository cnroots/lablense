import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { LabLensBackend } from "@lablens/data";
import type { NewObservation } from "@lablens/core";
import { toObservationDto } from "../dto";
import { errorBody, statusForError } from "../errors";
import {
  createObservationSchema,
  observationQuerySchema,
  updateObservationSchema
} from "../schemas";

export function observationRoutes(backend: LabLensBackend): Hono {
  const app = new Hono();

  app.get(
    "/users/:userId/observations",
    zValidator("query", observationQuerySchema),
    async (c) => {
      const userId = c.req.param("userId");
      const query = c.req.valid("query");
      try {
        let analyteId: string | undefined;
        if (query.analyte) {
          const analyte = await backend.analytes.findByKey(query.analyte);
          if (!analyte) {
            return c.json(
              { error: { code: "ANALYTE_NOT_FOUND", message: "Analyte not found" } },
              404
            );
          }
          analyteId = analyte.id;
        }
        const observations = await backend.observations.list(userId, {
          analyteId,
          from: query.from,
          to: query.to,
          limit: query.limit,
          offset: query.offset,
          sort: query.sort
        });
        return c.json(observations.map(toObservationDto));
      } catch (error) {
        return c.json(errorBody(error), statusForError(error));
      }
    }
  );

  app.post(
    "/users/:userId/observations",
    zValidator("json", createObservationSchema),
    async (c) => {
      const userId = c.req.param("userId");
      const body = c.req.valid("json");
      try {
        const analyteId = await resolveAnalyteId(backend, body);
        if (!analyteId) {
          return c.json(
            { error: { code: "ANALYTE_NOT_FOUND", message: "Analyte not found" } },
            404
          );
        }
        const input: NewObservation = {
          analyteId,
          valueNumeric: body.valueNumeric,
          valueText: body.valueText,
          comparator: body.comparator,
          unitId: body.unitId,
          measuredAt: body.measuredAt,
          provenance: body.provenance
            ? { ...body.provenance, sourceType: body.provenance.sourceType ?? "manual", createdAt: new Date().toISOString() }
            : undefined
        };
        const observation = await backend.observations.create(userId, input);
        return c.json(toObservationDto(observation), 201);
      } catch (error) {
        return c.json(errorBody(error), statusForError(error));
      }
    }
  );

  app.post(
    "/users/:userId/observations/bulk",
    zValidator("json", z.object({ observations: z.array(createObservationSchema) })),
    async (c) => {
      const userId = c.req.param("userId");
      const body = c.req.valid("json");
      try {
        const inputs: NewObservation[] = [];
        for (const item of body.observations) {
          const analyteId = await resolveAnalyteId(backend, item);
          if (!analyteId) {
            return c.json(
              { error: { code: "ANALYTE_NOT_FOUND", message: "Analyte not found" } },
              404
            );
          }
          inputs.push({
            analyteId,
            valueNumeric: item.valueNumeric,
            valueText: item.valueText,
            comparator: item.comparator,
            unitId: item.unitId,
            measuredAt: item.measuredAt,
            provenance: item.provenance
              ? { ...item.provenance, sourceType: item.provenance.sourceType ?? "manual", createdAt: new Date().toISOString() }
              : undefined
          });
        }
        const observations = await backend.observations.createMany(userId, inputs);
        return c.json(observations.map(toObservationDto), 201);
      } catch (error) {
        return c.json(errorBody(error), statusForError(error));
      }
    }
  );

  app.get("/users/:userId/observations/:id", async (c) => {
    const userId = c.req.param("userId");
    const id = c.req.param("id");
    try {
      const observation = await backend.observations.get(userId, id);
      return c.json(toObservationDto(observation));
    } catch (error) {
      return c.json(errorBody(error), statusForError(error));
    }
  });

  app.patch(
    "/users/:userId/observations/:id",
    zValidator("json", updateObservationSchema),
    async (c) => {
      const userId = c.req.param("userId");
      const id = c.req.param("id");
      const update = c.req.valid("json");
      try {
        const observation = await backend.observations.update(userId, id, update);
        return c.json(toObservationDto(observation));
      } catch (error) {
        return c.json(errorBody(error), statusForError(error));
      }
    }
  );

  app.delete("/users/:userId/observations/:id", async (c) => {
    const userId = c.req.param("userId");
    const id = c.req.param("id");
    try {
      await backend.observations.delete(userId, id);
      return c.body(null, 204);
    } catch (error) {
      return c.json(errorBody(error), statusForError(error));
    }
  });

  return app;
}

async function resolveAnalyteId(
  backend: LabLensBackend,
  body: { analyteId?: string; analyte?: string }
): Promise<string | undefined> {
  if (body.analyteId) {
    const analyte = await backend.analytes.findById(body.analyteId);
    return analyte?.id;
  }
  if (body.analyte) {
    const analyte = await backend.analytes.findByKey(body.analyte);
    return analyte?.id;
  }
  return undefined;
}
