import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { LabLensBackend } from "@lablens/data";
import { toUserDto } from "../dto";
import { errorBody, statusForError } from "../errors";
import { createUserSchema } from "../schemas";

export function userRoutes(backend: LabLensBackend): Hono {
  const app = new Hono();

  app.post("/users", zValidator("json", createUserSchema), async (c) => {
    try {
      const input = c.req.valid("json");
      const user = await backend.users.create(input);
      return c.json(toUserDto(user), 201);
    } catch (error) {
      return c.json(errorBody(error), statusForError(error));
    }
  });

  app.get("/users/:userId", async (c) => {
    try {
      const user = await backend.users.get(c.req.param("userId"));
      return c.json(toUserDto(user));
    } catch (error) {
      return c.json(errorBody(error), statusForError(error));
    }
  });

  return app;
}
