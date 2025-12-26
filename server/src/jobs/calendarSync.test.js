import { describe, expect, it, vi } from "vitest";

import { startCalendarSyncJob } from "./calendarSync.js";

describe("calendarSync job", () => {
  it("returns early when disabled", async () => {
    process.env.DISABLE_CALENDAR_SYNC = "true";
    const logger = { info: vi.fn(), warn: vi.fn() };

    await startCalendarSyncJob(logger);

    expect(logger.info).toHaveBeenCalledWith("Calendar auto-sync disabled");
    delete process.env.DISABLE_CALENDAR_SYNC;
  });
});
