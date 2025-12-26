import { describe, expect, it } from "vitest";
import supertest from "supertest";

import { createApp } from "../app.js";

describe("time route", () => {
  it("returns an ISO timestamp close to now", async () => {
    const app = createApp();
    const res = await supertest(app).get("/api/time");
    expect(res.status).toBe(200);
    const serverNow = new Date(res.body.now).getTime();
    expect(Number.isNaN(serverNow)).toBe(false);
    const delta = Math.abs(Date.now() - serverNow);
    expect(delta).toBeLessThan(10000);
  });
});
