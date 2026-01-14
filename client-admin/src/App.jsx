import React, { useEffect, useMemo, useState } from "react";
import ChoreSettings from "./components/ChoreSettings.jsx";
import ChoreHistory from "./components/ChoreHistory.jsx";

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
};

export default function App() {
  const [statusLoading, setStatusLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSavedConfig, setLastSavedConfig] = useState("");
  const [googleStatus, setGoogleStatus] = useState(null);
  const [googleNotice, setGoogleNotice] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [syncSummary, setSyncSummary] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [eventCache, setEventCache] = useState(null);
  const [calendarList, setCalendarList] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [geoNotice, setGeoNotice] = useState("");
  const [geoError, setGeoError] = useState("");
  const [weatherNotice, setWeatherNotice] = useState("");
  const [weatherError, setWeatherError] = useState("");
  const [weatherRefreshing, setWeatherRefreshing] = useState(false);
  const [formValues, setFormValues] = useState({ username: "", password: "" });
  const [activeTab, setActiveTab] = useState("display");
  const [choreData, setChoreData] = useState(null);

  const hasUser = Boolean(user);

  const loadConfig = async () => {
    setConfigError("");
    const res = await fetchJson("/api/settings", { credentials: "include" });
    if (res.ok) {
      setConfig(res.data.config);
      setLastSavedConfig(JSON.stringify(res.data.config));
    } else if (res.status === 401) {
      setUser(null);
    } else {
      setConfigError(res.data.error || "Failed to load configuration.");
    }
  };

  const loadChores = async () => {
    const res = await fetchJson("/api/chores", { credentials: "include" });
    if (res.ok) {
      setChoreData(res.data);
    }
  };

  const saveChores = async (newData) => {
    const res = await fetchJson("/api/chores/config", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newData)
    });
    if (res.ok) {
        setChoreData(res.data);
        setSaveNotice("Chore settings saved.");
    } else {
        setSaveNotice(res.data.error || "Failed to save chores.");
    }
  };

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      setStatusLoading(true);
      const [statusRes, meRes] = await Promise.all([
        fetchJson("/api/auth/status"),
        fetchJson("/api/auth/me", { credentials: "include" })
      ]);
      if (!active) {
        return;
      }
      setConfigured(Boolean(statusRes.data.configured));
      setUser(meRes.data.user || null);
      setStatusLoading(false);
    };
    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (hasUser) {
      loadConfig();
      refreshGoogleStatus();
      refreshEventCache();
      loadChores();
    }
  }, [hasUser]);

  useEffect(() => {
    if (googleStatus?.connected) {
      refreshCalendars();
    } else if (googleStatus && !googleStatus.connected) {
      setCalendarList([]);
    }
  }, [googleStatus?.connected]);

  useEffect(() => {
    if (!hasUser) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "connected") {
      setGoogleNotice("Google account connected.");
      params.delete("google");
      const nextUrl = `${window.location.pathname}${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      window.history.replaceState({}, "", nextUrl);
      refreshGoogleStatus();
    }
  }, [hasUser]);

  const refreshGoogleStatus = async () => {
    setGoogleError("");
    const res = await fetchJson("/api/google/status");
    if (res.ok) {
      setGoogleStatus(res.data);
    } else {
      setGoogleError(res.data.error || "Unable to load Google status.");
    }
  };

  const refreshCalendars = async () => {
    setCalendarError("");
    setCalendarLoading(true);
    const res = await fetchJson("/api/google/calendars", { credentials: "include" });
    setCalendarLoading(false);
    if (!res.ok) {
      if (res.status === 409) {
        setCalendarError("Google account not connected.");
      } else {
        setCalendarError(res.data.error || "Unable to load calendars.");
      }
      return;
    }
    setCalendarList(res.data.calendars || []);
  };

  const refreshEventCache = async () => {
    const res = await fetchJson("/api/events");
    if (res.ok) {
      setEventCache(res.data);
    }
  };

  const refreshWeather = async ({ notice } = {}) => {
    setWeatherError("");
    setWeatherNotice("");
    setWeatherRefreshing(true);
    const res = await fetchJson("/api/weather/refresh", {
      method: "POST",
      credentials: "include"
    });
    setWeatherRefreshing(false);
    if (res.ok) {
      setWeatherNotice(notice || "Weather refreshed.");
    } else {
      setWeatherError(res.data.error || "Unable to refresh weather.");
    }
  };

  const connectGoogle = async () => {
    setGoogleError("");
    const res = await fetchJson("/api/google/auth-url");
    if (!res.ok) {
      setGoogleError(res.data.error || "Unable to start Google auth.");
      return;
    }
    window.location.assign(res.data.url);
  };

  const disconnectGoogle = async () => {
    setGoogleError("");
    setGoogleNotice("");
    const res = await fetchJson("/api/google/disconnect", {
      method: "POST",
      credentials: "include"
    });
    if (!res.ok) {
      setGoogleError(res.data.error || "Unable to disconnect Google account.");
      return;
    }
    setGoogleNotice("Google account disconnected.");
    refreshGoogleStatus();
  };

  const syncGoogle = async () => {
    setGoogleError("");
    setGoogleNotice("");
    setSyncing(true);
    const res = await fetchJson("/api/google/sync", {
      method: "POST",
      credentials: "include"
    });
    setSyncing(false);
    if (!res.ok) {
      setGoogleError(res.data.error || "Sync failed.");
      return;
    }
    setSyncSummary(res.data.summary);
    setGoogleNotice("Sync complete.");
    refreshEventCache();
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");
    setAuthNotice("");

    const endpoint = configured ? "/api/auth/login" : "/api/auth/setup";
    const res = await fetchJson(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formValues)
    });

    if (!res.ok) {
      setAuthError(res.data.error || "Authentication failed.");
      return;
    }

    setConfigured(true);
    setUser(res.data.user);
    setAuthNotice("Signed in.");
  };

  const handleLogout = async () => {
    await fetchJson("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  };

  const saveConfig = async () => {
    if (!config) {
      return;
    }
    setSaving(true);
    setSaveNotice("");
    const previousLocationKey = getWeatherLocationKey(parseConfig(lastSavedConfig));
    const badFeed = (config.ical?.feeds || []).find((feed) => {
      if (!feed?.url || !feed.url.trim()) {
        return true;
      }
      try {
        const parsed = new URL(feed.url.trim());
        return parsed.protocol !== "http:" && parsed.protocol !== "https:";
      } catch {
        return true;
      }
    });
    if (badFeed) {
      setSaving(false);
      setSaveNotice("Fix or remove invalid iCal feed URLs before saving.");
      return;
    }
    const res = await fetchJson("/api/settings", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
    setSaving(false);
    if (res.ok) {
      const savedConfig = res.data.config;
      setConfig(savedConfig);
      setLastSavedConfig(JSON.stringify(savedConfig));
      setSaveNotice("Settings saved.");
      const nextLocationKey = getWeatherLocationKey(savedConfig);
      if (previousLocationKey !== nextLocationKey) {
        refreshWeather({ notice: "Weather refreshed after location change." });
      }
    } else {
      setSaveNotice(res.data.error || "Failed to save settings.");
    }
  };

  const updateConfig = (updater) => {
    setConfig((prev) => (prev ? updater(prev) : prev));
  };

  const updateNumber = (value, fallback) => {
    if (value === "") {
      return fallback;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return fallback;
    }
    return parsed;
  };

  const parseConfig = (value) => {
    if (!value) {
      return null;
    }
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  const getWeatherLocationKey = (source) => {
    const location = source?.weather?.location;
    if (!location) {
      return "";
    }
    return [
      location.type || "",
      location.value || "",
      location.lat ?? "",
      location.lon ?? ""
    ].join("|");
  };

  const calendarSelections = useMemo(() => {
    if (!config || !calendarList.length) {
      return [];
    }
    return calendarList.map((calendar) => {
      const existing = config.calendars?.find((item) => item.id === calendar.id);
      return {
        id: calendar.id,
        label: existing?.label || calendar.summary || calendar.id,
        color:
          existing?.color || calendar.backgroundColor || config.display?.theme?.accent || "#315a4a",
        enabled: existing?.enabled ?? true
      };
    });
  }, [calendarList, config]);

  const toggleCalendar = (id, enabled) => {
    if (!config) {
      return;
    }
    updateConfig((prev) => {
      if (!prev) {
        return prev;
      }
      const list = prev.calendars || [];
      const existingIndex = list.findIndex((item) => item.id === id);
      const calendar = calendarList.find((item) => item.id === id);
      const nextEntry = {
        id,
        label:
          list[existingIndex]?.label ||
          calendar?.summary ||
          calendar?.id ||
          id,
        color:
          list[existingIndex]?.color ||
          calendar?.backgroundColor ||
          prev.display?.theme?.accent ||
          "#315a4a",
        enabled
      };
      const nextList =
        existingIndex >= 0
          ? [
              ...list.slice(0, existingIndex),
              nextEntry,
              ...list.slice(existingIndex + 1)
            ]
          : [...list, nextEntry];
      return { ...prev, calendars: nextList };
    });
  };

  const addIcalFeed = () => {
    updateConfig((prev) => {
      if (!prev) {
        return prev;
      }
      const feeds = prev.ical?.feeds || [];
      const accent = prev.display?.theme?.accent || "#315a4a";
      return {
        ...prev,
        ical: {
          ...prev.ical,
          feeds: [...feeds, { url: "", label: "", enabled: true, color: accent }]
        }
      };
    });
  };

  const updateIcalFeed = (index, updates) => {
    updateConfig((prev) => {
      if (!prev) {
        return prev;
      }
      const feeds = prev.ical?.feeds || [];
      const nextFeeds = feeds.map((feed, feedIndex) =>
        feedIndex === index ? { ...feed, ...updates } : feed
      );
      return {
        ...prev,
        ical: {
          ...prev.ical,
          feeds: nextFeeds
        }
      };
    });
  };

  const removeIcalFeed = (index) => {
    updateConfig((prev) => {
      if (!prev) {
        return prev;
      }
      const feeds = prev.ical?.feeds || [];
      const nextFeeds = feeds.filter((_feed, feedIndex) => feedIndex !== index);
      return {
        ...prev,
        ical: {
          ...prev.ical,
          feeds: nextFeeds
        }
      };
    });
  };

  const useBrowserLocation = () => {
    setGeoNotice("");
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updateConfig((prev) => ({
          ...prev,
          weather: {
            ...prev.weather,
            location: {
              ...prev.weather.location,
              type: "coords",
              lat: Number(latitude.toFixed(4)),
              lon: Number(longitude.toFixed(4))
            }
          }
        }));
        setGeoNotice("Location detected. Save changes to apply.");
      },
      (error) => {
        if (error.code === 1) {
          setGeoError("Location permission denied.");
        } else if (error.code === 2) {
          setGeoError("Location unavailable.");
        } else {
          setGeoError("Unable to fetch location.");
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  };

  const authTitle = useMemo(
    () => (configured ? "Admin Login" : "Set Up Admin"),
    [configured]
  );

  const isDirty = useMemo(() => {
    if (!config) {
      return false;
    }
    return JSON.stringify(config) !== lastSavedConfig;
  }, [config, lastSavedConfig]);

  const displayDefaultValue = ["month", "fourWeek", "week", "activity", "chores"].includes(
    config?.display?.defaultView
  )
    ? config.display.defaultView
    : "month";

  if (statusLoading) {
    return (
      <main className="admin__auth">
        <div className="admin__auth-card">Loading…</div>
      </main>
    );
  }

  if (!hasUser) {
    return (
      <main className="admin__auth">
        <form className="admin__auth-card" onSubmit={handleAuthSubmit}>
          <h1>{authTitle}</h1>
          <p>
            {configured
              ? "Enter your admin credentials."
              : "Create your admin username and password."}
          </p>
          {authError ? <div className="admin__alert">{authError}</div> : null}
          {authNotice ? <div className="admin__notice">{authNotice}</div> : null}
          <label className="admin__field">
            Username
            <input
              type="text"
              value={formValues.username}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, username: event.target.value }))
              }
              required
            />
          </label>
          <label className="admin__field">
            Password
            <input
              type="password"
              value={formValues.password}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, password: event.target.value }))
              }
              required
            />
          </label>
          <button className="admin__primary" type="submit">
            {configured ? "Login" : "Create Admin"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="admin">
      <aside className="admin__sidebar">
        <h1>Wall Calendar Admin</h1>
        <nav>
          <button 
            type="button" 
            className={activeTab === "display" ? "admin__nav--active" : ""}
            onClick={() => setActiveTab("display")}
          >
            Display
          </button>
          <button 
            type="button"
            className={activeTab === "calendars" ? "admin__nav--active" : ""}
            onClick={() => setActiveTab("calendars")}
          >
            Calendars
          </button>
          <button 
            type="button"
            className={activeTab === "weather" ? "admin__nav--active" : ""}
            onClick={() => setActiveTab("weather")}
          >
            Weather
          </button>
          <button 
            type="button"
            className={activeTab === "chores" ? "admin__nav--active" : ""}
            onClick={() => setActiveTab("chores")}
          >
            Chores
          </button>
        </nav>
        <button className="admin__logout" type="button" onClick={handleLogout}>
          Log out
        </button>
      </aside>
      <section className="admin__content">
        <header className="admin__header">
          <div>
            <h2>Overview</h2>
            <p className="admin__muted">Signed in as {user?.username}</p>
          </div>
          <div className="admin__save">
            <span className={isDirty ? "admin__dirty" : "admin__saved"}>
              {isDirty ? "Unsaved changes" : "All changes saved"}
            </span>
            <button
              type="button"
              className="admin__primary"
              onClick={saveConfig}
              disabled={!isDirty || saving}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </header>
        {saveNotice ? <div className="admin__notice">{saveNotice}</div> : null}
        {configError ? <div className="admin__alert">{configError}</div> : null}
        {config ? (
          <>
            {activeTab === "display" && (
              <>
                <div className="admin__panel">
                  <h3>Display Settings</h3>
                  <div className="admin__grid">
                    <label className="admin__field">
                      Default view
                      <select
                        value={displayDefaultValue}
                        onChange={(event) =>
                          updateConfig((prev) => ({
                            ...prev,
                            display: { ...prev.display, defaultView: event.target.value }
                          }))
                        }
                      >
                        <option value="month">Month</option>
                        <option value="fourWeek">4-Week</option>
                        <option value="week">Week</option>
                        <option value="activity">Upcoming</option>
                        <option value="chores">Chores</option>
                      </select>
                    </label>
                    <label className="admin__field">
                      Time format
                      <select
                        value={config.display.timeFormat}
                        onChange={(event) =>
                          updateConfig((prev) => ({
                            ...prev,
                            display: { ...prev.display, timeFormat: event.target.value }
                          }))
                        }
                      >
                        <option value="12h">12 hour</option>
                        <option value="24h">24 hour</option>
                      </select>
                    </label>
                    <div className="admin__field">
                      Merge duplicate events
                      <label className="admin__checkbox">
                        <input
                          type="checkbox"
                          checked={config.display.mergeCalendars ?? true}
                          onChange={(event) =>
                            updateConfig((prev) => ({
                              ...prev,
                              display: {
                                ...prev.display,
                                mergeCalendars: event.target.checked
                              }
                            }))
                          }
                        />
                        Combine matching events across calendars
                      </label>
                    </div>
                    <div className="admin__field">
                      Backfill past events
                      <label className="admin__checkbox">
                        <input
                          type="checkbox"
                          checked={config.display.backfillPast?.month ?? false}
                          onChange={(event) =>
                            updateConfig((prev) => ({
                              ...prev,
                              display: {
                                ...prev.display,
                                backfillPast: {
                                  ...prev.display.backfillPast,
                                  month: event.target.checked
                                }
                              }
                            }))
                          }
                        />
                        Month view
                      </label>
                      <label className="admin__checkbox">
                        <input
                          type="checkbox"
                          checked={config.display.backfillPast?.fourWeek ?? false}
                          onChange={(event) =>
                            updateConfig((prev) => ({
                              ...prev,
                              display: {
                                ...prev.display,
                                backfillPast: {
                                  ...prev.display.backfillPast,
                                  fourWeek: event.target.checked
                                }
                              }
                            }))
                          }
                        />
                        4-week view
                      </label>
                      <label className="admin__checkbox">
                        <input
                          type="checkbox"
                          checked={config.display.backfillPast?.week ?? false}
                          onChange={(event) =>
                            updateConfig((prev) => ({
                              ...prev,
                              display: {
                                ...prev.display,
                                backfillPast: {
                                  ...prev.display.backfillPast,
                                  week: event.target.checked
                                }
                              }
                            }))
                          }
                        />
                        Week view
                      </label>
                    </div>
                    <label className="admin__field">
                      Backfill debounce (seconds)
                      <input
                        type="number"
                        min="5"
                        max="3600"
                        value={config.display.backfillPastDebounceSeconds ?? 60}
                        onChange={(event) =>
                          updateConfig((prev) => ({
                            ...prev,
                            display: {
                              ...prev.display,
                              backfillPastDebounceSeconds: Number(event.target.value)
                            }
                          }))
                        }
                      />
                    </label>
                    <label className="admin__field">
                      Background color
                      <input
                        type="color"
                        value={config.display.theme.background}
                        onChange={(event) =>
                          updateConfig((prev) => ({
                            ...prev,
                            display: {
                              ...prev.display,
                              theme: { ...prev.display.theme, background: event.target.value }
                            }
                          }))
                        }
                      />
                    </label>
                    <label className="admin__field">
                      Accent color
                      <input
                        type="color"
                        value={config.display.theme.accent}
                        onChange={(event) =>
                          updateConfig((prev) => ({
                            ...prev,
                            display: {
                              ...prev.display,
                              theme: { ...prev.display.theme, accent: event.target.value }
                            }
                          }))
                        }
                      />
                    </label>
                    <label className="admin__field">
                      Text color
                      <input
                        type="color"
                        value={config.display.theme.text}
                        onChange={(event) =>
                          updateConfig((prev) => ({
                            ...prev,
                            display: {
                              ...prev.display,
                              theme: { ...prev.display.theme, text: event.target.value }
                            }
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
                <div className="admin__panel">
                  <h3>Refresh Intervals</h3>
                  <div className="admin__grid">
                    <label className="admin__field">
                      Calendar sync (minutes)
                      <input
                        type="number"
                        min="1"
                        value={config.refresh.calendarSyncMinutes}
                        onChange={(event) =>
                          updateConfig((prev) => ({
                            ...prev,
                            refresh: {
                              ...prev.refresh,
                              calendarSyncMinutes: updateNumber(
                                event.target.value,
                                prev.refresh.calendarSyncMinutes
                              )
                            }
                          }))
                        }
                      />
                    </label>
                    <label className="admin__field">
                      Weather sync (minutes)
                      <input
                        type="number"
                        min="1"
                        value={config.refresh.weatherSyncMinutes}
                        onChange={(event) =>
                          updateConfig((prev) => ({
                            ...prev,
                            refresh: {
                              ...prev.refresh,
                              weatherSyncMinutes: updateNumber(
                                event.target.value,
                                prev.refresh.weatherSyncMinutes
                              )
                            }
                          }))
                        }
                      />
                    </label>
                    <label className="admin__field">
                      Display refresh (minutes)
                      <input
                        type="number"
                        min="1"
                        value={config.refresh.clientMinutes}
                        onChange={(event) =>
                          updateConfig((prev) => ({
                            ...prev,
                            refresh: {
                              ...prev.refresh,
                              clientMinutes: updateNumber(
                                event.target.value,
                                prev.refresh.clientMinutes
                              )
                            }
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
              </>
            )}

            {activeTab === "calendars" && (
              <>
                <div className="admin__panel">
                  <h3>Google Calendar</h3>
                  <p className="admin__muted">
                    {googleStatus
                      ? googleStatus.configured
                        ? googleStatus.connected
                          ? "Connected"
                          : "Not connected"
                        : "Google OAuth credentials missing."
                      : "Checking connection..."}
                  </p>
                  <p className="admin__muted">
                    Last sync:{" "}
                    {eventCache?.updatedAt
                      ? new Date(eventCache.updatedAt).toLocaleString()
                      : "Not yet synced"}
                  </p>
                  {googleError ? <div className="admin__alert">{googleError}</div> : null}
                  {googleNotice ? (
                    <div className="admin__notice">{googleNotice}</div>
                  ) : null}
                  {syncSummary ? (
                    <div className="admin__notice">
                      Synced {syncSummary.events} events from {syncSummary.calendars}{" "}
                      calendars.
                    </div>
                  ) : null}
                  <div className="admin__actions">
                    {googleStatus?.configured ? (
                      googleStatus.connected ? (
                        <>
                          <button
                            type="button"
                            className="admin__primary"
                            onClick={syncGoogle}
                          >
                            {syncing ? "Syncing…" : "Sync now"}
                          </button>
                          <button
                            type="button"
                            className="admin__ghost"
                            onClick={disconnectGoogle}
                          >
                            Disconnect
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="admin__primary"
                          onClick={connectGoogle}
                        >
                          Connect Google Calendar
                        </button>
                      )
                    ) : (
                      <button type="button" className="admin__ghost" disabled>
                        Add GOOGLE_CLIENT_ID/SECRET in .env
                      </button>
                    )}
                  </div>
                </div>
                <div className="admin__panel">
                  <div className="admin__panel-header">
                    <h3>Calendar Sources</h3>
                    <button
                      type="button"
                      className="admin__ghost"
                      onClick={refreshCalendars}
                      disabled={!googleStatus?.connected || calendarLoading}
                    >
                      {calendarLoading ? "Refreshing…" : "Refresh list"}
                    </button>
                  </div>
                  <p className="admin__muted">
                    Enable or disable individual calendars to control what appears on the
                    display.
                  </p>
                  {calendarError ? (
                    <div className="admin__alert">{calendarError}</div>
                  ) : null}
                  {!googleStatus?.connected ? (
                    <p className="admin__muted">Connect Google to manage calendars.</p>
                  ) : calendarSelections.length ? (
                    <div className="admin__calendar-list">
                      {calendarSelections.map((calendar) => (
                        <label key={calendar.id} className="admin__calendar-item">
                          <span className="admin__calendar-info">
                            <span
                              className="admin__calendar-color"
                              style={{ backgroundColor: calendar.color }}
                            />
                            <span className="admin__calendar-name">
                              {calendar.label}
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            checked={calendar.enabled}
                            onChange={(event) =>
                              toggleCalendar(calendar.id, event.target.checked)
                            }
                          />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="admin__muted">No calendars loaded yet.</p>
                  )}
                </div>
                <div className="admin__panel">
                  <div className="admin__panel-header">
                    <h3>iCal Feeds</h3>
                    <button
                      type="button"
                      className="admin__ghost"
                      onClick={addIcalFeed}
                    >
                      Add feed
                    </button>
                  </div>
                  <p className="admin__muted">
                    Add one or more .ics URLs. The optional label overrides the calendar
                    name shown in the display.
                  </p>
                  {config.ical?.feeds?.length ? (
                    <div className="admin__ical-list">
                      {config.ical.feeds.map((feed, index) => (
                        <div key={`${feed.url || "feed"}-${index}`} className="admin__ical-item">
                          <label className="admin__field">
                            iCal URL
                            <input
                              type="text"
                              value={feed.url ?? ""}
                              placeholder="https://example.com/calendar.ics"
                              onChange={(event) =>
                                updateIcalFeed(index, { url: event.target.value })
                              }
                            />
                          </label>
                          <label className="admin__field">
                            Label (optional)
                            <input
                              type="text"
                              value={feed.label ?? ""}
                              placeholder="Family Calendar"
                              onChange={(event) =>
                                updateIcalFeed(index, { label: event.target.value })
                              }
                            />
                          </label>
                          <label className="admin__field">
                            Color
                            <input
                              type="color"
                              value={feed.color ?? config.display.theme.accent}
                              onChange={(event) =>
                                updateIcalFeed(index, { color: event.target.value })
                              }
                            />
                          </label>
                          <div className="admin__ical-actions">
                            <label className="admin__checkbox">
                              <input
                                type="checkbox"
                                checked={feed.enabled ?? true}
                                onChange={(event) =>
                                  updateIcalFeed(index, { enabled: event.target.checked })
                                }
                              />
                              Enabled
                            </label>
                            <button
                              type="button"
                              className="admin__ghost"
                              onClick={() => removeIcalFeed(index)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="admin__muted">No iCal feeds configured.</p>
                  )}
                </div>
              </>
            )}

            {activeTab === "weather" && (
              <div className="admin__panel">
                <div className="admin__panel-header">
                  <h3>Weather Settings</h3>
                  <button
                    type="button"
                    className="admin__ghost"
                    onClick={() => refreshWeather()}
                    disabled={weatherRefreshing}
                  >
                    {weatherRefreshing ? "Refreshing…" : "Refresh now"}
                  </button>
                </div>
                {weatherError ? <div className="admin__alert">{weatherError}</div> : null}
                {weatherNotice ? <div className="admin__notice">{weatherNotice}</div> : null}
                {geoError ? <div className="admin__alert">{geoError}</div> : null}
                {geoNotice ? <div className="admin__notice">{geoNotice}</div> : null}
                <p className="admin__muted">
                  weather.gov requires coordinates and only supports U.S. locations.
                </p>
                <div className="admin__grid">
                  <div className="admin__field">
                    Use weather icons
                    <label className="admin__checkbox">
                      <input
                        type="checkbox"
                        checked={config.weather.showIcons ?? true}
                        onChange={(event) =>
                          updateConfig((prev) => ({
                            ...prev,
                            weather: {
                              ...prev.weather,
                              showIcons: event.target.checked
                            }
                          }))
                        }
                      />
                      Show icons on the display
                    </label>
                  </div>
                  <label className="admin__field">
                    Units
                    <select
                      value={config.weather.units}
                      onChange={(event) =>
                        updateConfig((prev) => ({
                          ...prev,
                          weather: { ...prev.weather, units: event.target.value }
                        }))
                      }
                      disabled
                    >
                      <option value="imperial">Imperial</option>
                      <option value="metric">Metric</option>
                    </select>
                  </label>
                  <div className="admin__field admin__field--button">
                    <span>Use browser location</span>
                    <button
                      type="button"
                      className="admin__ghost"
                      onClick={useBrowserLocation}
                    >
                      Use my location
                    </button>
                  </div>
                  <label className="admin__field">
                    Latitude
                    <input
                      type="number"
                      step="0.0001"
                      value={config.weather.location.lat ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateConfig((prev) => {
                          const nextLocation = { ...prev.weather.location };
                          if (value === "") {
                            delete nextLocation.lat;
                          } else {
                            nextLocation.lat = Number(value);
                          }
                          return {
                            ...prev,
                            weather: { ...prev.weather, location: nextLocation }
                          };
                        });
                      }}
                      disabled={config.weather.location.type !== "coords"}
                    />
                  </label>
                  <label className="admin__field">
                    Longitude
                    <input
                      type="number"
                      step="0.0001"
                      value={config.weather.location.lon ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateConfig((prev) => {
                          const nextLocation = { ...prev.weather.location };
                          if (value === "") {
                            delete nextLocation.lon;
                          } else {
                            nextLocation.lon = Number(value);
                          }
                          return {
                            ...prev,
                            weather: { ...prev.weather, location: nextLocation }
                          };
                        });
                      }}
                      disabled={config.weather.location.type !== "coords"}
                    />
                  </label>
                </div>
              </div>
            )}

            {activeTab === "chores" && (
              <>
                <ChoreSettings data={choreData} onSave={saveChores} />
                <ChoreHistory />
              </>
            )}
          </>
        ) : (
          <div className="admin__panel">Loading configuration…</div>
        )}
      </section>
    </main>
  );
}
