const WEATHER_GOV_POINTS_URL = "https://api.weather.gov/points";

const toLocalDateKey = (isoString) => (isoString ? isoString.split("T")[0] : null);

const toPercent = (value) =>
  value && typeof value.value === "number" ? value.value : null;

const toDewpoint = (value) =>
  value && typeof value.value === "number"
    ? { value: value.value, unitCode: value.unitCode || "" }
    : null;

const getWeatherGovHeaders = () => ({
  "User-Agent": process.env.WEATHER_GOV_USER_AGENT || "wall-calendar (local)",
  Accept: "application/geo+json, application/json"
});

export const buildWeatherGovPointsUrl = (config) => {
  if (
    typeof config.weather.location.lat !== "number" ||
    typeof config.weather.location.lon !== "number"
  ) {
    const error = new Error("Latitude and longitude are required for weather.gov");
    error.code = "INVALID_LOCATION";
    throw error;
  }
  return `${WEATHER_GOV_POINTS_URL}/${config.weather.location.lat},${config.weather.location.lon}`;
};

export const parseWeatherGovForecast = (pointsPayload, forecastPayload) => {
  const periods = forecastPayload?.properties?.periods;
  if (!Array.isArray(periods) || periods.length === 0) {
    const error = new Error("Invalid weather.gov forecast response");
    error.code = "INVALID_RESPONSE";
    throw error;
  }

  const first = periods[0];
  const dayKey = toLocalDateKey(first.startTime);
  const todays = periods.filter((period) => toLocalDateKey(period.startTime) === dayKey);
  const temps = todays.map((period) => period.temperature).filter((temp) => temp !== undefined);
  const min = temps.length ? Math.min(...temps) : first.temperature;
  const max = temps.length ? Math.max(...temps) : first.temperature;
  const tempUnit = first.temperatureUnit || "F";
  const units = tempUnit === "F" ? "imperial" : "metric";

  const dailyForecast = [];
  const dailyIndex = new Map();
  periods.forEach((period) => {
    const dateKey = toLocalDateKey(period.startTime);
    if (!dateKey) {
      return;
    }
    let entry = dailyIndex.get(dateKey);
    if (!entry) {
      entry = {
        date: dateKey,
        min: period.temperature,
        max: period.temperature,
        description: period.shortForecast || "",
        icon: period.icon || "",
        detailedForecast: period.detailedForecast || "",
        windSpeed: period.windSpeed || "",
        windDirection: period.windDirection || "",
        relativeHumidity: toPercent(period.relativeHumidity),
        probabilityOfPrecipitation: toPercent(period.probabilityOfPrecipitation),
        dewpoint: toDewpoint(period.dewpoint),
        isDaytime: Boolean(period.isDaytime),
        _pickedDaytime: Boolean(period.isDaytime)
      };
      dailyIndex.set(dateKey, entry);
      dailyForecast.push(entry);
    } else if (typeof period.temperature === "number") {
      if (entry.min === undefined || period.temperature < entry.min) {
        entry.min = period.temperature;
      }
      if (entry.max === undefined || period.temperature > entry.max) {
        entry.max = period.temperature;
      }
    }

    if (period.isDaytime && !entry._pickedDaytime) {
      entry.description = period.shortForecast || entry.description;
      entry.icon = period.icon || entry.icon;
      entry.detailedForecast = period.detailedForecast || entry.detailedForecast;
      entry.windSpeed = period.windSpeed || entry.windSpeed;
      entry.windDirection = period.windDirection || entry.windDirection;
      entry.relativeHumidity =
        toPercent(period.relativeHumidity) ?? entry.relativeHumidity;
      entry.probabilityOfPrecipitation =
        toPercent(period.probabilityOfPrecipitation) ?? entry.probabilityOfPrecipitation;
      entry.dewpoint = toDewpoint(period.dewpoint) || entry.dewpoint;
      entry.isDaytime = Boolean(period.isDaytime);
      entry._pickedDaytime = true;
    } else if (!entry.description && period.shortForecast) {
      entry.description = period.shortForecast;
    }
  });

  const locationProps = pointsPayload?.properties?.relativeLocation?.properties;
  const locationName = locationProps?.city
    ? `${locationProps.city}${locationProps.state ? `, ${locationProps.state}` : ""}`
    : pointsPayload?.properties?.relativeLocation?.properties?.city;

  return {
    updatedAt: new Date().toISOString(),
    location: {
      name: locationName || "Local",
      lat: pointsPayload?.geometry?.coordinates?.[1],
      lon: pointsPayload?.geometry?.coordinates?.[0]
    },
    units,
    current: {
      temp: first.temperature,
      feelsLike: null,
      description: first.shortForecast || "",
      icon: first.icon || "",
      detailedForecast: first.detailedForecast || "",
      windSpeed: first.windSpeed || "",
      windDirection: first.windDirection || "",
      relativeHumidity: toPercent(first.relativeHumidity),
      probabilityOfPrecipitation: toPercent(first.probabilityOfPrecipitation),
      dewpoint: toDewpoint(first.dewpoint),
      isDaytime: Boolean(first.isDaytime),
      time: first.startTime || null
    },
    today: {
      min,
      max
    },
    forecast: dailyForecast.slice(0, 7).map(({ _pickedDaytime, ...rest }) => rest)
  };
};

const fetchWeatherGov = async (config) => {
  const pointsUrl = buildWeatherGovPointsUrl(config);
  const headers = getWeatherGovHeaders();
  const pointsRes = await fetch(pointsUrl, { headers });
  if (!pointsRes.ok) {
    const error = new Error(`weather.gov points request failed (${pointsRes.status})`);
    error.code = "REQUEST_FAILED";
    throw error;
  }
  const pointsPayload = await pointsRes.json();
  const forecastUrl = pointsPayload?.properties?.forecast;
  if (!forecastUrl) {
    const error = new Error("weather.gov forecast URL missing");
    error.code = "INVALID_RESPONSE";
    throw error;
  }
  const forecastRes = await fetch(forecastUrl, { headers });
  if (!forecastRes.ok) {
    const error = new Error(`weather.gov forecast request failed (${forecastRes.status})`);
    error.code = "REQUEST_FAILED";
    throw error;
  }
  const forecastPayload = await forecastRes.json();
  return parseWeatherGovForecast(pointsPayload, forecastPayload);
};

export const fetchWeather = async (config) => {
  return fetchWeatherGov(config);
};
