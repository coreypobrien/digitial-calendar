import { appendHistory, resetDailyChores } from "../storage/choreStore.js";

const getMsUntilMidnight = () => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
};

const getYesterdayString = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toLocaleDateString("en-CA"); // YYYY-MM-DD
};

export const startChoreResetJob = (logger) => {
  const scheduleNext = () => {
    const ms = getMsUntilMidnight();
    logger.info({ msUntilMidnight: ms }, "Scheduling next chore reset");
    setTimeout(runJob, ms + 1000); // Add 1s buffer to ensure we are in the new day
  };

  const runJob = async () => {
    logger.info("Running daily chore reset");
    try {
      const summary = await resetDailyChores();
      const dateStr = getYesterdayString();
      await appendHistory(dateStr, summary);
      logger.info({ date: dateStr, summary }, "Chore history archived and daily status reset");
    } catch (error) {
      logger.error({ err: error }, "Failed to reset daily chores");
    } finally {
      scheduleNext();
    }
  };

  scheduleNext();
};
