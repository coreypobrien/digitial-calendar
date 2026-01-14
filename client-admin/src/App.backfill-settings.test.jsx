import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import App from "./App.jsx";

const buildResponse = (data, ok = true) => ({
  ok,
  status: ok ? 200 : 400,
  json: async () => data
});

const createFetchMock = () => {
  let lastSavedConfig = null;
  return {
    fetchMock: vi.fn((input, init = {}) => {
      const url = typeof input === "string" ? input : input?.url;
      if (url?.includes("/api/auth/status")) {
        return Promise.resolve(buildResponse({ configured: true }));
      }
      if (url?.includes("/api/auth/me")) {
        return Promise.resolve(buildResponse({ user: { username: "admin" } }));
      }
      if (url?.includes("/api/settings") && init.method === "PUT") {
        lastSavedConfig = JSON.parse(init.body);
        return Promise.resolve(buildResponse({ config: lastSavedConfig }));
      }
      if (url?.includes("/api/settings")) {
        return Promise.resolve(
          buildResponse({
            config: {
              version: 2,
              admin: { username: "admin", passwordHash: "" },
              display: {
                defaultView: "month",
                timeFormat: "12h",
                theme: {
                  background: "#f8f3ea",
                  accent: "#2b6f6b",
                  text: "#1f1f1f"
                },
                mergeCalendars: true,
                backfillPast: {
                  month: true,
                  fourWeek: true,
                  week: true
                },
                backfillPastDebounceSeconds: 60
              },
              refresh: {
                calendarSyncMinutes: 10,
                weatherSyncMinutes: 60,
                clientMinutes: 10
              },
              calendars: [],
              ical: { feeds: [] },
              google: { syncDays: 30 },
              weather: {
                provider: "weathergov",
                units: "imperial",
                showIcons: true,
                location: {
                  type: "coords",
                  value: "New York,US",
                  lat: 40.7128,
                  lon: -74.006
                }
              }
            }
          })
        );
      }
      if (url?.includes("/api/google/status")) {
        return Promise.resolve(buildResponse({ connected: false }));
      }
      if (url?.includes("/api/events")) {
        return Promise.resolve(
          buildResponse({ updatedAt: new Date().toISOString(), range: null, events: [] })
        );
      }
      if (url?.includes("/api/chores")) {
        return Promise.resolve(buildResponse({ users: [] }));
      }
      return Promise.resolve(buildResponse({}));
    }),
    getLastSavedConfig: () => lastSavedConfig
  };
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  cleanup();
});

const getSaveButton = () => {
  const buttons = screen.getAllByRole("button", { name: "Save Changes" });
  return buttons.find((button) => !button.disabled) || buttons[0];
};

describe("Admin backfill settings", () => {
  it("saves backfill toggles and debounce value", async () => {
    const { fetchMock, getLastSavedConfig } = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const monthToggle = await screen.findByLabelText("Month view");
    const weekToggle = screen.getByLabelText("Week view");
    const debounceInput = screen.getByLabelText("Backfill debounce (seconds)");

    fireEvent.click(monthToggle);
    fireEvent.click(weekToggle);
    fireEvent.change(debounceInput, { target: { value: "120" } });

    fireEvent.click(getSaveButton());

    await waitFor(() => {
      const saved = getLastSavedConfig();
      expect(saved).not.toBeNull();
      expect(saved.display.backfillPast).toEqual({
        month: false,
        fourWeek: true,
        week: false
      });
      expect(saved.display.backfillPastDebounceSeconds).toBe(120);
    });
  });

  it("saves the 4-week toggle change", async () => {
    const { fetchMock, getLastSavedConfig } = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const fourWeekToggle = await screen.findByLabelText("4-week view");
    fireEvent.click(fourWeekToggle);

    fireEvent.click(getSaveButton());

    await waitFor(() => {
      const saved = getLastSavedConfig();
      expect(saved).not.toBeNull();
      expect(saved.display.backfillPast.fourWeek).toBe(false);
    });
  });

  it("saves debounce values at the configured bounds", async () => {
    const { fetchMock, getLastSavedConfig } = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const debounceInput = await screen.findByLabelText("Backfill debounce (seconds)");

    fireEvent.change(debounceInput, { target: { value: "5" } });
    fireEvent.click(getSaveButton());

    await waitFor(() => {
      const saved = getLastSavedConfig();
      expect(saved).not.toBeNull();
      expect(saved.display.backfillPastDebounceSeconds).toBe(5);
    });

    fireEvent.change(debounceInput, { target: { value: "3600" } });
    fireEvent.click(getSaveButton());

    await waitFor(() => {
      const saved = getLastSavedConfig();
      expect(saved).not.toBeNull();
      expect(saved.display.backfillPastDebounceSeconds).toBe(3600);
    });
  });
});
