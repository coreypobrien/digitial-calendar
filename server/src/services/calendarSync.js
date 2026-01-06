import { loadConfig } from "../storage/configStore.js";
import { saveEventCache } from "../storage/eventStore.js";
import { normalizeIcalFeeds, syncIcalEvents } from "./icalCalendar.js";
import { syncGoogleEvents } from "./googleCalendar.js";

export const syncCalendarEvents = async ({ requireGoogle = false } = {}) => {
  const { config } = await loadConfig();
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(
    now.getTime() + config.google.syncDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const iCalFeeds = normalizeIcalFeeds(config.ical?.feeds);

  let googleSummary = { connected: false, calendars: 0, events: [] };
  let googleError = null;
  try {
    googleSummary = await syncGoogleEvents({
      config,
      timeMin,
      timeMax,
      requireGoogle
    });
  } catch (error) {
    if (requireGoogle) {
      throw error;
    }
    googleError = error;
  }

  if (!googleSummary.connected && iCalFeeds.length === 0) {
    const error = new Error("No calendar sources configured");
    error.code = "NO_SOURCES";
    throw error;
  }

  let icalSummary = { events: [], calendars: 0, errors: [] };
  try {
    icalSummary = await syncIcalEvents({ timeMin, timeMax, feeds: iCalFeeds });
  } catch (error) {
    icalSummary = { events: [], calendars: iCalFeeds.length, errors: [{ message: error.message }] };
  }

  const events = [...googleSummary.events, ...icalSummary.events];

  const payload = {
    updatedAt: new Date().toISOString(),
    range: { timeMin, timeMax },
    events
  };

  await saveEventCache(payload);

  return {
    updatedAt: payload.updatedAt,
    events: events.length,
    calendars: googleSummary.calendars + icalSummary.calendars,
    sources: {
      google: {
        connected: googleSummary.connected,
        calendars: googleSummary.calendars,
        events: googleSummary.events.length,
        error: googleError ? googleError.message : null
      },
      ical: {
        calendars: icalSummary.calendars,
        events: icalSummary.events.length,
        errors: icalSummary.errors
      }
    }
  };
};
