import { Hono } from "hono";
import type { LabLensBackend } from "@lablens/data";
import { toAnalyteDto } from "../dto";

export function groupRoutes(backend: LabLensBackend): Hono {
  const app = new Hono();

  app.get("/groups", async (c) => {
    const groups = await backend.analytes.listGroups();
    return c.json(groups);
  });

  app.get("/groups/:key", async (c) => {
    const key = c.req.param("key");
    const analytes = await backend.analytes.listByGroup(key);
    return c.json(analytes.map(toAnalyteDto));
  });

  return app;
}
