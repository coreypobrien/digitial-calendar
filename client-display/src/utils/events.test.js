import { describe, expect, it } from "vitest";

import { eventOccursOnDateKey, getUpcomingDateParts } from "./events.js";

describe("eventOccursOnDateKey", () => {
  it("includes each day in an all-day multi-day range", () => {
    const event = { allDay: true, start: "2025-12-24", end: "2025-12-27" };
    expect(eventOccursOnDateKey(event, "2025-12-24")).toBe(true);
    expect(eventOccursOnDateKey(event, "2025-12-25")).toBe(true);
    expect(eventOccursOnDateKey(event, "2025-12-26")).toBe(true);
    expect(eventOccursOnDateKey(event, "2025-12-27")).toBe(false);
  });

  it("handles single-day all-day events", () => {
    const event = { allDay: true, start: "2025-12-24" };
    expect(eventOccursOnDateKey(event, "2025-12-24")).toBe(true);
    expect(eventOccursOnDateKey(event, "2025-12-25")).toBe(false);
  });

  it("matches timed events to their start date", () => {
    const event = { allDay: false, start: "2025-12-24T09:00:00" };
    expect(eventOccursOnDateKey(event, "2025-12-24")).toBe(true);
    expect(eventOccursOnDateKey(event, "2025-12-25")).toBe(false);
  });
});

describe("getUpcomingDateParts", () => {
  it("marks all-day events correctly", () => {
    const meta = getUpcomingDateParts({ allDay: true, start: "2025-12-24" }, "12h");
    expect(meta.timeLabel).toBe("All day");
    expect(meta.day).toBe("24");
  });

  it("returns a time label for timed events", () => {
    const meta = getUpcomingDateParts(
      { allDay: false, start: "2025-12-24T09:30:00" },
      "12h"
    );
    expect(meta.timeLabel).not.toBe("");
    expect(meta.weekday).not.toBe("");
    expect(meta.month).not.toBe("");
  });
});
