import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let tempDir;
let configStore;
let defaultConfig;
let configPath;
let dataDir;

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wall-calendar-configstore-"));
  process.env.DATA_DIR = tempDir;
  configStore = await import("./configStore.js");
  ({ defaultConfig } = await import("../config/defaultConfig.js"));
  ({ dataDir } = await import("../paths.js"));
  configPath = path.join(dataDir, "config.json");
});

afterAll(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe("configStore", () => {
  it("creates default config when missing", async () => {
    const { config, errors } = await configStore.ensureConfig();
    expect(errors).toEqual([]);
    expect(config.display.defaultView).toBe(defaultConfig.display.defaultView);

    const persisted = JSON.parse(await fs.readFile(configPath, "utf-8"));
    expect(persisted.version).toBe(defaultConfig.version);
  });

  it("loads invalid config with errors and falls back", async () => {
    await fs.writeFile(configPath, JSON.stringify({ version: 1 }, null, 2));
    const { config, errors } = await configStore.loadConfig();
    expect(errors.length).toBeGreaterThan(0);
    expect(config.display).toEqual(defaultConfig.display);
  });

  it("migrates legacy reset fields into resetMinutes", async () => {
    await fs.writeFile(
      configPath,
      JSON.stringify(
        {
          ...defaultConfig,
          display: {
            ...defaultConfig.display,
            dailyResetMinutes: 12,
            monthResetMinutes: 3
          }
        },
        null,
        2
      )
    );
    const { config } = await configStore.loadConfig();
    expect(config.display.resetMinutes).toBe(12);
    expect("dailyResetMinutes" in config.display).toBe(false);
    expect("monthResetMinutes" in config.display).toBe(false);
  });

  it("saves valid config updates", async () => {
    const { config } = await configStore.ensureConfig();
    const nextConfig = {
      ...config,
      display: {
        ...config.display,
        defaultView: "activity"
      }
    };

    const saved = await configStore.saveConfig(nextConfig);
    expect(saved.display.defaultView).toBe("activity");
  });

  it("rejects invalid config updates", async () => {
    await expect(configStore.saveConfig({ version: 1 })).rejects.toThrow();
  });
});
