import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import App from "./App.jsx";

const buildResponse = (data, ok = true) => ({
  ok,
  status: ok ? 200 : 400,
  json: async () => data
});

const formatLongDate = (date) =>
  date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

const createFetchMock = () =>
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("App day reset", () => {
  it("resets to today after the day changes and idle threshold passes", async () => {
    vi.useFakeTimers();
    const baseTime = new Date(2025, 0, 1, 23, 58, 0);
    vi.setSystemTime(baseTime);
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const dayButtons = screen.getAllByRole("button", { name: "3" });
    const dayButton = dayButtons.find((button) =>
      button.classList.contains("display__day")
    );
    if (!dayButton) {
      throw new Error("Expected to find a day cell for selection.");
    }

    fireEvent.pointerDown(dayButton);
    fireEvent.click(dayButton);

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent(formatLongDate(new Date(2025, 0, 3)));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
    });

    expect(heading).toHaveTextContent(formatLongDate(new Date(2025, 0, 2)));
  });
});
