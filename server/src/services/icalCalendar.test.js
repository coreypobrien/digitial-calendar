import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { syncIcalEvents } from "./icalCalendar.js";

const recurringIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Wall Calendar//EN
BEGIN:VEVENT
UID:recurring-1
DTSTART:20240101T100000Z
DTEND:20240101T110000Z
RRULE:FREQ=DAILY;COUNT=3
SUMMARY:Daily Standup
END:VEVENT
END:VCALENDAR`;

const recurringIcsWithOverrides = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Wall Calendar//EN
BEGIN:VEVENT
UID:recurring-override-1
DTSTART:20240101T100000Z
DTEND:20240101T110000Z
RRULE:FREQ=DAILY;COUNT=3
EXDATE:20240102T100000Z
SUMMARY:Daily Standup
END:VEVENT
BEGIN:VEVENT
UID:recurring-override-1
RECURRENCE-ID:20240103T100000Z
DTSTART:20240103T120000Z
DTEND:20240103T130000Z
SUMMARY:Daily Standup (moved)
END:VEVENT
END:VCALENDAR`;

describe("syncIcalEvents", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("expands recurring events into distinct start/end times", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => recurringIcs
    });

    const { events, errors } = await syncIcalEvents({
      timeMin: "2023-12-31T00:00:00.000Z",
      timeMax: "2024-01-05T00:00:00.000Z",
      feeds: [{ url: "https://example.com/calendar.ics", label: "Test" }]
    });

    expect(errors).toEqual([]);
    expect(events).toHaveLength(3);

    const starts = events.map((event) => event.start).sort();
    const ends = events.map((event) => event.end).sort();

    expect(starts).toEqual([
      "2024-01-01T10:00:00.000Z",
      "2024-01-02T10:00:00.000Z",
      "2024-01-03T10:00:00.000Z"
    ]);
    expect(ends).toEqual([
      "2024-01-01T11:00:00.000Z",
      "2024-01-02T11:00:00.000Z",
      "2024-01-03T11:00:00.000Z"
    ]);
  });

  it("applies exdate exclusions and recurrence overrides", async () => {
    fetch.mockResolvedValue({
      ok: true,
      text: async () => recurringIcsWithOverrides
    });

    const { events, errors } = await syncIcalEvents({
      timeMin: "2023-12-31T00:00:00.000Z",
      timeMax: "2024-01-05T00:00:00.000Z",
      feeds: [{ url: "https://example.com/calendar.ics", label: "Test" }]
    });

    expect(errors).toEqual([]);
    expect(events).toHaveLength(2);

    const starts = events.map((event) => event.start).sort();
    const ends = events.map((event) => event.end).sort();

    expect(starts).toEqual([
      "2024-01-01T10:00:00.000Z",
      "2024-01-03T12:00:00.000Z"
    ]);
    expect(ends).toEqual([
      "2024-01-01T11:00:00.000Z",
      "2024-01-03T13:00:00.000Z"
    ]);
  });
});
