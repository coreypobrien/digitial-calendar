import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import supertest from "supertest";

let tempDir;
let app;

vi.mock("../services/calendarSync.js", () => ({
  syncCalendarEvents: vi.fn(async () => ({
    updatedAt: new Date().toISOString(),
    events: 0,
    calendars: 0
  }))
}));

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wall-calendar-events-"));
  process.env.DATA_DIR = tempDir;
  const { createApp } = await import("../app.js");
  app = createApp();
});

afterAll(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe("events route", () => {
  it("returns empty cache when no events have been synced", async () => {
    const res = await supertest(app).get("/api/events");
    expect(res.status).toBe(200);
    expect(res.body.events).toEqual([]);
    expect(res.body.updatedAt).toBe(null);
  });

  it("extends the sync window when requested", async () => {
    const target = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString();
    const res = await supertest(app).post("/api/events/extend").send({ timeMax: target });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(true);
    expect(res.body.syncDays).toBeGreaterThanOrEqual(40);

    const { loadConfig } = await import("../storage/configStore.js");
    const { config } = await loadConfig();
    expect(config.google.syncDays).toBe(res.body.syncDays);
  });

  it("returns a config error when no sources are configured", async () => {
    const { syncCalendarEvents } = await import("../services/calendarSync.js");
    syncCalendarEvents.mockImplementationOnce(async () => {
      const error = new Error("No calendar sources configured");
      error.code = "NO_SOURCES";
      throw error;
    });
    const target = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString();
    const res = await supertest(app).post("/api/events/extend").send({ timeMax: target });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("No calendar sources configured");
    expect(res.body.updated).toBe(true);
  });

  it("refreshes events by clearing cache and syncing", async () => {
    const { syncCalendarEvents } = await import("../services/calendarSync.js");
    syncCalendarEvents.mockClear();
    const res = await supertest(app).post("/api/events/refresh");
    expect(res.status).toBe(200);
    expect(syncCalendarEvents).toHaveBeenCalled();
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(res.body, "updatedAt")).toBe(true);
  });
});
