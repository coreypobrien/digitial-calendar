import React, { useEffect, useMemo, useState } from "react";

import {
  eventOccursOnDateKey,
  formatEventRange,
  formatEventTime,
  getEventEndMs,
  getEventStartMs,
  getUpcomingDateParts,
  toLocalDateKey
} from "./utils/events.js";

const DAILY_WINDOW_START = 8;
const DAILY_WINDOW_HOURS = 12;
const DAILY_SLOT_MINUTES = 15;
const DAILY_SLOT_HEIGHT = 20;

const formatTime = (date, timeFormat) =>
  date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: timeFormat !== "24h"
  });

const formatDate = (date) =>
  date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

const formatMonthLabel = (date) =>
  date.toLocaleDateString([], { month: "long", year: "numeric" });

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const getMinutesIntoDay = (date) => date.getHours() * 60 + date.getMinutes();

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
  activity: "Upcoming"
};

export default function App() {
  const [now, setNow] = useState(new Date());
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState("");
  const [eventsCache, setEventsCache] = useState({ events: [], updatedAt: null });
  const [view, setView] = useState("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthOffset, setMonthOffset] = useState(0);
  const [rangeRequest, setRangeRequest] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(timer);
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
    if (config?.refresh?.calendarMinutes) {
      const intervalMs = Math.max(1, config.refresh.calendarMinutes) * 60 * 1000;
      const timer = setInterval(loadEvents, intervalMs);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }
    return () => {
      active = false;
    };
  }, [config?.refresh?.calendarMinutes]);

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
    return () => {
      active = false;
    };
  }, []);

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
  const defaultView = viewLabels[config?.display?.defaultView]
    ? config.display.defaultView
    : "month";
  const dailyResetMinutes = Number(config?.display?.dailyResetMinutes ?? 5);
  const monthResetMinutes = Number(config?.display?.monthResetMinutes ?? 2);
  const weatherLocation = config?.weather?.location?.value || "Weather";
  const weatherUnitsRaw = weather?.units || config?.weather?.units || "imperial";
  const weatherUnits = weatherUnitsRaw === "metric" ? "C" : "F";
  const weatherSummary =
    weather?.current?.temp !== undefined && weather?.current?.temp !== null
      ? `${Math.round(weather.current.temp)}°${weatherUnits}`
      : null;
  const weatherRange =
    weather?.today?.min !== undefined && weather?.today?.max !== undefined
      ? `${Math.round(weather.today.min)}° / ${Math.round(weather.today.max)}°`
      : null;
  const weatherDescription = weather?.current?.description || "";
  const weatherLocationName = weather?.location?.name || weatherLocation;

  const sortedEvents = useMemo(() => {
    const events = eventsCache?.events || [];
    return [...events].sort((a, b) => getEventStartMs(a) - getEventStartMs(b));
  }, [eventsCache]);

  const activeMonthDate = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() + monthOffset, 1),
    [now, monthOffset]
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
        if (endMinutes <= rangeStart || startMinutes >= rangeEnd) {
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
          id: event.id,
          summary: event.summary,
          calendarColor: event.calendarColor,
          timeLabel: formatEventRange(event, timeFormat),
          startSlot,
          slotCount: endSlot - startSlot
        };
      })
      .filter(Boolean);

    return events.sort((a, b) => a.startSlot - b.startSlot);
  }, [selectedEvents, timeFormat, dailyWindow]);

  useEffect(() => {
    if (!dailyResetMinutes || dailyResetMinutes <= 0) {
      return undefined;
    }
    const today = new Date();
    const todayKeyLocal = toLocalDateKey(today);
    if (selectedKey === todayKeyLocal) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setSelectedDate(new Date());
    }, dailyResetMinutes * 60 * 1000);
    return () => clearTimeout(timer);
  }, [dailyResetMinutes, selectedKey]);

  useEffect(() => {
    if (!monthResetMinutes || monthResetMinutes <= 0 || monthOffset === 0) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setMonthOffset(0);
    }, monthResetMinutes * 60 * 1000);
    return () => clearTimeout(timer);
  }, [monthResetMinutes, monthOffset]);

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
    if (view !== "month") {
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
    const targetEnd = new Date(
      activeMonthDate.getFullYear(),
      activeMonthDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
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
  }, [activeMonthDate, eventsCache?.range?.timeMax, rangeRequest, view]);

  const upcomingEvents = useMemo(() => {
    const nowMs = now.getTime();
    const windowEnd = nowMs + 30 * 24 * 60 * 60 * 1000;
    return sortedEvents.filter((event) => {
      const startMs = getEventStartMs(event);
      return startMs >= nowMs && startMs <= windowEnd;
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
    return cells;
  }, [activeMonthDate, sortedEvents]);

  return (
    <main className="display">
      <header className="display__header">
        <div>
          <p className="display__date">{formatDate(now)}</p>
          <p className="display__time">{formatTime(now, timeFormat)}</p>
          {error ? <p className="display__subtle">{error}</p> : null}
        </div>
        <div className="display__weather">
          <div className="display__weather-main">
            {weatherSummary ? (
              <>
                <strong>{weatherSummary}</strong>
                <span>
                  {weatherRange ? ` · ${weatherRange}` : ""} {weatherDescription}
                </span>
              </>
            ) : (
              <span>{weatherError || `${weatherLocationName} · ${weatherUnits}`}</span>
            )}
          </div>
          {weather?.forecast?.length ? (
            <div className="display__forecast">
              {weather.forecast.slice(0, 7).map((day) => {
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
                return (
                  <div key={day.date} className="display__forecast-day">
                    <span className="display__forecast-name">{dayLabel}</span>
                    <span
                      className={`display__forecast-badge display__forecast-badge--${badge.tone}`}
                      title={day.description || "Forecast"}
                    >
                      {badge.label}
                    </span>
                    <span className="display__forecast-temps">{temps}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </header>
      <section className="display__content">
        <div className="display__panel">
          <div className="display__month-header">
            <div className="display__month-label">
              {view === "month" ? formatMonthLabel(activeMonthDate) : "Upcoming"}
            </div>
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
            ) : null}
            <div className="display__toggles">
              {Object.keys(viewLabels).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={
                    view === key ? "display__toggle display__toggle--active" : "display__toggle"
                  }
                  onClick={() => setView(key)}
                >
                  {viewLabels[key].replace(" View", "")}
                </button>
              ))}
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
                <div className="display__calendar-grid">
                  {monthCells.map((cell) => {
                    if (!cell.day) {
                      return <div key={cell.key} className="display__day display__day--empty" />;
                    }
                    const isToday = toLocalDateKey(cell.date) === todayKey;
                    const isSelected = toLocalDateKey(cell.date) === selectedKey;
                    const events = cell.events || [];
                    return (
                      <div
                        key={cell.key}
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
                          {events.slice(0, 3).map((event) => (
                            <div key={event.id} className="display__event-chip">
                              <span
                                className="display__event-dot"
                                style={{ backgroundColor: event.calendarColor }}
                              />
                              <span className="display__event-chip-text">
                                {formatEventTime(event, timeFormat)} {event.summary}
                              </span>
                            </div>
                          ))}
                          {events.length > 3 ? (
                            <div className="display__event-more">+{events.length - 3} more</div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
          {view === "activity" ? (
            <div className="display__list display__list--scrollable">
              {upcomingEvents.length ? (
                upcomingEvents.map((event) => {
                  const meta = getUpcomingDateParts(event, timeFormat);
                  return (
                    <div
                      key={event.id}
                      className="display__event-card"
                      style={{ borderLeftColor: event.calendarColor }}
                    >
                      <div className="display__event-date">
                        <span className="display__event-weekday">{meta.weekday}</span>
                        <span className="display__event-day">{meta.day}</span>
                        <span className="display__event-month">{meta.month}</span>
                      </div>
                      <div className="display__event-details">
                        <div className="display__event-title-row">
                          <span className="display__event-title">{event.summary}</span>
                          <span
                            className="display__event-dot"
                            style={{ backgroundColor: event.calendarColor }}
                          />
                        </div>
                        <span className="display__event-time">{meta.timeLabel}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="display__muted">No upcoming events.</p>
              )}
            </div>
          ) : null}
        </div>
        <div className="display__panel">
          <h2>{formatDate(selectedDate)}</h2>
          <div className="display__day-view">
            {allDayEvents.length ? (
              <div className="display__all-day">
                <div className="display__all-day-label">All day</div>
                <div className="display__all-day-items">
                  {allDayEvents.map((event) => (
                    <span
                      key={event.id}
                      className="display__all-day-chip"
                      style={{ borderLeftColor: event.calendarColor }}
                    >
                      {event.summary}
                    </span>
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
                    borderLeftColor: event.calendarColor
                  }}
                >
                  <span className="display__daily-event-time">{event.timeLabel}</span>
                  <span className="display__daily-event-title">{event.summary}</span>
                </div>
              ))}
            </div>
            {!allDayEvents.length && !timedEvents.length ? (
              <p className="display__muted">No events scheduled for this day.</p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
