import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";

let tempDir;
let app;
let agent;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wall-calendar-config-"));
  process.env.DATA_DIR = tempDir;
  const { createApp } = await import("../app.js");
  app = createApp();
  agent = supertest.agent(app);

  await agent.post("/api/auth/setup").send({
    username: "admin",
    password: "secret"
  });
});

afterAll(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe("config routes", () => {
  it("exposes a public settings endpoint without admin details", async () => {
    const res = await supertest(app).get("/api/settings/public");
    expect(res.status).toBe(200);
    expect(res.body.config).toBeDefined();
    expect(res.body.config.admin).toBeUndefined();
  });

  it("requires auth for full settings", async () => {
    const res = await supertest(app).get("/api/settings");
    expect(res.status).toBe(401);
  });

  it("returns full settings for authenticated admin", async () => {
    const res = await agent.get("/api/settings");
    expect(res.status).toBe(200);
    expect(res.body.config.admin.username).toBe("admin");
  });

  it("saves updated settings", async () => {
    const current = await agent.get("/api/settings");
    const nextConfig = {
      ...current.body.config,
      display: {
        ...current.body.config.display,
        defaultView: "day"
      },
      refresh: {
        ...current.body.config.refresh,
        calendarMinutes: 5
      }
    };

    const res = await agent.put("/api/settings").send(nextConfig);
    expect(res.status).toBe(200);
    expect(res.body.config.display.defaultView).toBe("day");
    expect(res.body.config.refresh.calendarMinutes).toBe(5);
  });

  it("rejects invalid settings payloads", async () => {
    const res = await agent.put("/api/settings").send({ version: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid configuration");
  });
});
