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
    resetMinutes: 5
  },
  refresh: {
    calendarMinutes: 10,
    weatherMinutes: 30
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
    location: {
      type: "coords",
      value: "New York,US",
      lat: 40.7128,
      lon: -74.006
    }
  }
};
