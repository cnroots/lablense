import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { buildBackend } from "../src/composition";
import type { LabLensBackend } from "@lablens/data";

let app: ReturnType<typeof createApp>;
let backend: LabLensBackend;

beforeAll(async () => {
  const built = await buildBackend({ dbPath: ":memory:" });
  backend = built.backend;
  app = createApp(backend);
});

describe("health", () => {
  it("returns ok", async () => {
    const res = await app.request("/api/v1/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("tests", () => {
  it("lists tests", async () => {
    const res = await app.request("/api/v1/tests");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ key: string }>;
    expect(body.length).toBeGreaterThan(30);
  });

  it("searches by synonym", async () => {
    const res = await app.request("/api/v1/tests/search?q=Thyreotropin");
    const body = (await res.json()) as Array<{ key: string }>;
    expect(body[0]?.key).toBe("tsh");
  });

  it("retrieves a single test", async () => {
    const res = await app.request("/api/v1/tests/tsh");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { key: string; displayName: string };
    expect(body.key).toBe("tsh");
    expect(body.displayName).toBe("TSH");
  });

  it("returns reference ranges for a test", async () => {
    const res = await app.request("/api/v1/tests/tsh/reference-ranges");
    const body = (await res.json()) as Array<{ type: string }>;
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  it("returns 404 for an unknown test", async () => {
    const res = await app.request("/api/v1/tests/does-not-exist");
    expect(res.status).toBe(404);
  });
});

describe("users", () => {
  it("creates and retrieves a user", async () => {
    const create = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "local-user", sex: "female" })
    });
    expect(create.status).toBe(201);
    const user = (await create.json()) as { id: string };
    expect(user.id).toBeTruthy();

    const get = await app.request(`/api/v1/users/${user.id}`);
    expect(get.status).toBe(200);
    const body = (await get.json()) as { name: string };
    expect(body.name).toBe("local-user");
  });
});

describe("observations", () => {
  let userId: string;

  beforeAll(async () => {
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "obs-user" })
    });
    userId = ((await res.json()) as { id: string }).id;
  });

  it("creates and lists an observation via analyte key", async () => {
    const tsh = (await (await app.request("/api/v1/tests/tsh")).json()) as {
      id: string;
    };
    const create = await app.request(`/api/v1/users/${userId}/observations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        analyte: "tsh",
        valueNumeric: 2.31,
        unitId: (tsh as { units: { unitId: string }[] }).units[0]?.unitId,
        measuredAt: "2026-08-15T00:00:00.000Z"
      })
    });
    expect(create.status).toBe(201);
    const observation = (await create.json()) as { id: string };
    expect(observation.id).toBeTruthy();

    const list = await app.request(`/api/v1/users/${userId}/observations`);
    const body = (await list.json()) as Array<{ valueNumeric: number }>;
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it("filters observations by analyte", async () => {
    const list = await app.request(
      `/api/v1/users/${userId}/observations?analyte=tsh`
    );
    const body = (await list.json()) as Array<{ valueNumeric: number }>;
    expect(body.length).toBeGreaterThanOrEqual(1);
  });
});

describe("import", () => {
  let userId: string;

  beforeAll(async () => {
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "import-user" })
    });
    userId = ((await res.json()) as { id: string }).id;
  });

  it("previews import candidates without a document", async () => {
    const res = await app.request(
      `/api/v1/users/${userId}/import/preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          values: [
            { rawName: "Thyreotropin", rawValue: "2,31", rawUnit: "mU/l" },
            { rawName: "Ferritin", rawValue: "83", rawUnit: "ng/ml" }
          ]
        })
      }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{
      status: string;
      analyte?: { analyteKey: string };
    }>;
    expect(body[0]?.analyte?.analyteKey).toBe("tsh");
  });

  it("commits confirmed values", async () => {
    const tsh = (await (await app.request("/api/v1/tests/tsh")).json()) as {
      id: string;
      units: { unitId: string }[];
    };
    const res = await app.request(`/api/v1/users/${userId}/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        values: [
          {
            analyteId: tsh.id,
            valueNumeric: 2.31,
            unitId: tsh.units[0]?.unitId,
            measuredAt: "2026-08-15T00:00:00.000Z",
            rawName: "Thyreotropin",
            rawValue: "2,31",
            rawUnit: "mU/l",
            confidence: 0.98
          }
        ]
      })
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { inserted: string[] };
    expect(body.inserted.length).toBe(1);
  });
});
