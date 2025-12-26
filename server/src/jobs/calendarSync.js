import { loadConfig } from "../storage/configStore.js";
import { syncCalendarEvents } from "../services/googleCalendar.js";

let timer = null;
let running = false;

const sleep = (ms) =>
  new Promise((resolve) => {
    timer = setTimeout(resolve, ms);
  });

const runSync = async (logger) => {
  if (running) {
    return;
  }
  running = true;
  try {
    const summary = await syncCalendarEvents();
    logger.info({ summary }, "Calendar auto-sync complete");
  } catch (error) {
    if (error?.code === "NOT_CONNECTED") {
      logger.info("Calendar auto-sync skipped (not connected)");
    } else {
      logger.warn({ err: error }, "Calendar auto-sync failed");
    }
  } finally {
    running = false;
  }
};

export const startCalendarSyncJob = async (logger) => {
  if (process.env.DISABLE_CALENDAR_SYNC === "true") {
    logger.info("Calendar auto-sync disabled");
    return;
  }

  while (true) {
    try {
      const { config } = await loadConfig();
      const intervalMs = Math.max(1, config.refresh.calendarMinutes) * 60 * 1000;
      await runSync(logger);
      await sleep(intervalMs);
    } catch (error) {
      logger.warn({ err: error }, "Calendar auto-sync loop error");
      await sleep(60 * 1000);
    }
  }
};

export const stopCalendarSyncJob = () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
};
