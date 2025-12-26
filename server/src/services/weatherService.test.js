import { describe, expect, it } from "vitest";

import { buildWeatherGovPointsUrl, parseWeatherGovForecast } from "./weatherService.js";

describe("weatherService", () => {
  it("builds weather.gov points URL for coords", () => {
    const url = buildWeatherGovPointsUrl({
      weather: {
        location: { lat: 40.7, lon: -74.0 }
      }
    });
    expect(url).toContain("https://api.weather.gov/points/40.7,-74");
  });

  it("parses weather.gov forecast response", () => {
    const pointsPayload = {
      geometry: { coordinates: [-74, 40.7] },
      properties: {
        relativeLocation: { properties: { city: "New York", state: "NY" } }
      }
    };
    const forecastPayload = {
      properties: {
        periods: [
          {
            startTime: "2025-01-01T08:00:00-05:00",
            temperature: 40,
            temperatureUnit: "F",
            shortForecast: "Cloudy",
            icon: "https://example.com/icon"
          },
          {
            startTime: "2025-01-01T20:00:00-05:00",
            temperature: 30,
            temperatureUnit: "F",
            shortForecast: "Clear",
            icon: "https://example.com/icon"
          }
        ]
      }
    };
    const data = parseWeatherGovForecast(pointsPayload, forecastPayload);
    expect(data.location.name).toContain("New York");
    expect(data.current.temp).toBe(40);
    expect(data.today.min).toBe(30);
  });
});
