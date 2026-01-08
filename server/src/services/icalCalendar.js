import ical from "node-ical";

const DEFAULT_COLOR = "#2b6f6b";

const timeZoneFormatters = new Map();

const getTimeZoneFormatter = (timeZone) => {
  if (!timeZone) {
    return null;
  }
  if (timeZoneFormatters.has(timeZone)) {
    return timeZoneFormatters.get(timeZone);
  }
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    timeZoneFormatters.set(timeZone, formatter);
    return formatter;
  } catch {
    return null;
  }
};

const getTimeZoneParts = (date, timeZone) => {
  const formatter = getTimeZoneFormatter(timeZone);
  if (!formatter) {
    return null;
  }
  const parts = formatter.formatToParts(date);
  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }
  if (!values.year) {
    return null;
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  };
};

const getTimeZoneOffsetMs = (date, timeZone) => {
  const parts = getTimeZoneParts(date, timeZone);
  if (!parts) {
    return 0;
  }
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return asUtc - date.getTime();
};

const convertFloatingToUtc = (date, timeZone) => {
  const utcGuess = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  );
  const guessDate = new Date(utcGuess);
  const offset = getTimeZoneOffsetMs(guessDate, timeZone);
  return new Date(utcGuess - offset);
};

const convertUtcToFloating = (date, timeZone) => {
  const parts = getTimeZoneParts(date, timeZone);
  if (!parts) {
    return date;
  }
  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      date.getUTCMilliseconds()
    )
  );
};

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

  const tzid = event.rrule?.origOptions?.tzid;
  const usesTimezone = Boolean(tzid) && event.datetype !== "date";
  const rruleRangeStart = usesTimezone
    ? convertUtcToFloating(rangeStart, tzid)
    : rangeStart;
  const rruleRangeEnd = usesTimezone ? convertUtcToFloating(rangeEnd, tzid) : rangeEnd;
  const dates = event.rrule.between(rruleRangeStart, rruleRangeEnd, true);
  if (!dates.length) {
    return [];
  }

  const durationMs =
    isValidDate(event.end) && isValidDate(event.start)
      ? event.end.getTime() - event.start.getTime()
      : 0;

  return dates
    .map((date) => {
      const occurrenceDate = usesTimezone ? convertFloatingToUtc(date, tzid) : date;
      const isoKey = occurrenceDate.toISOString();
      const dateKey = isoKey.slice(0, 10);
      if (event.exdate && (event.exdate[isoKey] || event.exdate[dateKey])) {
        return null;
      }
      const override = event.recurrences?.[isoKey] || event.recurrences?.[dateKey];
      const occurrence = override || event;
      const start = override?.start || occurrenceDate;
      const end =
        override?.end || (durationMs ? new Date(start.getTime() + durationMs) : start);
      return { ...occurrence, start, end, recurrenceId: occurrenceDate };
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
