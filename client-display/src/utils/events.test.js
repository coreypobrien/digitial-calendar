import { describe, expect, it } from "vitest";

import { eventOccursOnDateKey, getUpcomingDateParts, isMultiDayEvent } from "./events.js";

describe("eventOccursOnDateKey", () => {
  it("includes each day in an all-day multi-day range", () => {
    const event = { allDay: true, start: "2025-12-24", end: "2025-12-27" };
    expect(eventOccursOnDateKey(event, "2025-12-24")).toBe(true);
    expect(eventOccursOnDateKey(event, "2025-12-25")).toBe(true);
    expect(eventOccursOnDateKey(event, "2025-12-26")).toBe(true);
    expect(eventOccursOnDateKey(event, "2025-12-27")).toBe(false);
  });

  it("supports all-day events with ISO timestamps", () => {
    const event = {
      allDay: true,
      start: "2026-01-16T05:00:00.000Z",
      end: "2026-01-20T05:00:00.000Z"
    };
    expect(eventOccursOnDateKey(event, "2026-01-16")).toBe(true);
    expect(eventOccursOnDateKey(event, "2026-01-19")).toBe(true);
    expect(eventOccursOnDateKey(event, "2026-01-20")).toBe(false);
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

  it("includes multi-day timed events on each day they overlap", () => {
    const event = {
      allDay: false,
      start: "2025-12-24T23:00:00",
      end: "2025-12-25T01:00:00"
    };
    expect(eventOccursOnDateKey(event, "2025-12-24")).toBe(true);
    expect(eventOccursOnDateKey(event, "2025-12-25")).toBe(true);
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

describe("isMultiDayEvent", () => {
  it("returns false for single-day all-day events", () => {
    const event = { allDay: true, start: "2025-12-24", end: "2025-12-25" };
    expect(isMultiDayEvent(event)).toBe(false);
  });

  it("returns true for multi-day all-day events", () => {
    const event = { allDay: true, start: "2025-12-24", end: "2025-12-27" };
    expect(isMultiDayEvent(event)).toBe(true);
  });

  it("returns true for timed events that cross midnight", () => {
    const event = {
      allDay: false,
      start: "2025-12-24T23:00:00",
      end: "2025-12-25T01:00:00"
    };
    expect(isMultiDayEvent(event)).toBe(true);
  });
});
