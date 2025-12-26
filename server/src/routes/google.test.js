import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";

let tempDir;
let app;
let agent;
let jsonStore;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wall-calendar-google-"));
  process.env.DATA_DIR = tempDir;
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";

  const { createApp } = await import("../app.js");
  app = createApp();
  agent = supertest.agent(app);
  jsonStore = await import("../storage/jsonStore.js");

  await agent.post("/api/auth/setup").send({
    username: "admin",
    password: "secret"
  });
});

afterAll(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
});

describe("google routes", () => {
  it("reports configured status when credentials exist", async () => {
    const res = await supertest(app).get("/api/google/status");
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(true);
    expect(res.body.connected).toBe(false);
  });

  it("reports missing credentials", async () => {
    const prevId = process.env.GOOGLE_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const res = await supertest(app).get("/api/google/status");
    expect(res.body.configured).toBe(false);

    process.env.GOOGLE_CLIENT_ID = prevId;
    process.env.GOOGLE_CLIENT_SECRET = prevSecret;
  });

  it("returns auth url when configured", async () => {
    const res = await supertest(app).get("/api/google/auth-url");
    expect(res.status).toBe(200);
    expect(res.body.url).toContain("client_id=test-client-id");
  });

  it("returns 400 when auth url requested without credentials", async () => {
    const prevId = process.env.GOOGLE_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const res = await supertest(app).get("/api/google/auth-url");
    expect(res.status).toBe(400);

    process.env.GOOGLE_CLIENT_ID = prevId;
    process.env.GOOGLE_CLIENT_SECRET = prevSecret;
  });

  it("requires a connection for calendars", async () => {
    const res = await agent.get("/api/google/calendars");
    expect(res.status).toBe(409);
  });

  it("requires a connection for sync", async () => {
    const res = await agent.post("/api/google/sync");
    expect(res.status).toBe(409);
  });

  it("disconnect removes stored tokens", async () => {
    const tokenPath = jsonStore.resolveDataPath("google_tokens.json");
    await jsonStore.writeJsonAtomic(tokenPath, { access_token: "abc" });

    const res = await agent.post("/api/google/disconnect");
    expect(res.status).toBe(200);

    const exists = await jsonStore.fileExists(tokenPath);
    expect(exists).toBe(false);
  });
});
