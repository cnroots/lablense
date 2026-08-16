import { Hono } from "hono";
import type { LabLensBackend } from "@lablens/data";

export function healthRoutes(_backend: LabLensBackend): Hono {
  const app = new Hono();
  app.get("/health", (c) => c.json({ status: "ok" }));
  return app;
}
