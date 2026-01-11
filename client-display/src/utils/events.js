export const toLocalDateKey = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getEventDateKey = (event) => {
  if (!event?.start) {
    return null;
  }
  if (event.allDay && typeof event.start === "string") {
    return event.start.slice(0, 10);
  }
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  return toLocalDateKey(start);
};

export const eventOccursOnDateKey = (event, dateKey) => {
  if (!event?.start || !dateKey) {
    return false;
  }
  const dayStart = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(dayStart.getTime())) {
    return false;
  }
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const startMs = getEventStartMs(event);
  if (!startMs) {
    return false;
  }
  let endMs = getEventEndMs(event);
  if (!endMs || endMs <= startMs) {
    endMs = startMs + 60 * 60 * 1000;
  }

  return startMs < dayEnd.getTime() && endMs > dayStart.getTime();
};

export const isMultiDayEvent = (event) => {
  if (!event?.start) {
    return false;
  }
  const startMs = getEventStartMs(event);
  const endMs = getEventEndMs(event);
  if (!startMs || !endMs || endMs <= startMs) {
    return false;
  }
  const startKey = toLocalDateKey(new Date(startMs));
  const inclusiveEndMs = endMs > startMs ? endMs - 1 : endMs;
  const endKey = toLocalDateKey(new Date(inclusiveEndMs));
  return startKey !== endKey;
};

export const getEventStartMs = (event) => {
  if (!event?.start) {
    return 0;
  }
  if (event.allDay && typeof event.start === "string") {
    const dateKey = event.start.slice(0, 10);
    return new Date(`${dateKey}T00:00:00`).getTime();
  }
  if (event.allDay && event.start instanceof Date) {
    const dateKey = toLocalDateKey(event.start);
    return new Date(`${dateKey}T00:00:00`).getTime();
  }
  const start = new Date(event.start);
  return Number.isNaN(start.getTime()) ? 0 : start.getTime();
};

export const getEventEndMs = (event) => {
  if (!event?.end) {
    return 0;
  }
  if (event.allDay && typeof event.end === "string") {
    const dateKey = event.end.slice(0, 10);
    return new Date(`${dateKey}T00:00:00`).getTime();
  }
  if (event.allDay && event.end instanceof Date) {
    const dateKey = toLocalDateKey(event.end);
    return new Date(`${dateKey}T00:00:00`).getTime();
  }
  const end = new Date(event.end);
  return Number.isNaN(end.getTime()) ? 0 : end.getTime();
};

export const formatEventTime = (event, timeFormat) => {
  if (event.allDay) {
    return "All day";
  }
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) {
    return "";
  }
  return start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: timeFormat !== "24h"
  });
};

export const formatEventRange = (event, timeFormat) => {
  if (event.allDay) {
    return "All day";
  }
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : null;
  if (Number.isNaN(start.getTime())) {
    return "";
  }
  const options = { hour: "2-digit", minute: "2-digit", hour12: timeFormat !== "24h" };
  const startLabel = start.toLocaleTimeString([], options);
  if (!end || Number.isNaN(end.getTime())) {
    return startLabel;
  }
  return `${startLabel} - ${end.toLocaleTimeString([], options)}`;
};

export const getUpcomingDateParts = (event, timeFormat) => {
  if (!event?.start) {
    return { weekday: "", day: "", month: "", timeLabel: "" };
  }
  let date = null;
  if (event.allDay && typeof event.start === "string") {
    date = new Date(`${event.start}T00:00:00`);
  } else {
    date = new Date(event.start);
  }
  if (!date || Number.isNaN(date.getTime())) {
    return { weekday: "", day: "", month: "", timeLabel: "" };
  }
  return {
    weekday: date.toLocaleDateString([], { weekday: "short" }),
    day: date.toLocaleDateString([], { day: "numeric" }),
    month: date.toLocaleDateString([], { month: "short" }),
    timeLabel: event.allDay ? "All day" : formatEventTime(event, timeFormat)
  };
};
