import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";

let tempDir;
let app;

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
});
