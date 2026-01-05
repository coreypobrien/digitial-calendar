import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import App from "./App.jsx";

const buildResponse = (data, ok = true) => ({
  ok,
  status: ok ? 200 : 400,
  json: async () => data
});

const createFetchMock = (eventPayload) =>
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
              },
              resetMinutes: 0
            },
            refresh: {
              calendarMinutes: 10,
              weatherMinutes: 30
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
          events: [eventPayload]
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
  vi.unstubAllGlobals();
});

describe("App event details modal", () => {
  it("opens and closes the modal with event details", async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
    const eventPayload = {
      id: "event-1",
      summary: "Team Sync",
      description: "Discuss project status.",
      location: "Conference Room",
      calendarColor: "#ff6b6b",
      calendarLabel: "Work",
      allDay: false,
      start: start.toISOString(),
      end: end.toISOString()
    };

    const fetchMock = createFetchMock(eventPayload);
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const eventButtons = await screen.findAllByRole("button", { name: /Team Sync/i });
    // The calendar cell (month view) is also a button containing the text. 
    // We want the event pill in the side panel (Daily View) which opens the modal.
    // The calendar cell usually contains the day number, while the event pill does not.
    const eventPill = eventButtons.find(b => !b.querySelector(".display__day-number"));
    
    if (!eventPill) {
      throw new Error("Could not find the event pill button in the daily view");
    }
    
    fireEvent.click(eventPill);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Team Sync")).toBeInTheDocument();
    expect(screen.getByText("Conference Room")).toBeInTheDocument();
    expect(screen.getByText("Discuss project status.")).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: /close event details/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
