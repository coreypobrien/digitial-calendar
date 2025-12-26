import { createApp } from "./app.js";
import { createLogger } from "./logger.js";
import { startCalendarSyncJob } from "./jobs/calendarSync.js";

const app = createApp();
const logger = createLogger();
const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

void startCalendarSyncJob(logger);
