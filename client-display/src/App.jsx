import React, { useEffect, useMemo, useState } from "react";

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

const toLocalDateKey = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getEventDateKey = (event) => {
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

const getEventStartMs = (event) => {
  if (!event?.start) {
    return 0;
  }
  if (event.allDay && typeof event.start === "string") {
    return new Date(`${event.start}T00:00:00`).getTime();
  }
  const start = new Date(event.start);
  return Number.isNaN(start.getTime()) ? 0 : start.getTime();
};

const formatEventTime = (event, timeFormat) => {
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

  const headerSubtitle = useMemo(() => {
    if (error) {
      return error;
    }
    return `Default view: ${viewLabels[defaultView]}`;
  }, [defaultView, error]);

  const sortedEvents = useMemo(() => {
    const events = eventsCache?.events || [];
    return [...events].sort((a, b) => getEventStartMs(a) - getEventStartMs(b));
  }, [eventsCache]);

  const todayKey = useMemo(() => toLocalDateKey(now), [now]);
  const selectedKey = useMemo(() => toLocalDateKey(selectedDate), [selectedDate]);
  const selectedEvents = useMemo(
    () => sortedEvents.filter((event) => getEventDateKey(event) === selectedKey),
    [sortedEvents, selectedKey]
  );

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

  const upcomingEvents = useMemo(() => {
    const nowMs = now.getTime();
    return sortedEvents.filter((event) => getEventStartMs(event) >= nowMs).slice(0, 6);
  }, [sortedEvents, now]);

  const monthCells = useMemo(() => {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysInMonth = monthEnd.getDate();
    const firstDay = monthStart.getDay();
    const cells = [];
    for (let i = 0; i < firstDay; i += 1) {
      cells.push({ key: `empty-${i}`, day: null });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), day);
      const key = toLocalDateKey(date);
      const events = sortedEvents.filter((event) => getEventDateKey(event) === key);
      cells.push({ key, day, date, events });
    }
    return cells;
  }, [now, sortedEvents]);

  return (
    <main className="display">
      <header className="display__header">
        <div>
          <p className="display__date">{formatDate(now)}</p>
          <p className="display__time">{formatTime(now, timeFormat)}</p>
          <p className="display__subtle">{headerSubtitle}</p>
        </div>
        <div className="display__weather">
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
      </header>
      <section className="display__content">
        <div className="display__panel">
          <div className="display__panel-header">
            <h2>{viewLabels[view]}</h2>
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
            <div>
              <div className="display__month-label">{formatMonthLabel(now)}</div>
              <div className="display__calendar">
                {dayLabels.map((label) => (
                  <div key={label} className="display__day-label">
                    {label}
                  </div>
                ))}
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
                      {events.slice(0, 2).map((event) => (
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
                      {events.length > 2 ? (
                        <div className="display__event-more">+{events.length - 2} more</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {view === "activity" ? (
            <div className="display__list">
              <h3 className="display__section-title">Upcoming</h3>
              {upcomingEvents.length ? (
                upcomingEvents.map((event) => (
                  <div key={event.id} className="display__event-row">
                    <span className="display__event-time">
                      {formatEventTime(event, timeFormat)}
                    </span>
                    <span className="display__event-title">{event.summary}</span>
                  </div>
                ))
              ) : (
                <p className="display__muted">No upcoming events.</p>
              )}
            </div>
          ) : null}
        </div>
        <div className="display__panel">
          <h2>{formatDate(selectedDate)}</h2>
          {selectedEvents.length ? (
            selectedEvents.map((event) => (
              <div key={event.id} className="display__event-row">
                <span className="display__event-time">{formatEventTime(event, timeFormat)}</span>
                <span className="display__event-title">{event.summary}</span>
              </div>
            ))
          ) : (
            <p className="display__muted">No events scheduled for this day.</p>
          )}
        </div>
      </section>
      <footer className="display__footer">
        <p>Notes and reminders will appear here.</p>
      </footer>
    </main>
  );
}
