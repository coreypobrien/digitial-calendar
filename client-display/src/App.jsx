import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import ChoreView from "./components/ChoreView.jsx";

import {
  eventOccursOnDateKey,
  formatEventRange,
  formatEventTime,
  getEventEndMs,
  getEventStartMs,
  getUpcomingDateParts,
  isMultiDayEvent,
  toLocalDateKey
} from "./utils/events.js";

const DAILY_WINDOW_START = 8;
const DAILY_WINDOW_HOURS = 12;
const DAILY_SLOT_MINUTES = 15;
const DAILY_SLOT_HEIGHT = 24;
const WEEK_EVENT_LIMIT = 6;
const TIME_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const IDLE_RESET_MINUTES = 1;

const formatTime = (date, timeFormat) =>
  date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: timeFormat !== "24h"
  });

const formatDate = (date, style = "long") =>
  date.toLocaleDateString(
    [],
    style === "short"
      ? { weekday: "short", month: "short", day: "numeric" }
      : { weekday: "long", month: "long", day: "numeric", year: "numeric" }
  );

const formatMonthLabel = (date) =>
  date.toLocaleDateString([], { month: "long", year: "numeric" });

const formatWeekLabel = (start, end) => {
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" })
  });
  const endLabel = end.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  return `${startLabel} - ${endLabel}`;
};

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const getWeekStart = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
};

const getMinutesIntoDay = (date) => date.getHours() * 60 + date.getMinutes();

const getDayStartMs = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
};

const getDayEndMs = (date) => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
};

