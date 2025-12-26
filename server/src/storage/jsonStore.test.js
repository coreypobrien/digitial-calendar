import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let tempDir;
let store;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wall-calendar-"));
  process.env.DATA_DIR = tempDir;
  store = await import("./jsonStore.js");
});

afterAll(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe("jsonStore", () => {
  it("writes and reads JSON atomically", async () => {
    const filePath = store.resolveDataPath("test.json");
    await store.writeJsonAtomic(filePath, { hello: "world" });

    const data = await store.readJsonFile(filePath, null);
    expect(data).toEqual({ hello: "world" });
  });

  it("returns fallback when file is missing", async () => {
    const filePath = store.resolveDataPath("missing.json");
    const data = await store.readJsonFile(filePath, { ok: true });
    expect(data).toEqual({ ok: true });
  });

  it("detects file existence", async () => {
    const filePath = store.resolveDataPath("exists.json");
    await store.writeJsonAtomic(filePath, { ready: true });

    const exists = await store.fileExists(filePath);
    expect(exists).toBe(true);
  });

  it("throws on invalid JSON content", async () => {
    const filePath = store.resolveDataPath("broken.json");
    await fs.writeFile(filePath, "{not json}", "utf-8");
    await expect(store.readJsonFile(filePath, null)).rejects.toThrow();
  });
});
