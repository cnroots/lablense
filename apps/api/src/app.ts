import { Hono } from "hono";
import type { LabLensBackend } from "@lablens/data";
import { healthRoutes } from "./routes/health";
import { testRoutes } from "./routes/tests";
import { groupRoutes } from "./routes/groups";
import { userRoutes } from "./routes/users";
import { observationRoutes } from "./routes/observations";
import { importRoutes } from "./routes/import";

export function createApp(backend: LabLensBackend): Hono {
  const app = new Hono();

  const v1 = new Hono();
  v1.route("/", healthRoutes(backend));
  v1.route("/", testRoutes(backend));
  v1.route("/", groupRoutes(backend));
  v1.route("/", userRoutes(backend));
  v1.route("/", observationRoutes(backend));
  v1.route("/", importRoutes(backend));

  app.route("/api/v1", v1);

  return app;
}
