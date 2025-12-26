import { google } from "googleapis";

import { loadConfig } from "../storage/configStore.js";
import { saveEventCache } from "../storage/eventStore.js";
import { getAuthorizedClient } from "./googleAuth.js";

const DEFAULT_COLOR = "#2b6f6b";

export const normalizeEvent = (event, calendarMeta) => {
  if (!event || event.status === "cancelled") {
    return null;
  }

  const startValue = event.start?.dateTime || event.start?.date || null;
  const endValue = event.end?.dateTime || event.end?.date || null;
  const allDay = Boolean(event.start?.date) && !event.start?.dateTime;

  return {
    id: event.id,
    calendarId: calendarMeta.id,
    calendarLabel: calendarMeta.label,
    calendarColor: calendarMeta.color,
    summary: event.summary || "Untitled event",
    description: event.description || "",
    location: event.location || "",
    status: event.status || "confirmed",
    start: startValue,
    end: endValue,
    allDay
  };
};

export const buildCalendarTargets = (config, calendarList) => {
  const items = calendarList || [];
  const listById = new Map(items.map((item) => [item.id, item]));
  const configCalendars = config.calendars || [];

  if (configCalendars.length) {
    return configCalendars
      .filter((calendar) => calendar.enabled)
      .map((calendar) => {
        const listItem = listById.get(calendar.id);
        return {
          id: calendar.id,
          label: calendar.label || listItem?.summary || calendar.id,
          color: calendar.color || listItem?.backgroundColor || DEFAULT_COLOR
        };
      });
  }

  return items.map((item) => ({
    id: item.id,
    label: item.summary || item.id,
    color: item.backgroundColor || DEFAULT_COLOR
  }));
};

export const listCalendars = async () => {
  const client = await getAuthorizedClient();
  if (!client) {
    const error = new Error("Google account not connected");
    error.code = "NOT_CONNECTED";
    throw error;
  }

  const calendarApi = google.calendar({ version: "v3", auth: client });
  const response = await calendarApi.calendarList.list({ minAccessRole: "reader" });
  return response.data.items || [];
};

export const syncCalendarEvents = async () => {
  const client = await getAuthorizedClient();
  if (!client) {
    const error = new Error("Google account not connected");
    error.code = "NOT_CONNECTED";
    throw error;
  }

  const calendarApi = google.calendar({ version: "v3", auth: client });
  const calendarList = await calendarApi.calendarList.list({ minAccessRole: "reader" });
  const items = calendarList.data.items || [];
  const { config } = await loadConfig();

  const targets = buildCalendarTargets(config, items);
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(
    now.getTime() + config.google.syncDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const events = [];

  for (const calendar of targets) {
    let pageToken = undefined;
    do {
      const response = await calendarApi.events.list({
        calendarId: calendar.id,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 2500,
        pageToken
      });

      const items = response.data.items || [];
      for (const event of items) {
        const normalized = normalizeEvent(event, calendar);
        if (normalized) {
          events.push(normalized);
        }
      }
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    range: { timeMin, timeMax },
    events
  };

  await saveEventCache(payload);

  return {
    updatedAt: payload.updatedAt,
    events: events.length,
    calendars: targets.length
  };
};
