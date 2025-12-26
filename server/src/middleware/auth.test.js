import express from "express";
import session from "express-session";
import { describe, expect, it } from "vitest";
import supertest from "supertest";

import { requireAuth } from "./auth.js";

const createTestApp = () => {
  const app = express();
  app.use(
    session({
      name: "test_session",
      secret: "test-secret",
      resave: false,
      saveUninitialized: false
    })
  );

  app.post("/login", (req, res) => {
    req.session.user = { username: "admin" };
    res.json({ ok: true });
  });

  app.get("/private", requireAuth, (_req, res) => {
    res.json({ ok: true });
  });

  return app;
};

describe("requireAuth middleware", () => {
  it("blocks unauthenticated requests", async () => {
    const app = createTestApp();
    const res = await supertest(app).get("/private");
    expect(res.status).toBe(401);
  });

  it("allows authenticated requests", async () => {
    const app = createTestApp();
    const agent = supertest.agent(app);
    await agent.post("/login");

    const res = await agent.get("/private");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
