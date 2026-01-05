import { describe, expect, it, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import choresRouter from "./chores.js";
import * as choreStore from "../storage/choreStore.js";
import { requireAuth } from "../middleware/auth.js";

vi.mock("../storage/choreStore.js");
vi.mock("../middleware/auth.js");

const app = express();
app.use(express.json());
app.use("/api/chores", choresRouter);

describe("chores routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Mock auth middleware to pass by default
    requireAuth.mockImplementation((req, res, next) => next());
  });

  it("GET /api/chores returns chores", async () => {
    const mockData = { users: [] };
    choreStore.loadChores.mockResolvedValue(mockData);

    const res = await request(app).get("/api/chores");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockData);
  });

  it("POST /api/chores/:u/:c/toggle toggles status", async () => {
    const updated = { users: [{ id: "u1", chores: [{ id: "c1", done: true }] }] };
    choreStore.toggleChore.mockResolvedValue(updated);

    const res = await request(app).post("/api/chores/u1/c1/toggle");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(updated);
    expect(choreStore.toggleChore).toHaveBeenCalledWith("u1", "c1");
  });

  it("POST /api/chores/:u/:c/toggle handles 404", async () => {
    choreStore.toggleChore.mockRejectedValue(new Error("User not found"));

    const res = await request(app).post("/api/chores/bad/bad/toggle");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("User not found");
  });

  it("POST /api/chores/config saves data", async () => {
    const payload = { users: [] };
    choreStore.saveChores.mockResolvedValue(payload);

    const res = await request(app).post("/api/chores/config").send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(payload);
    expect(choreStore.saveChores).toHaveBeenCalledWith(payload);
  });

  it("POST /api/chores/config handles invalid data", async () => {
    const error = new Error("Invalid");
    error.issues = [{ message: "Required" }];
    choreStore.saveChores.mockRejectedValue(error);

    const res = await request(app).post("/api/chores/config").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid chore configuration");
  });

  it("GET /api/chores/history loads history", async () => {
    const history = [{ date: "2025-01-01" }];
    choreStore.loadHistory.mockResolvedValue(history);

    const res = await request(app).get("/api/chores/history");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ history });
  });
});
