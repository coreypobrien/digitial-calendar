import { describe, expect, it } from "vitest";

import { defaultConfig } from "../config/defaultConfig.js";
import { buildCalendarTargets, normalizeEvent } from "./googleCalendar.js";

describe("googleCalendar helpers", () => {
  it("normalizes timed events", () => {
    const event = {
      id: "1",
      summary: "Meeting",
      start: { dateTime: "2025-01-02T09:00:00Z" },
      end: { dateTime: "2025-01-02T10:00:00Z" }
    };
    const normalized = normalizeEvent(event, {
      id: "cal-1",
      label: "Work",
      color: "#123"
    });

    expect(normalized.allDay).toBe(false);
    expect(normalized.start).toBe("2025-01-02T09:00:00Z");
    expect(normalized.end).toBe("2025-01-02T10:00:00Z");
  });

  it("normalizes all-day events", () => {
    const event = {
      id: "2",
      summary: "Holiday",
      start: { date: "2025-07-04" },
      end: { date: "2025-07-05" }
    };
    const normalized = normalizeEvent(event, {
      id: "cal-2",
      label: "Holidays",
      color: "#999"
    });

    expect(normalized.allDay).toBe(true);
    expect(normalized.start).toBe("2025-07-04");
    expect(normalized.end).toBe("2025-07-05");
  });

  it("skips cancelled events", () => {
    const event = { id: "3", status: "cancelled" };
    expect(normalizeEvent(event, { id: "cal", label: "Work", color: "#123" })).toBeNull();
  });

  it("prefers configured calendars when present", () => {
    const config = {
      ...defaultConfig,
      calendars: [
        { id: "cal-1", label: "Work", color: "#111", enabled: true },
        { id: "cal-2", label: "Off", color: "#222", enabled: false }
      ]
    };
    const list = [{ id: "cal-1", summary: "Work", backgroundColor: "#aaa" }];
    const targets = buildCalendarTargets(config, list);

    expect(targets).toHaveLength(1);
    expect(targets[0].id).toBe("cal-1");
    expect(targets[0].color).toBe("#111");
  });

  it("falls back to calendar list when config is empty", () => {
    const config = { ...defaultConfig, calendars: [] };
    const list = [{ id: "cal-9", summary: "Family", backgroundColor: "#abc" }];
    const targets = buildCalendarTargets(config, list);

    expect(targets).toHaveLength(1);
    expect(targets[0].label).toBe("Family");
    expect(targets[0].color).toBe("#abc");
  });
});
