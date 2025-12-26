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
            icon: "https://example.com/icon",
            isDaytime: true
          },
          {
            startTime: "2025-01-01T20:00:00-05:00",
            temperature: 30,
            temperatureUnit: "F",
            shortForecast: "Clear",
            icon: "https://example.com/icon",
            isDaytime: false
          },
          {
            startTime: "2025-01-02T08:00:00-05:00",
            temperature: 50,
            temperatureUnit: "F",
            shortForecast: "Sunny",
            icon: "https://example.com/icon",
            isDaytime: true
          },
          {
            startTime: "2025-01-02T20:00:00-05:00",
            temperature: 35,
            temperatureUnit: "F",
            shortForecast: "Cloudy",
            icon: "https://example.com/icon",
            isDaytime: false
          }
        ]
      }
    };
    const data = parseWeatherGovForecast(pointsPayload, forecastPayload);
    expect(data.location.name).toContain("New York");
    expect(data.current.temp).toBe(40);
    expect(data.today.min).toBe(30);
    expect(data.forecast).toHaveLength(2);
    expect(data.forecast[0].min).toBe(30);
    expect(data.forecast[0].max).toBe(40);
    expect(data.forecast[1].min).toBe(35);
    expect(data.forecast[1].max).toBe(50);
  });
});
