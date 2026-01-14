import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

import App from "./App.jsx";

const buildResponse = (data, ok = true) => ({
  ok,
  status: ok ? 200 : 400,
  json: async () => data
});

const createFetchMock = ({ rangeMin, rangeMax }) =>
  vi.fn((input, init) => {
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
              },
              backfillPast: {
                month: true,
                fourWeek: false,
                week: false
              }
            },
            refresh: {
              calendarSyncMinutes: 10,
              weatherSyncMinutes: 30,
              clientMinutes: 10
            },
            weather: {
              units: "imperial",
              location: { value: "Test" }
            }
          }
        })
      );
    }
    if (url?.includes("/api/events/extend")) {
      return Promise.resolve(buildResponse({ updated: true, syncDays: 30 }));
    }
    if (url?.includes("/api/events")) {
      return Promise.resolve(
        buildResponse({
          updatedAt: new Date().toISOString(),
          range: {
            timeMin: rangeMin,
            timeMax: rangeMax
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
    return Promise.resolve(buildResponse({}));
  });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("App backfill", () => {
  it("requests a backfill when the view starts before cached timeMin", async () => {
    vi.useFakeTimers();
    const baseTime = new Date(2025, 0, 15, 10, 0, 0);
    vi.setSystemTime(baseTime);

    const rangeMin = baseTime.toISOString();
    const rangeMax = new Date(baseTime.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const fetchMock = createFetchMock({ rangeMin, rangeMax });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const expectedMin = new Date(2025, 0, 1, 0, 0, 0).toISOString();

    await act(async () => {
      await Promise.resolve();
    });

    const call = fetchMock.mock.calls.find(([input]) =>
      String(input).includes("/api/events/extend")
    );
    expect(call).toBeTruthy();
    const body = JSON.parse(call[1].body);
    expect(body).toEqual({ timeMin: expectedMin });
  });
});
