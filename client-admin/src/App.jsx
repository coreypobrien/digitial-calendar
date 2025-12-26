import React, { useEffect, useMemo, useState } from "react";

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
  const [geoNotice, setGeoNotice] = useState("");
  const [geoError, setGeoError] = useState("");
  const [formValues, setFormValues] = useState({ username: "", password: "" });

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
    }
  }, [hasUser]);

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

  const refreshEventCache = async () => {
    const res = await fetchJson("/api/events");
    if (res.ok) {
      setEventCache(res.data);
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
    const res = await fetchJson("/api/settings", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    });
    setSaving(false);
    if (res.ok) {
      setConfig(res.data.config);
      setLastSavedConfig(JSON.stringify(res.data.config));
      setSaveNotice("Settings saved.");
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

  const displayDefaultValue =
    config?.display?.defaultView === "activity" ? "activity" : "month";

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
          <button type="button">Display</button>
          <button type="button">Calendars</button>
          <button type="button">Weather</button>
          <button type="button">Notes</button>
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
              {googleNotice ? <div className="admin__notice">{googleNotice}</div> : null}
              {syncSummary ? (
                <div className="admin__notice">
                  Synced {syncSummary.events} events from {syncSummary.calendars} calendars.
                </div>
              ) : null}
              <div className="admin__actions">
                {googleStatus?.configured ? (
                  googleStatus.connected ? (
                    <>
                      <button type="button" className="admin__primary" onClick={syncGoogle}>
                        {syncing ? "Syncing…" : "Sync now"}
                      </button>
                      <button type="button" className="admin__ghost" onClick={disconnectGoogle}>
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button type="button" className="admin__primary" onClick={connectGoogle}>
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
                    <option value="activity">Upcoming</option>
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
                <label className="admin__field">
                  Daily view reset (minutes)
                  <input
                    type="number"
                    min="0"
                    value={config.display.dailyResetMinutes ?? 0}
                    onChange={(event) =>
                      updateConfig((prev) => ({
                        ...prev,
                        display: {
                          ...prev.display,
                          dailyResetMinutes: updateNumber(
                            event.target.value,
                            prev.display.dailyResetMinutes
                          )
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
                  Calendar refresh (minutes)
                  <input
                    type="number"
                    min="1"
                    value={config.refresh.calendarMinutes}
                    onChange={(event) =>
                      updateConfig((prev) => ({
                        ...prev,
                        refresh: {
                          ...prev.refresh,
                          calendarMinutes: updateNumber(
                            event.target.value,
                            prev.refresh.calendarMinutes
                          )
                        }
                      }))
                    }
                  />
                </label>
                <label className="admin__field">
                  Weather refresh (minutes)
                  <input
                    type="number"
                    min="1"
                    value={config.refresh.weatherMinutes}
                    onChange={(event) =>
                      updateConfig((prev) => ({
                        ...prev,
                        refresh: {
                          ...prev.refresh,
                          weatherMinutes: updateNumber(
                            event.target.value,
                            prev.refresh.weatherMinutes
                          )
                        }
                      }))
                    }
                  />
                </label>
              </div>
            </div>
            <div className="admin__panel">
              <h3>Weather Settings</h3>
              {geoError ? <div className="admin__alert">{geoError}</div> : null}
              {geoNotice ? <div className="admin__notice">{geoNotice}</div> : null}
              <p className="admin__muted">
                weather.gov requires coordinates and only supports U.S. locations.
              </p>
              <div className="admin__grid">
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
                  <button type="button" className="admin__ghost" onClick={useBrowserLocation}>
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
          </>
        ) : (
          <div className="admin__panel">Loading configuration…</div>
        )}
      </section>
    </main>
  );
}
