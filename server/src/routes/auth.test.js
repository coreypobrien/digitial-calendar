import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";

let tempDir;
let app;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wall-calendar-auth-"));
  process.env.DATA_DIR = tempDir;
  const { createApp } = await import("../app.js");
  app = createApp();
});

afterAll(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe("auth routes", () => {
  it("reports setup status", async () => {
    const status = await supertest(app).get("/api/auth/status");
    expect(status.body.configured).toBe(false);
  });

  it("rejects login before setup", async () => {
    const res = await supertest(app).post("/api/auth/login").send({
      username: "admin",
      password: "secret"
    });
    expect(res.status).toBe(409);
  });

  it("sets up admin credentials and logs in", async () => {
    const agent = supertest.agent(app);
    const setupRes = await agent.post("/api/auth/setup").send({
      username: "admin",
      password: "secret"
    });

    expect(setupRes.status).toBe(200);
    expect(setupRes.body.user.username).toBe("admin");

    const meRes = await agent.get("/api/auth/me");
    expect(meRes.body.user.username).toBe("admin");
  });

  it("reports configured status after setup", async () => {
    const status = await supertest(app).get("/api/auth/status");
    expect(status.body.configured).toBe(true);
  });

  it("prevents setup if already configured", async () => {
    const res = await supertest(app)
      .post("/api/auth/setup")
      .send({ username: "admin", password: "again" });

    expect(res.status).toBe(409);
  });

  it("authenticates login and logout", async () => {
    const agent = supertest.agent(app);

    const badLogin = await agent.post("/api/auth/login").send({
      username: "admin",
      password: "wrong"
    });
    expect(badLogin.status).toBe(401);

    const goodLogin = await agent.post("/api/auth/login").send({
      username: "admin",
      password: "secret"
    });
    expect(goodLogin.status).toBe(200);

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);

    const meRes = await agent.get("/api/auth/me");
    expect(meRes.body.user).toBe(null);
  });
});
