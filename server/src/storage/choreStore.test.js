import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  loadChores,
  saveChores,
  toggleChore,
  appendHistory,
  resetDailyChores,
  loadHistory
} from "./choreStore.js";
import * as jsonStore from "./jsonStore.js";

vi.mock("./jsonStore.js", () => ({
  fileExists: vi.fn(),
  readJsonFile: vi.fn(),
  writeJsonAtomic: vi.fn(),
  resolveDataPath: vi.fn((path) => `/mock/${path}`)
}));

describe("choreStore", () => {
  const mockChores = {
    users: [
      {
        id: "u1",
        name: "Test User",
        color: "#000",
        chores: [{ id: "c1", label: "Task 1", done: false }]
      }
    ]
  };

  beforeEach(() => {
    vi.resetAllMocks();
    jsonStore.resolveDataPath.mockImplementation((path) => `/mock/${path}`);
    jsonStore.readJsonFile.mockResolvedValue({ users: [] });
    jsonStore.fileExists.mockResolvedValue(true);
  });

  it("loadChores returns default if file missing", async () => {
    jsonStore.fileExists.mockResolvedValue(false);
    const res = await loadChores();
    expect(res).toEqual({ users: [] });
  });

  it("loadChores parses valid data", async () => {
    jsonStore.readJsonFile.mockResolvedValue(mockChores);
    const res = await loadChores();
    expect(res).toEqual(mockChores);
  });

  it("toggleChore flips status", async () => {
    jsonStore.readJsonFile.mockResolvedValue(mockChores);
    await toggleChore("u1", "c1");
    expect(jsonStore.writeJsonAtomic).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        users: [
          expect.objectContaining({
            chores: [expect.objectContaining({ done: true })]
          })
        ]
      })
    );
  });

  it("toggleChore throws if user not found", async () => {
    jsonStore.readJsonFile.mockResolvedValue(mockChores);
    await expect(toggleChore("bad-user", "c1")).rejects.toThrow("User not found");
  });

  it("toggleChore throws if chore not found", async () => {
    jsonStore.readJsonFile.mockResolvedValue(mockChores);
    await expect(toggleChore("u1", "bad-chore")).rejects.toThrow("Chore not found");
  });

  it("loadChores handles corrupt data gracefully", async () => {
    jsonStore.readJsonFile.mockResolvedValue({ random: "junk" });
    const res = await loadChores();
    expect(res).toEqual({ users: [] });
  });

  it("saveChores writes valid data", async () => {
    const newData = { users: [{ id: "u2", name: "New", color: "#fff", chores: [] }] };
    await saveChores(newData);
    expect(jsonStore.writeJsonAtomic).toHaveBeenCalledWith(expect.any(String), newData);
  });

  it("saveChores throws on invalid schema", async () => {
    const badData = { users: [{ name: "Missing ID" }] };
    await expect(saveChores(badData)).rejects.toThrow();
  });

  it("resetDailyChores resets done status and returns summary", async () => {
    const doneChores = {
      users: [
        {
          id: "u1",
          name: "Test User",
          color: "#000",
          chores: [{ id: "c1", label: "Task 1", done: true }]
        }
      ]
    };
    jsonStore.readJsonFile.mockResolvedValue(doneChores);
    
    const summary = await resetDailyChores();
    
    expect(summary).toHaveLength(1);
    expect(summary[0]).toEqual({
      name: "Test User",
      completed: 1,
      total: 1,
      items: ["Task 1"]
    });
    
    expect(jsonStore.writeJsonAtomic).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        users: [
          expect.objectContaining({
            chores: [expect.objectContaining({ done: false })]
          })
        ]
      })
    );
  });

  it("appendHistory maintains sort order", async () => {
    const existing = [
      { date: "2025-01-01", users: [] }
    ];
    jsonStore.readJsonFile.mockResolvedValue(existing);
    
    await appendHistory("2025-01-02", []);
    
    expect(jsonStore.writeJsonAtomic).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ date: "2025-01-02" }),
        expect.objectContaining({ date: "2025-01-01" })
      ])
    );
  });
});
