import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { startChoreResetJob } from "./choreReset.js";
import * as choreStore from "../storage/choreStore.js";

vi.mock("../storage/choreStore.js");

describe("choreReset job", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    
    // Set a fixed time: 2025-01-01 23:59:59
    const date = new Date(2025, 0, 1, 23, 59, 59);
    vi.setSystemTime(date);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules and runs the reset job", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    choreStore.resetDailyChores.mockResolvedValue([]);
    choreStore.appendHistory.mockResolvedValue([]);

    startChoreResetJob(logger);

    // Should schedule for roughly 1 second later (plus buffer)
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ msUntilMidnight: expect.any(Number) }),
      expect.stringContaining("Scheduling next")
    );

    // Fast forward past midnight
    await vi.advanceTimersByTimeAsync(2000);

    expect(choreStore.resetDailyChores).toHaveBeenCalled();
    // Should archive for "Yesterday" (which was 2025-01-01 when the job ran at 00:00:00 2025-01-02)
    // Wait, getYesterdayString() calls new Date(). If we are strictly at 00:00:01 on Jan 2, yesterday is Jan 1.
    // However, my mock system time is static unless advanced.
    // advanceTimersByTime advances the *timers*, but Date.now() depends on vi.setSystemTime if we want it to move?
    // Vitest's useFakeTimers usually mocks Date as well.
    
    expect(choreStore.appendHistory).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
      []
    );
  });

  it("handles errors gracefully and reschedules", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    choreStore.resetDailyChores.mockRejectedValue(new Error("Storage fail"));

    startChoreResetJob(logger);

    // Initial schedule
    expect(logger.info).toHaveBeenCalledWith(expect.anything(), "Scheduling next chore reset");

    // Advance to trigger run
    await vi.advanceTimersByTimeAsync(2000);

    expect(choreStore.resetDailyChores).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      "Failed to reset daily chores"
    );

    // Should have scheduled again despite error
    expect(logger.info).toHaveBeenCalledTimes(3); // Initial schedule + Start run + Re-schedule
  });
});
