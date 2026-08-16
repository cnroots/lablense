import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { buildBackend } from "./composition";

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.LABLENS_DB ?? "./data/lablens.db";

const { backend } = await buildBackend({ dbPath });
const app = createApp(backend);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`LabLens API listening on http://localhost:${info.port}`);
});