const parsePx = (value) => {
  if (typeof value !== "string") {
    return 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getDayEventLimitDebug = (rowCount, multiDayRowCount, isNarrowPortrait) => {
  const baseLimit = rowCount <= 4 ? 4 : 3;
  const rawLimit = Math.max(0, baseLimit - multiDayRowCount);
  const portraitClamp = isNarrowPortrait && rawLimit > 2;
  const visibleLimit = portraitClamp ? 2 : rawLimit;
  return {
    baseLimit,
    rawLimit,
    portraitClamp,
    visibleLimit,
    reason: portraitClamp ? "portrait clamp to 2" : "baseLimit - multiDayRows"
  };
};

const getDayEventLimit = (
  rowCount,
  multiDayRowCount,
  isNarrowPortrait,
  measuredCapacity
) => {
  const baseLimit = rowCount <= 4 ? 4 : 3;
  const rawLimit = Math.max(0, baseLimit - multiDayRowCount);
  if (typeof measuredCapacity === "number" && measuredCapacity >= 0) {
    return Math.min(rawLimit, measuredCapacity);
  }
  return isNarrowPortrait && rawLimit > 2 ? 2 : rawLimit;
};

const measureDayCapacities = (container, measureContainer) => {
  if (!container) {
    return { capacities: {}, dayWidth: null };
  }
  const nextCapacities = {};
  let dayWidth = null;
  const dayCells = container.querySelectorAll(".display__day[data-day-key]");
  dayCells.forEach((day) => {
    const key = day.dataset.dayKey;
    const events = day.querySelector(".display__day-events");
    if (!key || !events) {
      return;
    }
    if (dayWidth === null) {
      dayWidth = day.getBoundingClientRect().width;
    }
    const measureDay = measureContainer?.querySelector(
      `.display__event-measure-day[data-day-key="${key}"]`
    );
    const chips = measureDay
      ? Array.from(measureDay.querySelectorAll(".display__event-chip"))
      : Array.from(events.querySelectorAll(".display__event-chip"));
    if (!chips.length) {
      nextCapacities[key] = 0;
      return;
    }
    const dayRect = day.getBoundingClientRect();
    const eventsRect = events.getBoundingClientRect();
    const dayStyles = window.getComputedStyle(day);
    const eventsStyles = window.getComputedStyle(events);
    const dayNumberEl = day.querySelector(".display__day-number");
    const dayNumberRect = dayNumberEl?.getBoundingClientRect();
    const paddingBottom = parsePx(dayStyles.paddingBottom);
    const paddingTop = parsePx(dayStyles.paddingTop);
    const dayGap = parsePx(dayStyles.rowGap || dayStyles.gap);
    const eventsGap = parsePx(eventsStyles.rowGap || eventsStyles.gap);
    const eventsMarginTop = parsePx(eventsStyles.marginTop);
    const multiRows = Number.parseInt(day.dataset.multiRows || "0", 10);
    const fixedMarginTop = multiRows > 0 ? eventsMarginTop : 0;
    const dayNumberHeight = dayNumberRect?.height ?? 0;
    const availableHeight =
      dayRect.height -
      paddingTop -
      paddingBottom -
      dayNumberHeight -
      dayGap -
      fixedMarginTop;
    const availableHeightUsed = Math.max(0, availableHeight);
    const chipHeights = chips.map((chip) => chip.getBoundingClientRect().height);
    if (!chipHeights.length || availableHeightUsed <= 0) {
      nextCapacities[key] = 0;
      return;
    }
    let used = 0;
    let capacity = 0;
    for (const height of chipHeights) {
      const nextUsed = used === 0 ? height : used + eventsGap + height;
      if (nextUsed <= availableHeightUsed) {
        used = nextUsed;
        capacity += 1;
      } else {
        break;
      }
    }
    nextCapacities[key] = Math.max(0, capacity);
  });
  return { capacities: nextCapacities, dayWidth };
};

const areCapacityMapsEqual = (left, right) => {
  if (left === right) {
    return true;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => left[key] === right[key]);
};

const normalizeMergeValue = (value) => (value ? String(value) : "");

const buildMergeKey = (event) => {
  if (!event) {
    return "";
  }
  return [
    normalizeMergeValue(event.summary),
    normalizeMergeValue(event.start),
    normalizeMergeValue(event.end),
    event.allDay ? "1" : "0",
    normalizeMergeValue(event.location)
  ].join("||");
};

const mergeCalendarEvents = (events) => {
  const merged = new Map();
  for (const event of events) {
    if (!event) {
      continue;
    }
    const key = buildMergeKey(event);
    const existing = merged.get(key);
    if (!existing) {
      const calendarColors = [];
      const calendarLabels = [];
      const calendarIds = [];
      if (event.calendarColor) {
        calendarColors.push(event.calendarColor);
      }
      if (event.calendarLabel) {
        calendarLabels.push(event.calendarLabel);
      }
      if (event.calendarId) {
        calendarIds.push(event.calendarId);
      }
      merged.set(key, {
        ...event,
        calendarColors,
        calendarLabels,
        calendarIds
      });
      continue;
    }
    if (
      event.calendarId &&
      Array.isArray(existing.calendarIds) &&
      existing.calendarIds.includes(event.calendarId)
    ) {
      const fallbackKey = `${key}||${event.id || existing.calendarIds.length}`;
      merged.set(fallbackKey, {
        ...event,
        calendarColors: event.calendarColor ? [event.calendarColor] : [],
        calendarLabels: event.calendarLabel ? [event.calendarLabel] : [],
        calendarIds: event.calendarId ? [event.calendarId] : []
      });
      continue;
    }
    if (event.calendarColor && !existing.calendarColors.includes(event.calendarColor)) {
      existing.calendarColors.push(event.calendarColor);
    }
    if (event.calendarLabel && !existing.calendarLabels.includes(event.calendarLabel)) {
      existing.calendarLabels.push(event.calendarLabel);
    }
    if (event.calendarId && !existing.calendarIds.includes(event.calendarId)) {
      existing.calendarIds.push(event.calendarId);
    }
  }
  return Array.from(merged.values());
};

const getEventCalendarColors = (event) => {
  const colors = Array.isArray(event?.calendarColors)
    ? event.calendarColors.filter(Boolean)
    : [];
  if (!colors.length && event?.calendarColor) {
    return [event.calendarColor];
  }
  return colors;
};

const getEventCalendarLabels = (event) => {
  const labels = Array.isArray(event?.calendarLabels)
    ? event.calendarLabels.filter(Boolean)
    : [];
  if (!labels.length && event?.calendarLabel) {
    return [event.calendarLabel];
  }
  return labels;
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

 

const buildMultiDayRows = (weekDates, events) => {
  const dateKeys = weekDates.map((date) => (date ? toLocalDateKey(date) : null));
  const visibleIndices = dateKeys
    .map((key, index) => (key ? index : null))
    .filter((value) => value !== null);
  if (!visibleIndices.length) {
    return [];
  }
  const firstVisibleIndex = visibleIndices[0];
  const lastVisibleIndex = visibleIndices[visibleIndices.length - 1];
  const visibleStartMs = getDayStartMs(weekDates[firstVisibleIndex]);
  const visibleEndMs = getDayEndMs(weekDates[lastVisibleIndex]);

  const segments = [];
  for (const event of events) {
    if (!isMultiDayEvent(event)) {
      continue;
    }
    let startIndex = null;
    let endIndex = null;
    for (let i = 0; i < dateKeys.length; i += 1) {
      const key = dateKeys[i];
      if (!key) {
        continue;
      }
      if (eventOccursOnDateKey(event, key)) {
        if (startIndex === null) {
          startIndex = i;
        }
        endIndex = i;
      }
    }
    if (startIndex === null || endIndex === null) {
      continue;
    }
    const startMs = getEventStartMs(event);
    let endMs = getEventEndMs(event);
    if (!endMs || endMs <= startMs) {
      endMs = startMs + 60 * 60 * 1000;
    }
    segments.push({
      event,
      startIndex,
      endIndex,
      startsBefore: startMs < visibleStartMs,
      endsAfter: endMs > visibleEndMs
    });
  }

  segments.sort((a, b) => {
    if (a.startIndex !== b.startIndex) {
      return a.startIndex - b.startIndex;
    }
    const aSpan = a.endIndex - a.startIndex;
    const bSpan = b.endIndex - b.startIndex;
    if (aSpan !== bSpan) {
      return bSpan - aSpan;
    }
    return getEventStartMs(a.event) - getEventStartMs(b.event);
  });

  const rows = [];
  for (const segment of segments) {
    let placed = false;
    for (const row of rows) {
      const overlaps = row.some(
        (existing) =>
          segment.startIndex <= existing.endIndex &&
          segment.endIndex >= existing.startIndex
      );
      if (!overlaps) {
        row.push(segment);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push([segment]);
    }
  }
  return rows;
};

const getForecastBadge = (description = "") => {
  const text = description.toLowerCase();
  if (text.includes("thunder") || text.includes("storm")) {
    return { label: "STM", tone: "storm" };
  }
  if (text.includes("snow") || text.includes("sleet") || text.includes("flurr")) {
    return { label: "SNW", tone: "snow" };
  }
  if (text.includes("rain") || text.includes("shower") || text.includes("drizzle")) {
    return { label: "RN", tone: "rain" };
  }
  if (text.includes("fog") || text.includes("mist") || text.includes("haze")) {
    return { label: "FG", tone: "fog" };
  }
  if (text.includes("cloud")) {
    return { label: "CLD", tone: "cloud" };
  }
  return { label: "SUN", tone: "sun" };
};

const viewLabels = {
  month: "Monthly View",
  fourWeek: "4-Week View",
  week: "Weekly View",
  activity: "Upcoming",
  chores: "Chores"
};

export default function App() {
  const [now, setNow] = useState(new Date());
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState("");
  const [weatherModalOpen, setWeatherModalOpen] = useState(false);
  const [eventsCache, setEventsCache] = useState({ events: [], updatedAt: null });
  const [refreshError, setRefreshError] = useState("");
  const [isRefreshingEvents, setIsRefreshingEvents] = useState(false);
  const [view, setView] = useState("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [fourWeekAnchorDate, setFourWeekAnchorDate] = useState(() =>
    getWeekStart(new Date())
  );
  const [monthOffset, setMonthOffset] = useState(0);
  const [rangeRequest, setRangeRequest] = useState(null);
  const [timeOffsetMs, setTimeOffsetMs] = useState(0);
  const [activeEvent, setActiveEvent] = useState(null);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }));
  const monthWeeksRef = useRef(null);
  const fourWeekWeeksRef = useRef(null);
  const monthMeasureRef = useRef(null);
  const fourWeekMeasureRef = useRef(null);
  const [monthCapacities, setMonthCapacities] = useState({});
  const [fourWeekCapacities, setFourWeekCapacities] = useState({});
  const [monthMeasureWidth, setMonthMeasureWidth] = useState(null);
  const [fourWeekMeasureWidth, setFourWeekMeasureWidth] = useState(null);
  const lastInteractionRef = useRef(Date.now());
  const resetTimerRef = useRef(null);
  const lastDayKeyRef = useRef(toLocalDateKey(new Date()));
  const dayChangeTimerRef = useRef(null);
  const lastBackfillRef = useRef({ key: null, at: 0 });
  const debugEvents = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return new URLSearchParams(window.location.search).has("debugEvents");
  }, []);

  const logDebug = useCallback(
    (message, payload) => {
      if (!debugEvents) {
        return;
      }
      if (payload !== undefined) {
        console.log(`[calendar debug] ${message}`, payload);
      } else {
        console.log(`[calendar debug] ${message}`);
      }
    },
    [debugEvents]
  );

  const clearIdleResetTimer = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  const resetToToday = (baseDate) => {
    const nextDate = baseDate ? new Date(baseDate) : new Date();
    setSelectedDate(nextDate);
    setMonthOffset(0);
    setFourWeekAnchorDate(getWeekStart(nextDate));
  };
  const handleViewChange = (nextView) => {
    setView(nextView);
    if (nextView === "month") {
      const monthDiff =
        (selectedDate.getFullYear() - now.getFullYear()) * 12 +
        (selectedDate.getMonth() - now.getMonth());
      setMonthOffset(monthDiff);
    }
    if (nextView === "fourWeek") {
      setFourWeekAnchorDate(getWeekStart(selectedDate));
    }
  };
  const shiftWeek = (direction, weekCount = 1) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + direction * 7 * weekCount);
      return next;
    });
    if (view === "fourWeek") {
      setFourWeekAnchorDate((prev) => {
        const base = prev || getWeekStart(selectedDate);
        const next = new Date(base);
        next.setDate(next.getDate() + direction * 7 * weekCount);
        return next;
      });
    }
  };

  useEffect(() => {
    const updateNow = () => {
      setNow(new Date(Date.now() + timeOffsetMs));
    };
    updateNow();
    const timer = setInterval(updateNow, 1000 * 30);
    return () => clearInterval(timer);
  }, [timeOffsetMs]);

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const markInteraction = () => {
      const idleMs = Date.now() - lastInteractionRef.current;
      logDebug("idle reset on interaction", { idleMs });
      lastInteractionRef.current = Date.now();
      clearIdleResetTimer();
    };
    const events = ["pointerdown", "keydown", "touchstart", "wheel"];
    events.forEach((eventName) => window.addEventListener(eventName, markInteraction));
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, markInteraction));
    };
  }, []);

  useEffect(() => {
    const scheduleNextDayCheck = () => {
      const current = new Date(Date.now() + timeOffsetMs);
      const nextMidnight = new Date(current);
      nextMidnight.setHours(24, 0, 0, 0);
      const delayMs = Math.max(0, nextMidnight.getTime() - current.getTime());
      logDebug("next day check scheduled", {
        now: current.toLocaleString(),
        nextMidnight: nextMidnight.toLocaleString(),
        delayMs
      });
      if (dayChangeTimerRef.current) {
        clearTimeout(dayChangeTimerRef.current);
      }
      dayChangeTimerRef.current = setTimeout(() => {
        const nowDate = new Date(Date.now() + timeOffsetMs);
        const todayKeyLocal = toLocalDateKey(nowDate);
        const previousKey = lastDayKeyRef.current;
        if (previousKey && previousKey !== todayKeyLocal) {
          const thresholdMs = IDLE_RESET_MINUTES * 60 * 1000;
          const idleMs = Date.now() - lastInteractionRef.current;
          if (idleMs >= thresholdMs) {
            logDebug("day rollover reset", { idleMs, thresholdMs });
            resetToToday(nowDate);
          } else {
            const delay = thresholdMs - idleMs;
            logDebug("day rollover idle delay scheduled", { idleMs, thresholdMs, delayMs: delay });
            clearIdleResetTimer();
            resetTimerRef.current = setTimeout(() => {
              const idleNow = Date.now() - lastInteractionRef.current;
              if (idleNow < thresholdMs) {
                return;
              }
              const idleDate = new Date(Date.now() + timeOffsetMs);
              if (toLocalDateKey(idleDate) === todayKeyLocal) {
                logDebug("day rollover reset after idle", {
                  idleMs: idleNow,
                  thresholdMs
                });
                resetToToday(idleDate);
              }
            }, delay);
          }
          lastDayKeyRef.current = todayKeyLocal;
        }
        scheduleNextDayCheck();
      }, delayMs);
    };

    lastDayKeyRef.current = toLocalDateKey(new Date(Date.now() + timeOffsetMs));
    scheduleNextDayCheck();
    return () => {
      if (dayChangeTimerRef.current) {
        clearTimeout(dayChangeTimerRef.current);
        dayChangeTimerRef.current = null;
      }
      clearIdleResetTimer();
    };
  }, [logDebug, timeOffsetMs]);

  useEffect(() => {
    let active = true;
    const syncTime = async () => {
      try {
        const response = await fetch("/api/time");
        const data = await response.json();
        if (!active) {
          return;
        }
        if (response.ok && data?.now) {
          const serverNow = new Date(data.now).getTime();
          if (!Number.isNaN(serverNow)) {
            const nextOffset = serverNow - Date.now();
            setTimeOffsetMs(nextOffset);
          }
        }
      } catch (_error) {
        // Ignore time sync failures; local clock keeps running.
      }
    };
    syncTime();
    const timer = setInterval(syncTime, TIME_SYNC_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadConfig = async () => {
      try {
        const response = await fetch("/api/settings/public");
        const data = await response.json();
        if (!active) {
          return;
        }
        if (response.ok) {
          setConfig(data.config);
          const preferred = data.config.display?.defaultView || "month";
          setView(viewLabels[preferred] ? preferred : "month");
        } else {
          setError(data.error || "Unable to load settings.");
        }
      } catch (err) {
        if (active) {
          setError("Unable to load settings.");
        }
      }
    };
    loadConfig();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadEvents = async () => {
      try {
        const response = await fetch("/api/events");
        const data = await response.json();
        if (!active) {
          return;
        }
        if (response.ok) {
          setEventsCache(data);
        }
      } catch (_err) {
        if (active) {
          setEventsCache((prev) => prev);
        }
      }
    };

    loadEvents();
    if (config?.refresh?.clientMinutes) {
      const intervalMs = Math.max(1, config.refresh.clientMinutes) * 60 * 1000;
      logDebug("calendar refresh scheduled", {
        intervalMs,
        nextRefresh: new Date(Date.now() + intervalMs).toLocaleString()
      });
      const timer = setInterval(loadEvents, intervalMs);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }
    return () => {
      active = false;
    };
  }, [config?.refresh?.clientMinutes, logDebug]);

  useEffect(() => {
    let active = true;
    const loadWeather = async () => {
      try {
        const response = await fetch("/api/weather");
        const data = await response.json();
        if (!active) {
          return;
        }
        if (response.ok && data.data) {
          setWeather(data.data);
          setWeatherError(data.stale ? "Using cached weather" : "");
        } else {
          setWeatherError(data.error || "Weather unavailable.");
        }
      } catch (_err) {
        if (active) {
          setWeatherError("Weather unavailable.");
        }
      }
    };
    loadWeather();
    if (config?.refresh?.clientMinutes) {
      const intervalMs = Math.max(1, config.refresh.clientMinutes) * 60 * 1000;
      logDebug("weather refresh scheduled", {
        intervalMs,
        nextRefresh: new Date(Date.now() + intervalMs).toLocaleString()
      });
      const timer = setInterval(loadWeather, intervalMs);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }
    return () => {
      active = false;
    };
  }, [config?.refresh?.clientMinutes, logDebug]);

  const handleRefreshEvents = async () => {
    setIsRefreshingEvents(true);
    setRefreshError("");
    try {
      const response = await fetch("/api/events/refresh", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        setEventsCache(data);
      } else {
        setRefreshError(data.error || "Unable to refresh events.");
      }
    } catch (_error) {
      setRefreshError("Unable to refresh events.");
    } finally {
      setIsRefreshingEvents(false);
    }
  };

  useEffect(() => {
    if (!config?.display?.theme) {
      return;
    }
    const root = document.documentElement;
    root.style.setProperty("--bg-start", config.display.theme.background);
    root.style.setProperty("--bg-end", config.display.theme.background);
    root.style.setProperty("--ink", config.display.theme.text);
    root.style.setProperty("--accent", config.display.theme.accent);
  }, [config]);

  const timeFormat = config?.display?.timeFormat || "12h";
  const mergeCalendars = config?.display?.mergeCalendars ?? true;
  const backfillPast = config?.display?.backfillPast || {};
  const backfillDebounceSeconds = config?.display?.backfillPastDebounceSeconds ?? 60;
  const defaultView = viewLabels[config?.display?.defaultView]
    ? config.display.defaultView
    : "month";
  const weatherLocation = config?.weather?.location?.value || "Weather";
  const weatherUnitsRaw = weather?.units || config?.weather?.units || "imperial";
  const weatherUnits = weatherUnitsRaw === "metric" ? "C" : "F";
  const weatherSummary =
    weather?.current?.temp !== undefined && weather?.current?.temp !== null
      ? `${Math.round(weather.current.temp)}°${weatherUnits}`
      : null;
  const weatherDescription = weather?.current?.description || "";
  const weatherIcon = weather?.current?.icon || "";
  const weatherLocationName = weather?.location?.name || weatherLocation;
  const useWeatherIcons = config?.weather?.showIcons ?? true;
  const weatherUpdatedAt = weather?.updatedAt
    ? new Date(weather.updatedAt).toLocaleString()
    : "";
  const weatherObservedAt = weather?.current?.time
    ? new Date(weather.current.time).toLocaleString()
    : "";
  const weatherCurrent = weather?.current || {};
  const weatherToday = weather?.today || {};
  const weatherForecast = weather?.forecast || [];

  const formatPercent = (value) =>
    typeof value === "number" ? `${Math.round(value)}%` : "";

  const formatDewpoint = (dewpoint) => {
    if (!dewpoint || typeof dewpoint.value !== "number") {
      return "";
    }
    let unit = "";
    if (dewpoint.unitCode?.includes("degF")) {
      unit = "F";
    } else if (dewpoint.unitCode?.includes("degC")) {
      unit = "C";
    }
    return `${Math.round(dewpoint.value)}°${unit}`;
  };

  const formatWind = (speed, direction) => {
    if (!speed && !direction) {
      return "";
    }
    if (speed && direction) {
      return `${direction} ${speed}`;
    }
    return speed || direction;
  };

  const formatTemp = (value) =>
    value !== undefined && value !== null ? `${Math.round(value)}°${weatherUnits}` : "";

  const weatherHighLow =
    weatherToday?.min !== undefined && weatherToday?.max !== undefined
      ? `${formatTemp(weatherToday.max)} / ${formatTemp(weatherToday.min)}`
      : "";

  const weatherMetrics = [
    { label: "High/Low", value: weatherHighLow },
    { label: "Wind", value: formatWind(weatherCurrent.windSpeed, weatherCurrent.windDirection) },
    { label: "Humidity", value: formatPercent(weatherCurrent.relativeHumidity) },
    {
      label: "Precip",
      value: formatPercent(weatherCurrent.probabilityOfPrecipitation)
    },
    { label: "Dew point", value: formatDewpoint(weatherCurrent.dewpoint) },
    {
      label: "Daytime",
      value:
        typeof weatherCurrent.isDaytime === "boolean"
          ? weatherCurrent.isDaytime
            ? "Day"
            : "Night"
          : ""
    },
    { label: "Observed", value: weatherObservedAt }
  ].filter((item) => item.value);
  const viewportWidth = viewportSize.width;
  const isCompactHeader = viewportWidth <= 1200;
  const isNarrowPortrait =
    viewportSize.height >= viewportSize.width && viewportWidth <= 1200;
  const dateLabel = formatDate(now, isCompactHeader ? "short" : "long");
  const forecastDays = viewportWidth <= 1000 ? 5 : 7;
  const sanitizeDescription = (value = "") => {
    if (!value) {
      return "";
    }
    let text = value.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<\/p>/gi, "\n");
    text = text.replace(/<[^>]+>/g, "");
    text = text.replace(/&nbsp;/gi, " ");
    text = text.replace(/&amp;/gi, "&");
    text = text.replace(/&lt;/gi, "<");
    text = text.replace(/&gt;/gi, ">");
    text = text.replace(/\n{3,}/g, "\n\n");
    return text.trim();
  };

  const getLocationLink = (value = "") => {
    const trimmed = value.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      return null;
    }
    try {
      const url = new URL(trimmed);
      return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null;
    } catch (_error) {
      return null;
    }
  };

  const extractMeetingLinks = (event) => {
    const sources = [event?.location, event?.description].filter(Boolean).join(" ");
    const urlRegex = /https?:\/\/[^\s<]+/gi;
    const matches = sources.match(urlRegex) || [];
    const uniq = Array.from(new Set(matches.map((link) => link.replace(/[),.]+$/g, ""))));
    return uniq.filter((link) => {
      try {
        const url = new URL(link);
        const host = url.hostname.toLowerCase();
        return host.includes("zoom.us") || host.includes("meet.google.com");
      } catch (_error) {
        return false;
      }
    });
  };

  const getMeetingLinkLabel = (link) => {
    try {
      const host = new URL(link).hostname.toLowerCase();
      if (host.includes("zoom.us")) {
        return "Zoom Link";
      }
      if (host.includes("meet.google.com")) {
        return "Google Meeting Link";
      }
    } catch (_error) {
      return "Meeting Link";
    }
    return "Meeting Link";
  };

  const formatEventDateRange = (event) => {
    if (!event?.start) {
      return "";
    }
    const start = new Date(event.start);
    const end = event.end ? new Date(event.end) : null;
    if (Number.isNaN(start.getTime())) {
      return "";
    }
    const dateOptions = { weekday: "short", month: "short", day: "numeric" };
    const startDateLabel = start.toLocaleDateString([], dateOptions);
    if (event.allDay) {
      if (end && !Number.isNaN(end.getTime()) && end > start) {
        const endDate = new Date(end);
        endDate.setDate(endDate.getDate() - 1);
        const endDateLabel = endDate.toLocaleDateString([], dateOptions);
        if (endDateLabel !== startDateLabel) {
          return `${startDateLabel} - ${endDateLabel} · All day`;
        }
      }
      return `${startDateLabel} · All day`;
    }
    const timeLabel = formatEventRange(event, timeFormat);
    return `${startDateLabel} · ${timeLabel}`;
  };

  const formatUpcomingRange = (event) => {
    if (!event?.start) {
      return "";
    }
    const start = new Date(event.start);
    const endRaw = event.end ? new Date(event.end) : null;
    if (Number.isNaN(start.getTime())) {
      return "";
    }
    const dateOptions = { month: "short", day: "numeric" };
    const startLabel = start.toLocaleDateString([], dateOptions);
    if (isMultiDayEvent(event) && endRaw && !Number.isNaN(endRaw.getTime())) {
      const end = new Date(endRaw);
      if (event.allDay) {
        end.setDate(end.getDate() - 1);
      }
      const endLabel = end.toLocaleDateString([], dateOptions);
      if (endLabel !== startLabel) {
        return `${startLabel} - ${endLabel}`;
      }
    }
    if (event.allDay) {
      return startLabel;
    }
    return formatEventTime(event, timeFormat);
  };

  const renderEventDots = (event) => {
    const colors = getEventCalendarColors(event);
    if (!colors.length) {
      return null;
    }
    return (
      <span className="display__event-dot-group">
        {colors.map((color, index) => (
          <span
            key={`${color}-${index}`}
            className="display__event-dot"
            style={{ backgroundColor: color }}
          />
        ))}
      </span>
    );
  };

  const getEventPrimaryColor = (event) => getEventCalendarColors(event)[0];

  const meetingLinks = useMemo(
    () => (activeEvent ? extractMeetingLinks(activeEvent) : []),
    [activeEvent]
  );
  const sanitizedDescription = useMemo(
    () => (activeEvent ? sanitizeDescription(activeEvent.description) : ""),
    [activeEvent]
  );
  const activeEventLabels = useMemo(
    () => (activeEvent ? getEventCalendarLabels(activeEvent) : []),
    [activeEvent]
  );
  const activeEventLabel =
    activeEventLabels.length > 0 ? activeEventLabels.join(", ") : "Calendar";

  const sortedEvents = useMemo(() => {
    const events = eventsCache?.events || [];
    const normalized = mergeCalendars ? mergeCalendarEvents(events) : [...events];
    return normalized.sort((a, b) => getEventStartMs(a) - getEventStartMs(b));
  }, [eventsCache, mergeCalendars]);

  const activeMonthDate = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() + monthOffset, 1),
    [now, monthOffset]
  );

  const weekStartDate = useMemo(() => {
    const baseDate = view === "fourWeek" ? fourWeekAnchorDate : selectedDate;
    return getWeekStart(baseDate);
  }, [fourWeekAnchorDate, selectedDate, view]);

  const weekEndDate = useMemo(() => {
    const end = new Date(weekStartDate);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [weekStartDate]);

  const weekLabel = useMemo(
    () => formatWeekLabel(weekStartDate, weekEndDate),
    [weekStartDate, weekEndDate]
  );

  const fourWeekEndDate = useMemo(() => {
    const end = new Date(weekStartDate);
    end.setDate(end.getDate() + 27);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [weekStartDate]);

  const fourWeekLabel = useMemo(
    () => formatWeekLabel(weekStartDate, fourWeekEndDate),
    [weekStartDate, fourWeekEndDate]
  );

  const todayKey = useMemo(() => toLocalDateKey(now), [now]);
  const selectedKey = useMemo(() => toLocalDateKey(selectedDate), [selectedDate]);
  const selectedEvents = useMemo(
    () => sortedEvents.filter((event) => eventOccursOnDateKey(event, selectedKey)),
    [sortedEvents, selectedKey]
  );

  const allDayEvents = useMemo(
    () => selectedEvents.filter((event) => event.allDay),
    [selectedEvents]
  );

  const dailyWindow = useMemo(() => {
    const startHour = DAILY_WINDOW_START;
    const endHour = startHour + DAILY_WINDOW_HOURS;
    const slots = (DAILY_WINDOW_HOURS * 60) / DAILY_SLOT_MINUTES;
    const hours = [];
    for (let hour = startHour; hour < endHour; hour += 1) {
      hours.push(hour);
    }
    return { startHour, endHour, slots, hours };
  }, []);

  const timedEvents = useMemo(() => {
    const rangeStart = dailyWindow.startHour * 60;
    const rangeEnd = dailyWindow.endHour * 60;

    const events = selectedEvents
      .filter((event) => !event.allDay)
      .map((event) => {
        const startMs = getEventStartMs(event);
        let endMs = getEventEndMs(event);
        if (!endMs || endMs <= startMs) {
          endMs = startMs + 60 * 60 * 1000;
        }
        const startDate = new Date(startMs);
        const endDate = new Date(endMs);
        const startMinutes = getMinutesIntoDay(startDate);
        const endMinutes = getMinutesIntoDay(endDate);
        if (endMinutes <= rangeStart || startMinutes > rangeEnd) {
          return null;
        }
        const clampedStart = Math.max(startMinutes, rangeStart);
        const clampedEnd = Math.min(endMinutes, rangeEnd);
        const startSlot = Math.floor((clampedStart - rangeStart) / DAILY_SLOT_MINUTES);
        const endSlot = Math.max(
          startSlot + 1,
          Math.ceil((clampedEnd - rangeStart) / DAILY_SLOT_MINUTES)
        );
        return {
          ...event,
          timeLabel: formatEventRange(event, timeFormat),
          startSlot,
          slotCount: endSlot - startSlot
        };
      })
      .filter(Boolean);

    return events.sort((a, b) => a.startSlot - b.startSlot);
  }, [selectedEvents, timeFormat, dailyWindow]);
  const isDayEmpty = !allDayEvents.length && !timedEvents.length;

  useEffect(() => {
    if (view !== "month") {
      return;
    }
    const sameMonth =
      selectedDate.getFullYear() === activeMonthDate.getFullYear() &&
      selectedDate.getMonth() === activeMonthDate.getMonth();
    if (!sameMonth) {
      setSelectedDate(
        new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth(), 1)
      );
    }
  }, [activeMonthDate, selectedDate, view]);

  useEffect(() => {
    if (view !== "fourWeek") {
      return;
    }
    if (selectedDate < weekStartDate || selectedDate > fourWeekEndDate) {
      setFourWeekAnchorDate(getWeekStart(selectedDate));
    }
  }, [fourWeekEndDate, selectedDate, view, weekStartDate]);

  useEffect(() => {
    if (view !== "month" && view !== "week" && view !== "fourWeek") {
      return;
    }
    const rangeMax = eventsCache?.range?.timeMax;
    if (!rangeMax) {
      return;
    }
    const rangeEnd = new Date(rangeMax);
    if (Number.isNaN(rangeEnd.getTime())) {
      return;
    }
    const targetEnd =
      view === "month"
        ? new Date(
            activeMonthDate.getFullYear(),
            activeMonthDate.getMonth() + 1,
            0,
            23,
            59,
            59,
            999
          )
        : view === "week"
          ? new Date(weekEndDate)
          : new Date(fourWeekEndDate);
    if (targetEnd <= rangeEnd) {
      if (rangeRequest) {
        setRangeRequest(null);
      }
      return;
    }
    const targetIso = targetEnd.toISOString();
    if (rangeRequest === targetIso) {
      return;
    }
    setRangeRequest(targetIso);
    const extend = async () => {
      try {
        const response = await fetch("/api/events/extend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeMax: targetIso })
        });
        if (!response.ok) {
          return;
        }
        const eventsResponse = await fetch("/api/events");
        const data = await eventsResponse.json();
        if (eventsResponse.ok) {
          setEventsCache(data);
        }
      } catch (_error) {
        // Ignore extension failures; auto-sync will still refresh.
      }
    };
    extend();
  }, [
    activeMonthDate,
    eventsCache?.range?.timeMax,
    rangeRequest,
    view,
    weekEndDate,
    fourWeekEndDate
  ]);

  useEffect(() => {
    if (view !== "month" && view !== "week" && view !== "fourWeek") {
      return;
    }
    const shouldBackfill =
      view === "month"
        ? backfillPast.month
        : view === "week"
          ? backfillPast.week
          : backfillPast.fourWeek;
    if (!shouldBackfill) {
      return;
    }
    const rangeMin = eventsCache?.range?.timeMin;
    if (!rangeMin) {
      return;
    }
    const rangeStart = new Date(rangeMin);
    if (Number.isNaN(rangeStart.getTime())) {
      return;
    }
    const targetStart =
      view === "month"
        ? new Date(activeMonthDate.getFullYear(), activeMonthDate.getMonth(), 1)
        : new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate());
    if (targetStart >= rangeStart) {
      return;
    }
    const targetIso = targetStart.toISOString();
    const requestKey = `${targetIso}|${rangeMin}`;
    const nowMs = Date.now();
    if (
      lastBackfillRef.current.key === requestKey &&
      nowMs - lastBackfillRef.current.at < backfillDebounceSeconds * 1000
    ) {
      return;
    }
    lastBackfillRef.current = { key: requestKey, at: nowMs };
    const extend = async () => {
      try {
        const response = await fetch("/api/events/extend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeMin: targetIso })
        });
        if (!response.ok) {
          return;
        }
        const eventsResponse = await fetch("/api/events");
        const data = await eventsResponse.json();
        if (eventsResponse.ok) {
          setEventsCache(data);
        }
      } catch (_error) {
        // Ignore extension failures; auto-sync will still refresh.
      }
    };
    extend();
  }, [
    activeMonthDate,
    backfillPast.fourWeek,
    backfillPast.month,
    backfillPast.week,
    backfillDebounceSeconds,
    eventsCache?.range?.timeMin,
    view,
    weekStartDate
  ]);

  const upcomingEvents = useMemo(() => {
    const nowMs = now.getTime();
    const windowEnd = nowMs + 30 * 24 * 60 * 60 * 1000;
    return sortedEvents.filter((event) => {
      const startMs = getEventStartMs(event);
      const endMs = getEventEndMs(event);
      if (startMs >= nowMs && startMs <= windowEnd) {
        return true;
      }
      if (endMs && endMs > nowMs && startMs < nowMs) {
        return true;
      }
      return false;
    });
  }, [sortedEvents, now]);

  const monthCells = useMemo(() => {
    const monthStart = new Date(
      activeMonthDate.getFullYear(),
      activeMonthDate.getMonth(),
      1
    );
    const monthEnd = new Date(
      activeMonthDate.getFullYear(),
      activeMonthDate.getMonth() + 1,
      0
    );
    const daysInMonth = monthEnd.getDate();
    const firstDay = monthStart.getDay();
    const cells = [];
    for (let i = 0; i < firstDay; i += 1) {
      cells.push({ key: `empty-${i}`, day: null });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(
        activeMonthDate.getFullYear(),
        activeMonthDate.getMonth(),
        day
      );
      const key = toLocalDateKey(date);
      const events = sortedEvents.filter((event) => eventOccursOnDateKey(event, key));
      cells.push({ key, day, date, events });
    }
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const remaining = 7 - remainder;
      for (let i = 0; i < remaining; i += 1) {
        cells.push({ key: `empty-tail-${i}`, day: null });
      }
    }
    return cells;
  }, [activeMonthDate, sortedEvents]);

  const fourWeekCells = useMemo(() => {
    const cells = [];
    for (let i = 0; i < 28; i += 1) {
      const date = new Date(weekStartDate);
      date.setDate(weekStartDate.getDate() + i);
      const key = toLocalDateKey(date);
      const events = sortedEvents.filter((event) => eventOccursOnDateKey(event, key));
      cells.push({ key, date, events });
    }
    return cells;
  }, [sortedEvents, weekStartDate]);

  const panelLabel =
    view === "month"
      ? formatMonthLabel(activeMonthDate)
      : view === "week"
        ? weekLabel
        : view === "fourWeek"
          ? fourWeekLabel
          : "Upcoming";

  const weekCells = useMemo(() => {
    const cells = [];
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(weekStartDate);
      date.setDate(weekStartDate.getDate() + i);
      const key = toLocalDateKey(date);
      const events = sortedEvents.filter((event) => eventOccursOnDateKey(event, key));
      cells.push({ key, date, events });
    }
    return cells;
  }, [sortedEvents, weekStartDate]);

  const monthWeekRows = useMemo(
    () =>
      chunkArray(monthCells, 7).map((week) => ({
        cells: week,
        multiDayRows: buildMultiDayRows(
          week.map((cell) => cell.date || null),
          sortedEvents
        )
      })),
    [monthCells, sortedEvents]
  );

  const fourWeekRows = useMemo(
    () =>
      chunkArray(fourWeekCells, 7).map((week) => ({
        cells: week,
        multiDayRows: buildMultiDayRows(
          week.map((cell) => cell.date || null),
          sortedEvents
        )
      })),
    [fourWeekCells, sortedEvents]
  );

  const weekRows = useMemo(
    () => [
      {
        cells: weekCells,
        multiDayRows: buildMultiDayRows(
          weekCells.map((cell) => cell.date || null),
          sortedEvents
        )
      }
    ],
    [weekCells, sortedEvents]
  );
  const monthRowCount = monthWeekRows.length;
  const fourWeekRowCount = fourWeekRows.length;

  useLayoutEffect(() => {
    if (view !== "month") {
      return;
    }
    const container = monthWeeksRef.current;
    if (!container) {
      return;
    }
    const updateCapacities = () => {
      const { capacities: nextCapacities, dayWidth } = measureDayCapacities(
        container,
        monthMeasureRef.current
      );
      setMonthCapacities((prev) =>
        areCapacityMapsEqual(prev, nextCapacities) ? prev : nextCapacities
      );
      if (dayWidth && dayWidth !== monthMeasureWidth) {
        setMonthMeasureWidth(dayWidth);
      }
    };
    updateCapacities();
    const observer = new ResizeObserver(updateCapacities);
    observer.observe(container);
    return () => observer.disconnect();
  }, [view, monthWeekRows, viewportSize.width, viewportSize.height, monthMeasureWidth]);

  useLayoutEffect(() => {
    if (view !== "fourWeek") {
      return;
    }
    const container = fourWeekWeeksRef.current;
    if (!container) {
      return;
    }
    const updateCapacities = () => {
      const { capacities: nextCapacities, dayWidth } = measureDayCapacities(
        container,
        fourWeekMeasureRef.current
      );
      setFourWeekCapacities((prev) =>
        areCapacityMapsEqual(prev, nextCapacities) ? prev : nextCapacities
      );
      if (dayWidth && dayWidth !== fourWeekMeasureWidth) {
        setFourWeekMeasureWidth(dayWidth);
      }
    };
    updateCapacities();
    const observer = new ResizeObserver(updateCapacities);
    observer.observe(container);
    return () => observer.disconnect();
  }, [view, fourWeekRows, viewportSize.width, viewportSize.height, fourWeekMeasureWidth]);

  useEffect(() => {
    if (!debugEvents) {
      return;
    }
    if (view === "month") {
      const hiddenDays = [];
      monthWeekRows.forEach((week) => {
        week.cells.forEach((cell) => {
          if (!cell.day) {
            return;
          }
          const events = (cell.events || []).filter(
            (event) => !isMultiDayEvent(event)
          );
          const limitDetails = getDayEventLimitDebug(
            monthRowCount,
            week.multiDayRows.length,
            isNarrowPortrait
          );
          const measuredCapacity = monthCapacities[cell.key];
          const visibleLimit = getDayEventLimit(
            monthRowCount,
            week.multiDayRows.length,
            isNarrowPortrait,
            measuredCapacity
          );
          const hiddenCount = Math.max(0, events.length - visibleLimit);
          if (hiddenCount > 0) {
            const limitSource =
              typeof measuredCapacity === "number"
                ? "measured capacity"
                : limitDetails.portraitClamp
                  ? "portrait clamp"
                  : "baseLimit - multiDayRows";
            const dayEl = document.querySelector(
              `.display__day[data-day-key="${cell.key}"]`
            );
            const eventsEl = dayEl?.querySelector(".display__day-events");
            const dayRect = dayEl?.getBoundingClientRect();
            const eventsRect = eventsEl?.getBoundingClientRect();
            const dayStyles = dayEl ? window.getComputedStyle(dayEl) : null;
            const eventsStyles = eventsEl ? window.getComputedStyle(eventsEl) : null;
            const dayNumberEl = dayEl?.querySelector(".display__day-number");
            const dayNumberRect = dayNumberEl?.getBoundingClientRect();
            const dayNumberStyles = dayNumberEl
              ? window.getComputedStyle(dayNumberEl)
              : null;
            const paddingTop = parsePx(dayStyles?.paddingTop);
            const paddingBottom = parsePx(dayStyles?.paddingBottom);
            const dayGap = parsePx(dayStyles?.rowGap || dayStyles?.gap);
            const eventsGap = parsePx(eventsStyles?.rowGap || eventsStyles?.gap);
            const eventsMarginTop = parsePx(eventsStyles?.marginTop);
            const multiRows = Number.parseInt(dayEl?.dataset.multiRows || "0", 10);
            const fixedMarginTop = multiRows > 0 ? eventsMarginTop : 0;
            const eventsTopOffset =
              dayRect && eventsRect ? eventsRect.top - dayRect.top - paddingTop : null;
            const availableHeight =
              dayRect && eventsRect
                ? dayRect.height - paddingTop - paddingBottom - eventsTopOffset
                : null;
            const availableHeightUsed =
              dayRect && dayNumberRect
                ? Math.max(
                    0,
                    dayRect.height -
                      paddingTop -
                      paddingBottom -
                      dayNumberRect.height -
                      dayGap -
                      fixedMarginTop
                  )
                : null;
            const measureDay = monthMeasureRef.current?.querySelector(
              `.display__event-measure-day[data-day-key="${cell.key}"]`
            );
            const chips = measureDay
              ? Array.from(measureDay.querySelectorAll(".display__event-chip"))
              : eventsEl
                ? Array.from(eventsEl.querySelectorAll(".display__event-chip"))
                : [];
            const chipHeights = chips.map((chip) => chip.getBoundingClientRect().height);
            let used = 0;
            let computedCapacity = 0;
            chipHeights.forEach((height) => {
              const nextUsed = used === 0 ? height : used + eventsGap + height;
              if (nextUsed <= availableHeight) {
                used = nextUsed;
                computedCapacity += 1;
              }
            });
            hiddenDays.push({
              key: cell.key,
              date: cell.date?.toDateString?.() || "",
              visibleLimit,
              baseLimit: limitDetails.baseLimit,
              rawLimit: limitDetails.rawLimit,
              portraitClamp: limitDetails.portraitClamp,
              reason: limitDetails.reason,
              limitSource,
              measuredCapacity: measuredCapacity ?? null,
              totalEvents: events.length,
              hiddenCount,
              multiDayRows: week.multiDayRows.length,
              titles: events.slice(0, 5).map((event) => event.summary),
              dayHeight: dayRect?.height ?? null,
              dayPaddingTop: paddingTop || null,
              dayPaddingBottom: paddingBottom || null,
              dayGap,
              dayNumberHeight: dayNumberRect?.height ?? null,
              dayNumberMarginTop: parsePx(dayNumberStyles?.marginTop) || null,
              dayNumberMarginBottom: parsePx(dayNumberStyles?.marginBottom) || null,
              eventsTopOffset,
              eventsHeight: eventsRect?.height ?? null,
              availableHeight,
              availableHeightUsed,
              fixedMarginTop,
              eventsMarginTop,
              eventsGap,
              eventChipCount: chipHeights.length,
              maxChipHeight: chipHeights.length ? Math.max(...chipHeights) : 0,
              avgChipHeight: chipHeights.length
                ? Number(
                    (
                      chipHeights.reduce((sum, height) => sum + height, 0) /
                      chipHeights.length
                    ).toFixed(2)
                  )
                : 0,
              computedCapacity,
              chipHeights: chipHeights.map((height) => Number(height.toFixed(2))),
              usedHeight: Number(used.toFixed(2)),
              measureDayWidth: monthMeasureWidth
            });
          }
        });
      });
      console.groupCollapsed(
        `[calendar debug] month hidden days: ${hiddenDays.length}`
      );
      console.table(hiddenDays);
      console.log({
        monthRowCount,
        isNarrowPortrait,
        viewportWidth: viewportSize.width,
        viewportHeight: viewportSize.height
      });
      console.groupEnd();
      return;
    }
    if (view === "fourWeek") {
      const hiddenDays = [];
      fourWeekRows.forEach((week) => {
        week.cells.forEach((cell) => {
          const events = (cell.events || []).filter(
            (event) => !isMultiDayEvent(event)
          );
          const limitDetails = getDayEventLimitDebug(
            fourWeekRowCount,
            week.multiDayRows.length,
            isNarrowPortrait
          );
          const measuredCapacity = fourWeekCapacities[cell.key];
          const visibleLimit = getDayEventLimit(
            fourWeekRowCount,
            week.multiDayRows.length,
            isNarrowPortrait,
            measuredCapacity
          );
          const hiddenCount = Math.max(0, events.length - visibleLimit);
          if (hiddenCount > 0) {
            const limitSource =
              typeof measuredCapacity === "number"
                ? "measured capacity"
                : limitDetails.portraitClamp
                  ? "portrait clamp"
                  : "baseLimit - multiDayRows";
            const dayEl = document.querySelector(
              `.display__day[data-day-key="${cell.key}"]`
            );
            const eventsEl = dayEl?.querySelector(".display__day-events");
            const dayRect = dayEl?.getBoundingClientRect();
            const eventsRect = eventsEl?.getBoundingClientRect();
            const dayStyles = dayEl ? window.getComputedStyle(dayEl) : null;
            const eventsStyles = eventsEl ? window.getComputedStyle(eventsEl) : null;
            const dayNumberEl = dayEl?.querySelector(".display__day-number");
            const dayNumberRect = dayNumberEl?.getBoundingClientRect();
            const dayNumberStyles = dayNumberEl
              ? window.getComputedStyle(dayNumberEl)
              : null;
            const paddingTop = parsePx(dayStyles?.paddingTop);
            const paddingBottom = parsePx(dayStyles?.paddingBottom);
            const dayGap = parsePx(dayStyles?.rowGap || dayStyles?.gap);
            const eventsGap = parsePx(eventsStyles?.rowGap || eventsStyles?.gap);
            const eventsMarginTop = parsePx(eventsStyles?.marginTop);
            const multiRows = Number.parseInt(dayEl?.dataset.multiRows || "0", 10);
            const fixedMarginTop = multiRows > 0 ? eventsMarginTop : 0;
            const eventsTopOffset =
              dayRect && eventsRect ? eventsRect.top - dayRect.top - paddingTop : null;
            const availableHeight =
              dayRect && eventsRect
                ? dayRect.height - paddingTop - paddingBottom - eventsTopOffset
                : null;
            const availableHeightUsed =
              dayRect && dayNumberRect
                ? Math.max(
                    0,
                    dayRect.height -
                      paddingTop -
                      paddingBottom -
                      dayNumberRect.height -
                      dayGap -
                      fixedMarginTop
                  )
                : null;
            const measureDay = fourWeekMeasureRef.current?.querySelector(
              `.display__event-measure-day[data-day-key="${cell.key}"]`
            );
            const chips = measureDay
              ? Array.from(measureDay.querySelectorAll(".display__event-chip"))
              : eventsEl
                ? Array.from(eventsEl.querySelectorAll(".display__event-chip"))
                : [];
            const chipHeights = chips.map((chip) => chip.getBoundingClientRect().height);
            let used = 0;
            let computedCapacity = 0;
            chipHeights.forEach((height) => {
              const nextUsed = used === 0 ? height : used + eventsGap + height;
              if (nextUsed <= availableHeight) {
                used = nextUsed;
                computedCapacity += 1;
              }
            });
            hiddenDays.push({
              key: cell.key,
              date: cell.date?.toDateString?.() || "",
              visibleLimit,
              baseLimit: limitDetails.baseLimit,
              rawLimit: limitDetails.rawLimit,
              portraitClamp: limitDetails.portraitClamp,
              reason: limitDetails.reason,
              limitSource,
              measuredCapacity: measuredCapacity ?? null,
              totalEvents: events.length,
              hiddenCount,
              multiDayRows: week.multiDayRows.length,
              titles: events.slice(0, 5).map((event) => event.summary),
              dayHeight: dayRect?.height ?? null,
              dayPaddingTop: paddingTop || null,
              dayPaddingBottom: paddingBottom || null,
              dayGap,
              dayNumberHeight: dayNumberRect?.height ?? null,
              dayNumberMarginTop: parsePx(dayNumberStyles?.marginTop) || null,
              dayNumberMarginBottom: parsePx(dayNumberStyles?.marginBottom) || null,
              eventsTopOffset,
              eventsHeight: eventsRect?.height ?? null,
              availableHeight,
              availableHeightUsed,
              fixedMarginTop,
              eventsMarginTop,
              eventsGap,
              eventChipCount: chipHeights.length,
              maxChipHeight: chipHeights.length ? Math.max(...chipHeights) : 0,
              avgChipHeight: chipHeights.length
                ? Number(
                    (
                      chipHeights.reduce((sum, height) => sum + height, 0) /
                      chipHeights.length
                    ).toFixed(2)
                  )
                : 0,
              computedCapacity,
              chipHeights: chipHeights.map((height) => Number(height.toFixed(2))),
              usedHeight: Number(used.toFixed(2)),
              measureDayWidth: fourWeekMeasureWidth
            });
          }
        });
      });
      console.groupCollapsed(
        `[calendar debug] fourWeek hidden days: ${hiddenDays.length}`
      );
      console.table(hiddenDays);
      console.log({
        fourWeekRowCount,
        isNarrowPortrait,
        viewportWidth: viewportSize.width,
        viewportHeight: viewportSize.height
      });
      console.groupEnd();
    }
  }, [
    debugEvents,
    view,
    monthWeekRows,
    fourWeekRows,
    monthRowCount,
    fourWeekRowCount,
    monthCapacities,
    fourWeekCapacities,
    monthMeasureWidth,
    fourWeekMeasureWidth,
    isNarrowPortrait,
    viewportSize.width,
    viewportSize.height
  ]);

 

  return (
    <main className="display">
      <header className="display__header">
        <div className="display__date-time">
          <div className="display__date-time-main">
            <p className="display__date">{dateLabel}</p>
            <p className="display__time">{formatTime(now, timeFormat)}</p>
          </div>
          {error ? <p className="display__subtle">{error}</p> : null}
          {refreshError ? <p className="display__subtle">{refreshError}</p> : null}
        </div>
        <div
          className="display__weather"
          role="button"
          tabIndex={0}
          aria-label="Open weather details"
          onClick={() => setWeatherModalOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setWeatherModalOpen(true);
            }
          }}
        >
          <div className="display__weather-main">
            {useWeatherIcons && weatherIcon ? (
              <img
                className="display__weather-icon"
                src={weatherIcon}
                alt={weatherDescription || "Weather icon"}
              />
            ) : null}
            <div className="display__weather-details">
              {weatherSummary ? (
                <>
                  <strong>{weatherSummary}</strong>
                  <span>{weatherDescription}</span>
                </>
              ) : (
                <span>{weatherError || `${weatherLocationName} · ${weatherUnits}`}</span>
              )}
            </div>
          </div>
          {weather?.forecast?.length ? (
            <div
              className="display__forecast"
              style={{ "--forecast-columns": forecastDays }}
            >
              {weather.forecast.slice(0, forecastDays).map((day) => {
                const date = day.date ? new Date(`${day.date}T00:00:00`) : null;
                const dayLabel =
                  date && !Number.isNaN(date.getTime())
                    ? date.toLocaleDateString([], { weekday: "short" })
                    : "";
                const high =
                  day.max !== undefined && day.max !== null
                    ? `${Math.round(day.max)}°`
                    : "";
                    const low =
                      day.min !== undefined && day.min !== null
                        ? `${Math.round(day.min)}°`
                        : "";
                    const temps = high && low ? `${high}/${low}` : high || low;
                    const badge = getForecastBadge(day.description);
                    const iconSrc = day.icon || "";
                    return (
                      <div key={day.date} className="display__forecast-day">
                        <span className="display__forecast-name">{dayLabel}</span>
                        {useWeatherIcons && iconSrc ? (
                          <img
                            className="display__forecast-icon"
                            src={iconSrc}
                            alt={day.description || "Forecast"}
                            title={day.description || "Forecast"}
                          />
                        ) : (
                          <span
                            className={`display__forecast-badge display__forecast-badge--${badge.tone}`}
                            title={day.description || "Forecast"}
                          >
                            {badge.label}
                          </span>
                        )}
                        <span className="display__forecast-temps">{temps}</span>
                      </div>
                    );
                  })}
            </div>
          ) : null}
        </div>
      </header>
      <section
        className={`display__content ${view === "chores" ? "display__content--chores" : ""} ${
          isDayEmpty ? "display__content--day-empty" : ""
        }`}
      >
        <div className="display__panel">
          <div className="display__month-header">
            <div className="display__month-label">{panelLabel}</div>
            {view === "month" ? (
              <div className="display__month-actions">
                <button
                  type="button"
                  className="display__nav-button"
                  onClick={() => setMonthOffset((prev) => prev - 1)}
                  aria-label="Previous month"
                >
                  &lt;
                </button>
                <button
                  type="button"
                  className="display__nav-button"
                  onClick={() => setMonthOffset((prev) => prev + 1)}
                  aria-label="Next month"
                >
                  &gt;
                </button>
              </div>
            ) : view === "week" ? (
              <div className="display__month-actions">
                <button
                  type="button"
                  className="display__nav-button"
                  onClick={() => shiftWeek(-1)}
                  aria-label="Previous week"
                >
                  &lt;
                </button>
                <button
                  type="button"
                  className="display__nav-button"
                  onClick={() => shiftWeek(1)}
                  aria-label="Next week"
                >
                  &gt;
                </button>
              </div>
            ) : view === "fourWeek" ? (
              <div className="display__month-actions">
                <button
                  type="button"
                  className="display__nav-button"
                  onClick={() => shiftWeek(-1)}
                  aria-label="Previous week"
                >
                  &lt;
                </button>
                <button
                  type="button"
                  className="display__nav-button"
                  onClick={() => shiftWeek(1)}
                  aria-label="Next week"
                >
                  &gt;
                </button>
              </div>
            ) : null}
            <div className="display__toggles">
              {Object.keys(viewLabels).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={
                    view === key ? "display__toggle display__toggle--active" : "display__toggle"
                  }
                  onClick={() => handleViewChange(key)}
                >
                  {viewLabels[key].replace(" View", "")}
                </button>
              ))}
              <button
                type="button"
                className="display__refresh-button"
                onClick={handleRefreshEvents}
                disabled={isRefreshingEvents}
                aria-label="Refresh events"
                title="Refresh events"
              >
                ↻
              </button>
            </div>
          </div>
          {view === "month" ? (
            <div className="display__month">
              <div className="display__calendar">
                <div className="display__calendar-header">
                  {dayLabels.map((label) => (
                    <div key={label} className="display__day-label">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="display__calendar-weeks" ref={monthWeeksRef}>
                  {monthWeekRows.map((week, weekIndex) => (
                    <div
                      key={`month-week-${weekIndex}`}
                      className={`display__week-row${
                        week.multiDayRows.length ? " display__week-row--has-multi" : ""
                      }`}
                      style={{
                        "--multi-rows": week.multiDayRows.length,
                        "--multi-gaps": Math.max(0, week.multiDayRows.length - 1)
                      }}
                    >
                      <div className="display__calendar-grid display__week-days">
                        {week.cells.map((cell) => {
                          if (!cell.day) {
                            return (
                              <div
                                key={cell.key}
                                className="display__day display__day--empty"
                              />
                            );
                          }
                          const isToday = toLocalDateKey(cell.date) === todayKey;
                          const isSelected = toLocalDateKey(cell.date) === selectedKey;
                          const events = (cell.events || []).filter(
                            (event) => !isMultiDayEvent(event)
                          );
          const visibleLimit = getDayEventLimit(
            monthRowCount,
            week.multiDayRows.length,
            isNarrowPortrait,
            monthCapacities[cell.key]
          );
                          const visibleEvents = events.slice(0, visibleLimit);
                          const hiddenCount = Math.max(0, events.length - visibleLimit);
                          return (
                            <div
                              key={cell.key}
                              data-day-key={cell.key}
                              data-multi-rows={week.multiDayRows.length}
                              className={
                                isToday
                                  ? "display__day display__day--today"
                                  : isSelected
                                    ? "display__day display__day--selected"
                                    : "display__day"
                              }
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedDate(cell.date)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  setSelectedDate(cell.date);
                                }
                              }}
                            >
                              <div className="display__day-number">{cell.day}</div>
                              <div className="display__day-events">
                                {visibleEvents.map((event) => (
                                  <div key={event.id} className="display__event-chip">
                                    {renderEventDots(event)}
                                    <span className="display__event-chip-text">
                                      {!event.allDay && !isMultiDayEvent(event) ? (
                                        <span className="display__event-chip-time">
                                          {formatEventTime(event, timeFormat)}
                                        </span>
                                      ) : null}
                                      <span className="display__event-chip-title">
                                        {event.summary}
                                      </span>
                                    </span>
                                  </div>
                                ))}
                                {hiddenCount > 0 ? (
                                  <div className="display__event-more">
                                    +{hiddenCount} more
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {week.multiDayRows.length ? (
                        <div className="display__week-multi display__week-multi--lined">
                          {week.multiDayRows.map((row, rowIndex) => (
                            <div
                              key={`month-week-${weekIndex}-row-${rowIndex}`}
                              className="display__week-multi-row"
                            >
                              {row.map((segment) => {
                                const event = segment.event;
                                const showTime =
                                  !event.allDay && !isMultiDayEvent(event);
                                const timeLabel = showTime
                                  ? formatEventRange(event, timeFormat)
                                  : "";
                                const className = [
                                  "display__multi-event",
                                  segment.startsBefore ? "display__multi-event--continued-start" : "",
                                  segment.endsAfter ? "display__multi-event--continued-end" : ""
                                ]
                                  .filter(Boolean)
                                  .join(" ");
                                return (
                                  <button
                                    type="button"
                                    key={`${event.id || event.summary}-${weekIndex}-${segment.startIndex}-${segment.endIndex}`}
                                    className={className}
                                    style={{
                                      gridColumn: `${segment.startIndex + 1} / ${segment.endIndex + 2}`,
                                      borderLeftColor: getEventPrimaryColor(event) || event.calendarColor
                                    }}
                                    onClick={() => setActiveEvent(event)}
                                  >
                                    {renderEventDots(event)}
                                    <span className="display__multi-event-text">
                                      <span className="display__multi-event-title">
                                        {event.summary}
                                      </span>
                                      {timeLabel ? (
                                        <span className="display__multi-event-time">
                                          {timeLabel}
                                        </span>
                                      ) : null}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {view === "week" ? (
            <div className="display__week">
              <div className="display__calendar-header">
                {dayLabels.map((label) => (
                  <div key={label} className="display__day-label">
                    {label}
                  </div>
                ))}
              </div>
              <div className="display__calendar-weeks">
                {weekRows.map((week, weekIndex) => (
                  <div
                    key={`week-row-${weekIndex}`}
                    className={`display__week-row${
                      week.multiDayRows.length ? " display__week-row--has-multi" : ""
                    }`}
                    style={{
                      "--multi-rows": week.multiDayRows.length,
                      "--multi-gaps": Math.max(0, week.multiDayRows.length - 1)
                    }}
                  >
                    <div className="display__week-grid display__week-days">
                      {week.cells.map((cell) => {
                        const isToday = cell.key === todayKey;
                        const isSelected = cell.key === selectedKey;
                        const events = (cell.events || []).filter(
                          (event) => !isMultiDayEvent(event)
                        );
                        return (
                          <div
                            key={cell.key}
                            className={
                              isToday
                                ? "display__day display__day--week display__day--today"
                                : isSelected
                                  ? "display__day display__day--week display__day--selected"
                                  : "display__day display__day--week"
                            }
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedDate(cell.date)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                setSelectedDate(cell.date);
                              }
                            }}
                          >
                            <div className="display__day-number">{cell.date.getDate()}</div>
                            <div className="display__day-events">
                              {events.slice(0, WEEK_EVENT_LIMIT).map((event) => (
                                <div
                                  key={event.id}
                                  className="display__week-event"
                                  style={{
                                    borderLeftColor: getEventPrimaryColor(event) || event.calendarColor
                                  }}
                                >
                                  {!event.allDay && !isMultiDayEvent(event) ? (
                                    <span className="display__week-event-time">
                                      {formatEventRange(event, timeFormat)}
                                    </span>
                                  ) : null}
                                  <span className="display__week-event-title">{event.summary}</span>
                                </div>
                              ))}
                              {events.length > WEEK_EVENT_LIMIT ? (
                                <div className="display__event-more">
                                  +{events.length - WEEK_EVENT_LIMIT} more
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {week.multiDayRows.length ? (
                      <div className="display__week-multi display__week-multi--curved">
                        {week.multiDayRows.map((row, rowIndex) => (
                          <div
                            key={`week-row-${weekIndex}-${rowIndex}`}
                            className="display__week-multi-row"
                          >
                            {row.map((segment) => {
                              const event = segment.event;
                              const showTime =
                                !event.allDay && !isMultiDayEvent(event);
                              const timeLabel = showTime
                                ? formatEventRange(event, timeFormat)
                                : "";
                              const className = [
                                "display__multi-event",
                                segment.startsBefore ? "display__multi-event--continued-start" : "",
                                segment.endsAfter ? "display__multi-event--continued-end" : ""
                              ]
                                .filter(Boolean)
                                .join(" ");
                              return (
                                <button
                                  type="button"
                                  key={`${event.id || event.summary}-${weekIndex}-${segment.startIndex}-${segment.endIndex}`}
                                  className={className}
                                  style={{
                                    gridColumn: `${segment.startIndex + 1} / ${segment.endIndex + 2}`,
                                    borderLeftColor: getEventPrimaryColor(event) || event.calendarColor
                                  }}
                                  onClick={() => setActiveEvent(event)}
                                >
                                  <span className="display__multi-event-text">
                                    <span className="display__multi-event-title">
                                      {event.summary}
                                    </span>
                                    {timeLabel ? (
                                      <span className="display__multi-event-time">
                                        {timeLabel}
                                      </span>
                                    ) : null}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {view === "fourWeek" ? (
            <div className="display__month">
              <div className="display__calendar">
                <div className="display__calendar-header">
                  {dayLabels.map((label) => (
                    <div key={label} className="display__day-label">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="display__calendar-weeks" ref={fourWeekWeeksRef}>
                  {fourWeekRows.map((week, weekIndex) => (
                    <div
                      key={`four-week-${weekIndex}`}
                      className={`display__week-row${
                        week.multiDayRows.length ? " display__week-row--has-multi" : ""
                      }`}
                      style={{
                        "--multi-rows": week.multiDayRows.length,
                        "--multi-gaps": Math.max(0, week.multiDayRows.length - 1)
                      }}
                    >
                      <div className="display__calendar-grid display__week-days">
                        {week.cells.map((cell) => {
                          const isToday = cell.key === todayKey;
                          const isSelected = cell.key === selectedKey;
                          const events = (cell.events || []).filter(
                            (event) => !isMultiDayEvent(event)
                          );
          const visibleLimit = getDayEventLimit(
            fourWeekRowCount,
            week.multiDayRows.length,
            isNarrowPortrait,
            fourWeekCapacities[cell.key]
          );
                          const visibleEvents = events.slice(0, visibleLimit);
                          const hiddenCount = Math.max(0, events.length - visibleLimit);
                          return (
                            <div
                              key={cell.key}
                              data-day-key={cell.key}
                              data-multi-rows={week.multiDayRows.length}
                              className={
                                isToday
                                  ? "display__day display__day--today"
                                  : isSelected
                                    ? "display__day display__day--selected"
                                    : "display__day"
                              }
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedDate(cell.date)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  setSelectedDate(cell.date);
                                }
                              }}
                            >
                              <div className="display__day-number">{cell.date.getDate()}</div>
                              <div className="display__day-events">
                                {visibleEvents.map((event) => (
                                  <div key={event.id} className="display__event-chip">
                                    {renderEventDots(event)}
                                    <span className="display__event-chip-text">
                                      {!event.allDay && !isMultiDayEvent(event) ? (
                                        <span className="display__event-chip-time">
                                          {formatEventTime(event, timeFormat)}
                                        </span>
                                      ) : null}
                                      <span className="display__event-chip-title">
                                        {event.summary}
                                      </span>
                                    </span>
                                  </div>
                                ))}
                                {hiddenCount > 0 ? (
                                  <div className="display__event-more">
                                    +{hiddenCount} more
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {week.multiDayRows.length ? (
                        <div className="display__week-multi display__week-multi--lined">
                          {week.multiDayRows.map((row, rowIndex) => (
                            <div
                              key={`four-week-${weekIndex}-row-${rowIndex}`}
                              className="display__week-multi-row"
                            >
                              {row.map((segment) => {
                                const event = segment.event;
                                const showTime =
                                  !event.allDay && !isMultiDayEvent(event);
                                const timeLabel = showTime
                                  ? formatEventRange(event, timeFormat)
                                  : "";
                                const className = [
                                  "display__multi-event",
                                  segment.startsBefore ? "display__multi-event--continued-start" : "",
                                  segment.endsAfter ? "display__multi-event--continued-end" : ""
                                ]
                                  .filter(Boolean)
                                  .join(" ");
                                return (
                                  <button
                                    type="button"
                                    key={`${event.id || event.summary}-${weekIndex}-${segment.startIndex}-${segment.endIndex}`}
                                    className={className}
                                    style={{
                                      gridColumn: `${segment.startIndex + 1} / ${segment.endIndex + 2}`,
                                      borderLeftColor: getEventPrimaryColor(event) || event.calendarColor
                                    }}
                                    onClick={() => setActiveEvent(event)}
                                  >
                                    {renderEventDots(event)}
                                    <span className="display__multi-event-text">
                                      <span className="display__multi-event-title">
                                        {event.summary}
                                      </span>
                                      {timeLabel ? (
                                        <span className="display__multi-event-time">
                                          {timeLabel}
                                        </span>
                                      ) : null}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {view === "activity" ? (
            <div className="display__list display__list--scrollable">
              {upcomingEvents.length ? (
                upcomingEvents.map((event) => {
                  const meta = getUpcomingDateParts(event, timeFormat);
                  const showTime = !event.allDay && !isMultiDayEvent(event);
                  const upcomingLabel = showTime ? meta.timeLabel : formatUpcomingRange(event);
                  return (
                    <div
                      key={event.id}
                      className="display__event-card"
                      style={{ borderLeftColor: getEventPrimaryColor(event) || event.calendarColor }}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveEvent(event)}
                      onKeyDown={(eventKey) => {
                        if (eventKey.key === "Enter" || eventKey.key === " ") {
                          setActiveEvent(event);
                        }
                      }}
                    >
                      <div className="display__event-date">
                        <span className="display__event-weekday">{meta.weekday}</span>
                        <span className="display__event-day">{meta.day}</span>
                        <span className="display__event-month">{meta.month}</span>
                      </div>
                      <div className="display__event-details">
                        <div className="display__event-title-row">
                          <span className="display__event-title">{event.summary}</span>
                          {renderEventDots(event)}
                        </div>
                        {upcomingLabel ? (
                          <span className="display__event-time">{upcomingLabel}</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="display__muted">No upcoming events.</p>
              )}
            </div>
          ) : null}
          {view === "chores" ? <ChoreView /> : null}
        </div>
        <div
          className={`display__panel display__panel--day ${
            isDayEmpty ? "display__panel--day-empty" : ""
          }`}
        >
          <h2>{formatDate(selectedDate)}</h2>
          <div className={`display__day-view ${isDayEmpty ? "display__day-view--empty" : ""}`}>
            {allDayEvents.length ? (
              <div className="display__all-day">
                <div className="display__all-day-label">All day</div>
                <div className="display__all-day-items">
                  {allDayEvents.map((event) => (
                    <button
                      type="button"
                      key={event.id}
                      className="display__all-day-chip"
                      style={{ borderLeftColor: getEventPrimaryColor(event) || event.calendarColor }}
                      onClick={() => setActiveEvent(event)}
                    >
                      {event.summary}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="display__daily-stack">
              {timedEvents.map((event) => (
                <div
                  key={event.id}
                  className="display__daily-event"
                  style={{
                    height: `${event.slotCount * DAILY_SLOT_HEIGHT}px`,
                    borderLeftColor: getEventPrimaryColor(event) || event.calendarColor
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveEvent(event)}
                  onKeyDown={(eventKey) => {
                    if (eventKey.key === "Enter" || eventKey.key === " ") {
                      setActiveEvent(event);
                    }
                  }}
                >
                  <span className="display__daily-event-time">{event.timeLabel}</span>
                  <span className="display__daily-event-title">{event.summary}</span>
                </div>
              ))}
            </div>
            {isDayEmpty ? (
              <p className="display__muted">No events scheduled for this day.</p>
            ) : null}
          </div>
        </div>
      </section>
      {view === "month" ? (
        <div
          ref={monthMeasureRef}
          className="display__event-measure"
          style={
            monthMeasureWidth
              ? { "--measure-day-width": `${monthMeasureWidth}px` }
              : undefined
          }
        >
          {monthWeekRows.map((week) =>
            week.cells.map((cell) => {
              if (!cell.day) {
                return null;
              }
              const events = (cell.events || []).filter(
                (event) => !isMultiDayEvent(event)
              );
              if (!events.length) {
                return (
                  <div
                    key={`measure-${cell.key}`}
                    className="display__event-measure-day"
                    data-day-key={cell.key}
                  />
                );
              }
              return (
                <div
                  key={`measure-${cell.key}`}
                  className="display__event-measure-day"
                  data-day-key={cell.key}
                >
                  {events.map((event) => (
                    <div key={event.id} className="display__event-chip">
                      {renderEventDots(event)}
                      <span className="display__event-chip-text">
                        {!event.allDay && !isMultiDayEvent(event) ? (
                          <span className="display__event-chip-time">
                            {formatEventTime(event, timeFormat)}
                          </span>
                        ) : null}
                        <span className="display__event-chip-title">
                          {event.summary}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      ) : null}
      {view === "fourWeek" ? (
        <div
          ref={fourWeekMeasureRef}
          className="display__event-measure"
          style={
            fourWeekMeasureWidth
              ? { "--measure-day-width": `${fourWeekMeasureWidth}px` }
              : undefined
          }
        >
          {fourWeekRows.map((week) =>
            week.cells.map((cell) => {
              const events = (cell.events || []).filter(
                (event) => !isMultiDayEvent(event)
              );
              if (!events.length) {
                return (
                  <div
                    key={`measure-${cell.key}`}
                    className="display__event-measure-day"
                    data-day-key={cell.key}
                  />
                );
              }
              return (
                <div
                  key={`measure-${cell.key}`}
                  className="display__event-measure-day"
                  data-day-key={cell.key}
                >
                  {events.map((event) => (
                    <div key={event.id} className="display__event-chip">
                      {renderEventDots(event)}
                      <span className="display__event-chip-text">
                        {!event.allDay && !isMultiDayEvent(event) ? (
                          <span className="display__event-chip-time">
                            {formatEventTime(event, timeFormat)}
                          </span>
                        ) : null}
                        <span className="display__event-chip-title">
                          {event.summary}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      ) : null}
      {activeEvent ? (
          <div className="display__modal" role="dialog" aria-modal="true">
            <div className="display__modal-overlay" onClick={() => setActiveEvent(null)} />
            <div className="display__modal-card">
              <div className="display__modal-header">
                <div>
                  <h3 className="display__modal-title">{activeEvent.summary}</h3>
                  <p className="display__modal-subtitle">
                    {formatEventDateRange(activeEvent)}
                  </p>
                </div>
                <button
                  type="button"
                  className="display__modal-close"
                  onClick={() => setActiveEvent(null)}
                  aria-label="Close event details"
                >
                  X
                </button>
              </div>
              <div className="display__modal-meta">
                {renderEventDots(activeEvent)}
                <span className="display__modal-label">{activeEventLabel}</span>
              </div>
              {activeEvent.location ? (
                <div className="display__modal-block">
                  <span className="display__modal-heading">Location</span>
                  <p className="display__modal-text display__modal-text--wrap">
                    {getLocationLink(activeEvent.location) ? (
                      <a
                        href={getLocationLink(activeEvent.location)}
                        className="display__modal-link"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {getMeetingLinkLabel(getLocationLink(activeEvent.location))}
                      </a>
                    ) : (
                      activeEvent.location
                    )}
                  </p>
                </div>
              ) : null}
              {meetingLinks.length ? (
                <div className="display__modal-block">
                  <span className="display__modal-heading">Meeting links</span>
                  <div className="display__modal-links">
                    {meetingLinks.map((link) => (
                      <a
                        key={link}
                        href={link}
                        className="display__modal-link"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {getMeetingLinkLabel(link)}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
              {sanitizedDescription ? (
                <div className="display__modal-block">
                  <span className="display__modal-heading">Notes</span>
                  <p className="display__modal-text display__modal-text--wrap">
                    {sanitizedDescription}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
      ) : null}
      {weatherModalOpen ? (
        <div className="display__modal" role="dialog" aria-modal="true">
          <div
            className="display__modal-overlay"
            onClick={() => setWeatherModalOpen(false)}
          />
          <div className="display__modal-card display__modal-card--weather">
            <div className="display__modal-header">
              <div>
                <h3 className="display__modal-title">Weather</h3>
                <p className="display__modal-subtitle">
                  {weatherLocationName}
                  {weatherUpdatedAt ? ` · Updated ${weatherUpdatedAt}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="display__modal-close"
                onClick={() => setWeatherModalOpen(false)}
                aria-label="Close weather details"
              >
                X
              </button>
            </div>
            {weather ? (
              <>
                {weatherError ? (
                  <div className="display__weather-modal-alert">{weatherError}</div>
                ) : null}
                <div className="display__weather-modal-current">
                  {useWeatherIcons && weatherCurrent.icon ? (
                    <img
                      className="display__weather-modal-icon"
                      src={weatherCurrent.icon}
                      alt={weatherCurrent.description || "Current weather icon"}
                    />
                  ) : null}
                  <div className="display__weather-modal-current-main">
                    <div className="display__weather-modal-temp">
                      {weatherSummary || formatTemp(weatherCurrent.temp) || "—"}
                    </div>
                    <div className="display__weather-modal-desc">
                      {weatherCurrent.description || "—"}
                    </div>
                    {weatherCurrent.detailedForecast ? (
                      <p className="display__weather-modal-detail">
                        {weatherCurrent.detailedForecast}
                      </p>
                    ) : null}
                  </div>
                </div>
                {weatherMetrics.length ? (
                  <div className="display__weather-modal-metrics">
                    {weatherMetrics.map((item) => (
                      <div key={item.label} className="display__weather-modal-metric">
                        <span className="display__weather-modal-label">{item.label}</span>
                        <span className="display__weather-modal-value">{item.value}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="display__weather-modal-section">
                  <h4 className="display__weather-modal-heading">Forecast</h4>
                  {weatherForecast.length ? (
                    <div className="display__weather-modal-forecast">
                      {weatherForecast.map((day) => {
                        const date = day.date ? new Date(`${day.date}T00:00:00`) : null;
                        const dayLabel =
                          date && !Number.isNaN(date.getTime())
                            ? date.toLocaleDateString([], { weekday: "long" })
                            : "Forecast";
                        const high = formatTemp(day.max);
                        const low = formatTemp(day.min);
                        const temps = high && low ? `${high} / ${low}` : high || low;
                        const badge = getForecastBadge(day.description);
                        const detailParts = [
                          day.probabilityOfPrecipitation !== undefined &&
                          day.probabilityOfPrecipitation !== null
                            ? `Precip ${formatPercent(day.probabilityOfPrecipitation)}`
                            : "",
                          day.relativeHumidity !== undefined && day.relativeHumidity !== null
                            ? `Humidity ${formatPercent(day.relativeHumidity)}`
                            : "",
                          formatWind(day.windSpeed, day.windDirection)
                            ? `Wind ${formatWind(day.windSpeed, day.windDirection)}`
                            : ""
                        ].filter(Boolean);
                        return (
                          <div key={day.date} className="display__weather-modal-forecast-day">
                            <div className="display__weather-modal-forecast-header">
                              <span className="display__weather-modal-forecast-label">
                                {dayLabel}
                              </span>
                              <span className="display__weather-modal-forecast-temps">
                                {temps || "—"}
                              </span>
                            </div>
                            <div className="display__weather-modal-forecast-main">
                              {useWeatherIcons && day.icon ? (
                                <img
                                  className="display__weather-modal-forecast-icon"
                                  src={day.icon}
                                  alt={day.description || "Forecast icon"}
                                />
                              ) : (
                                <span
                                  className={`display__forecast-badge display__forecast-badge--${badge.tone}`}
                                  title={day.description || "Forecast"}
                                >
                                  {badge.label}
                                </span>
                              )}
                              <div className="display__weather-modal-forecast-summary">
                                <span>{day.description || "—"}</span>
                                {detailParts.length ? (
                                  <span className="display__weather-modal-forecast-meta">
                                    {detailParts.join(" · ")}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            {day.detailedForecast ? (
                              <p className="display__weather-modal-forecast-detail">
                                {day.detailedForecast}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="display__modal-text">No forecast available.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="display__modal-text">
                {weatherError || "Weather unavailable."}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
