import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import supertest from "supertest";

let tempDir;
let app;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wall-calendar-weather-"));
  process.env.DATA_DIR = tempDir;
  const { createApp } = await import("../app.js");
  app = createApp();
});

afterAll(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe("weather route", () => {
  it("returns cached payload when fresh", async () => {
    const cachePath = path.join(tempDir, "weather_cache.json");
    const payload = {
      updatedAt: new Date().toISOString(),
      data: {
        location: { name: "Cached" },
        current: { temp: 50 },
        today: { min: 40, max: 60 }
      }
    };
    await fs.writeFile(cachePath, JSON.stringify(payload));

    const res = await supertest(app).get("/api/weather");
    expect(res.status).toBe(200);
    expect(res.body.data.location.name).toBe("Cached");
  });

  it("returns stale cache when fetch fails", async () => {
    const cachePath = path.join(tempDir, "weather_cache.json");
    const payload = {
      updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      data: { location: { name: "Cached" } }
    };
    await fs.writeFile(cachePath, JSON.stringify(payload));

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    const res = await supertest(app).get("/api/weather");
    expect(res.status).toBe(200);
    expect(res.body.stale).toBe(true);

    global.fetch = originalFetch;
  });
});
