export const defaultConfig = {
  version: 2,
  admin: {
    username: "admin",
    passwordHash: ""
  },
  display: {
    defaultView: "month",
    timeFormat: "12h",
    theme: {
      background: "#f8f3ea",
      accent: "#2b6f6b",
      text: "#1f1f1f"
    },
    mergeCalendars: true,
    backfillPast: {
      month: true,
      fourWeek: true,
      week: true
    },
    backfillPastDebounceSeconds: 60
  },
  refresh: {
    calendarSyncMinutes: 10,
    weatherSyncMinutes: 60,
    clientMinutes: 10
  },
  calendars: [],
  ical: {
    feeds: []
  },
  google: {
    syncDays: 30
  },
  weather: {
    provider: "weathergov",
    units: "imperial",
    showIcons: true,
    location: {
      type: "coords",
      value: "New York,US",
      lat: 40.7128,
      lon: -74.006
    }
  }
};
