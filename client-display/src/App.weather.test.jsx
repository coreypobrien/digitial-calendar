import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

import App from "./App.jsx";

const buildResponse = (data, ok = true) => ({
  ok,
  status: ok ? 200 : 400,
  json: async () => data
});

const createFetchMock = (clientMinutes) =>
  vi.fn((input) => {
    const url = typeof input === "string" ? input : input?.url;
    if (url?.includes("/api/settings/public")) {
      return Promise.resolve(
        buildResponse({
          config: {
            display: {
              defaultView: "month",
              timeFormat: "12h",
              theme: {
                background: "#f8f3ea",
                accent: "#2b6f6b",
                text: "#1f1f1f"
              }
            },
            refresh: {
              calendarSyncMinutes: 10,
              weatherSyncMinutes: 30,
              clientMinutes
            },
            weather: {
              units: "imperial",
              location: { value: "Test" }
            }
          }
        })
      );
    }
    if (url?.includes("/api/events")) {
      return Promise.resolve(
        buildResponse({
          updatedAt: new Date().toISOString(),
          range: {
            timeMin: new Date().toISOString(),
            timeMax: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          },
          events: []
        })
      );
    }
    if (url?.includes("/api/weather")) {
      return Promise.resolve(
        buildResponse({
          updatedAt: new Date().toISOString(),
          data: {
            units: "imperial",
            location: { name: "Test" },
            current: {
              temp: 70,
              description: "Sunny",
              icon: "",
              time: new Date().toISOString()
            },
            today: {
              min: 60,
              max: 75
            },
            forecast: []
          }
        })
      );
    }
    if (url?.includes("/api/time")) {
      return Promise.resolve(buildResponse({ now: new Date().toISOString() }));
    }
    if (url?.includes("/api/events/extend")) {
      return Promise.resolve(buildResponse({ updated: false, syncDays: 30 }));
    }
    return Promise.resolve(buildResponse({}));
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("App weather refresh", () => {
  it("uses the configured weather refresh interval", async () => {
    const clientMinutes = 42;
    const fetchMock = createFetchMock(clientMinutes);
    vi.stubGlobal("fetch", fetchMock);
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    render(<App />);

    await waitFor(() => {
      const hasInterval = setIntervalSpy.mock.calls.some(
        ([, interval]) => interval === clientMinutes * 60 * 1000
      );
      expect(hasInterval).toBe(true);
    });
  });
});
