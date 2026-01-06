import { describe, expect, it } from "vitest";

import { defaultConfig } from "./defaultConfig.js";
import { ConfigSchema } from "./schema.js";

describe("ConfigSchema", () => {
  it("accepts the default configuration", () => {
    expect(ConfigSchema.parse(defaultConfig)).toEqual(defaultConfig);
  });

  it("rejects invalid time formats", () => {
    const badConfig = {
      ...defaultConfig,
      display: {
        ...defaultConfig.display,
        timeFormat: "25h"
      }
    };

    const result = ConfigSchema.safeParse(badConfig);
    expect(result.success).toBe(false);
  });

  it("rejects unsupported weather providers", () => {
    const badConfig = {
      ...defaultConfig,
      weather: {
        ...defaultConfig.weather,
        provider: "accuweather"
      }
    };

    const result = ConfigSchema.safeParse(badConfig);
    expect(result.success).toBe(false);
  });

  it("accepts weather.gov provider", () => {
    const config = {
      ...defaultConfig,
      weather: {
        ...defaultConfig.weather,
        provider: "weathergov"
      }
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("rejects invalid sync day values", () => {
    const badConfig = {
      ...defaultConfig,
      google: {
        ...defaultConfig.google,
        syncDays: 0
      }
    };

    const result = ConfigSchema.safeParse(badConfig);
    expect(result.success).toBe(false);
  });

  it("rejects invalid iCal feed URLs", () => {
    const badConfig = {
      ...defaultConfig,
      ical: {
        feeds: [
          {
            url: "not-a-url",
            label: "Bad",
            enabled: true
          }
        ]
      }
    };

    const result = ConfigSchema.safeParse(badConfig);
    expect(result.success).toBe(false);
  });
});
