import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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

const createWeatherFetchMock = (weatherData) =>
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
          data: weatherData
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

  it("renders wind arrow with gusts and degrees in the modal", async () => {
    const weatherData = {
      units: "imperial",
      location: { name: "Test" },
      current: {
        temp: 70,
        description: "Sunny",
        icon: "",
        time: new Date().toISOString(),
        windSpeed: "5 mph",
        windGust: "12 mph",
        windDirection: "SSW",
        windDirectionDegrees: 200,
        pressure: { value: 29.92, unit: "inHg" },
        windChill: 45,
        heatIndex: 85
      },
      today: {
        min: 60,
        max: 75
      },
      forecast: []
    };
    const fetchMock = createWeatherFetchMock(weatherData);
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const widget = await screen.findByRole("button", {
      name: /open weather details/i
    });
    expect(within(widget).getByText("5 mph gust 12 mph")).toBeInTheDocument();
    expect(within(widget).queryByText("SSW")).toBeNull();
    expect(within(widget).getByText(/Pressure 29\.92 inHg/)).toBeInTheDocument();
    expect(within(widget).getByText(/Wind chill 45°/)).toBeInTheDocument();
    expect(within(widget).getByText(/Heat index 85°/)).toBeInTheDocument();

    const arrow = widget.querySelector(".display__weather-wind-arrow");
    expect(arrow).not.toBeNull();
    expect(arrow.style.getPropertyValue("--wind-deg")).toBe("20deg");

    fireEvent.click(widget);

    const dialog = await screen.findByRole("dialog");
    const windMetric = within(dialog)
      .getByText("Wind")
      .closest(".display__weather-modal-metric");
    expect(windMetric).not.toBeNull();
    expect(windMetric).toHaveTextContent("SSW (200°) 5 mph gust 12 mph");
  });

  it("renders a Tonight label with a single temperature", async () => {
    const weatherData = {
      units: "imperial",
      location: { name: "Test" },
      current: {
        temp: 55,
        description: "Clear",
        icon: "",
        time: new Date().toISOString()
      },
      today: {
        min: 43,
        max: 55
      },
      forecast: [
        {
          date: "2025-01-01",
          label: "Tonight",
          min: 43,
          max: null,
          description: "Clear",
          icon: ""
        }
      ]
    };
    const fetchMock = createWeatherFetchMock(weatherData);
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const widget = await screen.findByRole("button", {
      name: /open weather details/i
    });
    expect(within(widget).getByText("Tonight")).toBeInTheDocument();
    expect(within(widget).getByText("43°")).toBeInTheDocument();

    fireEvent.click(widget);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Tonight")).toBeInTheDocument();
  });
});
