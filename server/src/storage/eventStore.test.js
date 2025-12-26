import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let tempDir;
let eventStore;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wall-calendar-eventstore-"));
  process.env.DATA_DIR = tempDir;
  eventStore = await import("./eventStore.js");
});

afterAll(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe("eventStore", () => {
  it("returns empty cache by default", async () => {
    const cache = await eventStore.loadEventCache();
    expect(cache.events).toEqual([]);
    expect(cache.updatedAt).toBe(null);
  });

  it("persists cached events", async () => {
    const payload = {
      updatedAt: "2025-01-01T00:00:00.000Z",
      range: { timeMin: "2025-01-01", timeMax: "2025-01-02" },
      events: [{ id: "1", summary: "Test" }]
    };

    await eventStore.saveEventCache(payload);
    const cache = await eventStore.loadEventCache();
    expect(cache.events).toHaveLength(1);
    expect(cache.updatedAt).toBe(payload.updatedAt);
  });
});
