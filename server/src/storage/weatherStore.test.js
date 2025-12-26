import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let tempDir;
let weatherStore;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wall-calendar-weatherstore-"));
  process.env.DATA_DIR = tempDir;
  weatherStore = await import("./weatherStore.js");
});

afterAll(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe("weatherStore", () => {
  it("returns empty cache by default", async () => {
    const cache = await weatherStore.loadWeatherCache();
    expect(cache.updatedAt).toBe(null);
    expect(cache.data).toBe(null);
  });

  it("persists weather cache", async () => {
    const payload = { updatedAt: "2025-01-01T00:00:00.000Z", data: { temp: 55 } };
    await weatherStore.saveWeatherCache(payload);
    const cache = await weatherStore.loadWeatherCache();
    expect(cache.updatedAt).toBe(payload.updatedAt);
    expect(cache.data.temp).toBe(55);
  });
});
