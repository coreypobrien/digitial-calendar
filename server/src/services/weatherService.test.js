import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildWeatherGovPointsUrl,
  fetchWeather,
  parseWeatherGovForecast
} from "./weatherService.js";

const buildResponse = (data, ok = true) => ({
  ok,
  status: ok ? 200 : 400,
  json: async () => data
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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
            detailedForecast: "Mostly cloudy.",
            icon: "https://example.com/icon",
            isDaytime: true,
            windSpeed: "5 to 10 mph",
            windDirection: "NW",
            relativeHumidity: { value: 45, unitCode: "wmoUnit:percent" },
            probabilityOfPrecipitation: { value: 20, unitCode: "wmoUnit:percent" },
            dewpoint: { value: 2, unitCode: "wmoUnit:degC" }
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
            detailedForecast: "Clear skies.",
            icon: "https://example.com/icon",
            isDaytime: true,
            windSpeed: "10 mph",
            windDirection: "W",
            relativeHumidity: { value: 35, unitCode: "wmoUnit:percent" },
            probabilityOfPrecipitation: { value: 5, unitCode: "wmoUnit:percent" },
            dewpoint: { value: 3, unitCode: "wmoUnit:degC" }
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
    expect(data.current.windSpeed).toBe("5 to 10 mph");
    expect(data.current.windDirection).toBe("NW");
    expect(data.current.relativeHumidity).toBe(45);
    expect(data.current.probabilityOfPrecipitation).toBe(20);
    expect(data.current.dewpoint).toEqual({ value: 2, unitCode: "wmoUnit:degC" });
    expect(data.current.detailedForecast).toBe("Mostly cloudy.");
    expect(data.today.min).toBe(30);
    expect(data.forecast).toHaveLength(2);
    expect(data.forecast[0].min).toBe(30);
    expect(data.forecast[0].max).toBe(40);
    expect(data.forecast[0].relativeHumidity).toBe(45);
    expect(data.forecast[0].probabilityOfPrecipitation).toBe(20);
    expect(data.forecast[0].dewpoint).toEqual({ value: 2, unitCode: "wmoUnit:degC" });
    expect(data.forecast[0].detailedForecast).toBe("Mostly cloudy.");
    expect(data.forecast[1].min).toBe(35);
    expect(data.forecast[1].max).toBe(50);
    expect(data.forecast[1].relativeHumidity).toBe(35);
    expect(data.forecast[1].probabilityOfPrecipitation).toBe(5);
    expect(data.forecast[1].dewpoint).toEqual({ value: 3, unitCode: "wmoUnit:degC" });
    expect(data.forecast[1].detailedForecast).toBe("Clear skies.");
  });

  it("merges latest observations into current weather", async () => {
    const pointsUrl = "https://api.weather.gov/points/38.1724,-85.5716";
    const forecastUrl = "https://api.weather.gov/gridpoints/LMK/56,74/forecast";
    const stationsUrl = "https://api.weather.gov/gridpoints/LMK/56,74/stations";
    const observationUrl = "https://api.weather.gov/stations/KLOU/observations/latest";
    const pointsPayload = {
      geometry: { coordinates: [-85.5716, 38.1724] },
      properties: {
        forecast: forecastUrl,
        observationStations: stationsUrl,
        relativeLocation: { properties: { city: "Louisville", state: "KY" } }
      }
    };
    const forecastPayload = {
      properties: {
        periods: [
          {
            startTime: "2025-01-01T08:00:00-05:00",
            temperature: 70,
            temperatureUnit: "F",
            shortForecast: "Cloudy",
            detailedForecast: "Mostly cloudy.",
            icon: "https://example.com/icon",
            isDaytime: true,
            windSpeed: "5 mph",
            windDirection: "NW",
            relativeHumidity: { value: 45, unitCode: "wmoUnit:percent" },
            probabilityOfPrecipitation: { value: 20, unitCode: "wmoUnit:percent" },
            dewpoint: { value: 2, unitCode: "wmoUnit:degC" }
          }
        ]
      }
    };
    const stationsPayload = {
      features: [{ properties: { stationIdentifier: "KLOU" } }]
    };
    const observationPayload = {
      properties: {
        timestamp: "2025-01-01T10:00:00Z",
        textDescription: "Clear",
        icon: "https://api.weather.gov/icons/land/day/skc",
        temperature: { unitCode: "wmoUnit:degC", value: 10 },
        dewpoint: { unitCode: "wmoUnit:degC", value: 4 },
        windDirection: { unitCode: "wmoUnit:degree_(angle)", value: 200 },
        windSpeed: { unitCode: "wmoUnit:m_s-1", value: 5 },
        windGust: { unitCode: "wmoUnit:m_s-1", value: 8 },
        relativeHumidity: { unitCode: "wmoUnit:percent", value: 40 },
        barometricPressure: { unitCode: "wmoUnit:Pa", value: 101325 },
        windChill: { unitCode: "wmoUnit:degC", value: 7 },
        heatIndex: { unitCode: "wmoUnit:degC", value: 12 }
      }
    };
    const fetchMock = vi.fn((input) => {
      const url = typeof input === "string" ? input : input?.url;
      if (url === pointsUrl) {
        return Promise.resolve(buildResponse(pointsPayload));
      }
      if (url === forecastUrl) {
        return Promise.resolve(buildResponse(forecastPayload));
      }
      if (url === stationsUrl) {
        return Promise.resolve(buildResponse(stationsPayload));
      }
      if (url === observationUrl) {
        return Promise.resolve(buildResponse(observationPayload));
      }
      return Promise.resolve(buildResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await fetchWeather({
      weather: {
        location: { lat: 38.1724, lon: -85.5716 }
      }
    });

    expect(data.current.temp).toBeCloseTo(50, 1);
    expect(data.current.description).toBe("Clear");
    expect(data.current.windSpeed).toBe("11 mph");
    expect(data.current.windGust).toBe("18 mph");
    expect(data.current.windDirection).toBe("SSW");
    expect(data.current.windDirectionDegrees).toBe(200);
    expect(data.current.pressure.unit).toBe("inHg");
    expect(data.current.pressure.value).toBeCloseTo(29.92, 2);
    expect(data.current.windChill).toBeCloseTo(44.6, 1);
    expect(data.current.heatIndex).toBeCloseTo(53.6, 1);
  });
});
