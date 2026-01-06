import ical from "node-ical";

const DEFAULT_COLOR = "#2b6f6b";

export const normalizeIcalFeeds = (feeds = []) =>
  feeds
    .map((feed) => ({
      url: typeof feed?.url === "string" ? feed.url.trim() : "",
      label: typeof feed?.label === "string" ? feed.label.trim() : "",
      enabled: feed?.enabled ?? true
    }))
    .filter((feed) => feed.enabled && feed.url);

const deriveLabelFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    if (lastSegment) {
      return decodeURIComponent(lastSegment).replace(/\.ics$/i, "") || parsed.hostname;
    }
    return parsed.hostname;
  } catch {
    return url;
  }
};

const getCalendarName = (data, fallback, url) => {
  const calendar = Object.values(data).find((item) => item?.type === "VCALENDAR");
  const rawName =
    calendar?.["X-WR-CALNAME"] ||
    calendar?.["x-wr-calname"] ||
    calendar?.name ||
    calendar?.summary;
  return rawName || fallback || deriveLabelFromUrl(url);
};

const isValidDate = (value) =>
  value instanceof Date && !Number.isNaN(value.getTime());

const eventOverlapsRange = (start, end, rangeStart, rangeEnd) =>
  start < rangeEnd && end > rangeStart;

const expandRecurringEvent = (event, rangeStart, rangeEnd) => {
  if (!event.rrule) {
    return [event];
  }

  const dates = event.rrule.between(rangeStart, rangeEnd, true);
  if (!dates.length) {
    return [];
  }

  const durationMs =
    isValidDate(event.end) && isValidDate(event.start)
      ? event.end.getTime() - event.start.getTime()
      : 0;

  return dates
    .map((date) => {
      const isoKey = date.toISOString();
      const dateKey = isoKey.slice(0, 10);
      if (event.exdate && (event.exdate[isoKey] || event.exdate[dateKey])) {
        return null;
      }
      const override = event.recurrences?.[isoKey] || event.recurrences?.[dateKey];
      const occurrence = override || event;
      const start = override?.start || date;
      const end =
        override?.end || (durationMs ? new Date(start.getTime() + durationMs) : start);
      return { ...occurrence, start, end, recurrenceId: date };
    })
    .filter(Boolean);
};

const normalizeIcalEvent = (event, calendarMeta) => {
  if (!event || event.type !== "VEVENT") {
    return null;
  }
  const start = event.start;
  if (!isValidDate(start)) {
    return null;
  }
  const end = isValidDate(event.end) ? event.end : start;
  const allDay = event.datetype === "date";
  const startValue = start.toISOString();
  const endValue = end.toISOString();
  const uid = event.uid || event.id || startValue;
  const recurrenceKey = event.recurrenceId
    ? `:${event.recurrenceId.toISOString()}`
    : "";

  return {
    id: `ical:${calendarMeta.id}:${uid}${recurrenceKey}`,
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

const extractEvents = (data, calendarMeta, rangeStart, rangeEnd) => {
  const entries = Object.values(data).filter((item) => item?.type === "VEVENT");
  const results = [];

  for (const entry of entries) {
    const instances = expandRecurringEvent(entry, rangeStart, rangeEnd);
    if (!instances.length) {
      continue;
    }

    for (const event of instances) {
      const start = event.start;
      const end = isValidDate(event.end) ? event.end : start;
      if (!isValidDate(start) || !isValidDate(end)) {
        continue;
      }
      if (!eventOverlapsRange(start, end, rangeStart, rangeEnd)) {
        continue;
      }
      const normalized = normalizeIcalEvent(event, calendarMeta);
      if (normalized) {
        results.push(normalized);
      }
    }
  }

  return results;
};

export const syncIcalEvents = async ({ timeMin, timeMax, feeds } = {}) => {
  const feedConfigs = normalizeIcalFeeds(feeds);
  if (!feedConfigs.length) {
    return { events: [], calendars: 0, errors: [] };
  }

  const rangeStart = new Date(timeMin);
  const rangeEnd = new Date(timeMax);
  const events = [];
  const errors = [];

  for (const feed of feedConfigs) {
    try {
      const response = await fetch(feed.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      const data = ical.parseICS(text);
      const label = feed.label || getCalendarName(data, null, feed.url);
      const calendarMeta = {
        id: feed.url,
        label,
        color: DEFAULT_COLOR
      };
      events.push(...extractEvents(data, calendarMeta, rangeStart, rangeEnd));
    } catch (error) {
      errors.push({ feed: feed.url, message: error.message });
    }
  }

  return { events, calendars: feedConfigs.length, errors };
};
