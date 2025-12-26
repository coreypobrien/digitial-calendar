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
  if (!event.allDay) {
    return getEventDateKey(event) === dateKey;
  }
  const startKey = typeof event.start === "string" ? event.start.slice(0, 10) : null;
  if (!startKey) {
    return false;
  }
  if (!event.end || typeof event.end !== "string") {
    return startKey === dateKey;
  }
  const endKey = event.end.slice(0, 10);
  if (!endKey || endKey <= startKey) {
    return startKey === dateKey;
  }
  return dateKey >= startKey && dateKey < endKey;
};

export const getEventStartMs = (event) => {
  if (!event?.start) {
    return 0;
  }
  if (event.allDay && typeof event.start === "string") {
    return new Date(`${event.start}T00:00:00`).getTime();
  }
  const start = new Date(event.start);
  return Number.isNaN(start.getTime()) ? 0 : start.getTime();
};

export const getEventEndMs = (event) => {
  if (!event?.end) {
    return 0;
  }
  if (event.allDay && typeof event.end === "string") {
    return new Date(`${event.end}T00:00:00`).getTime();
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
