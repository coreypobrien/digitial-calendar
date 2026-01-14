const WEATHER_GOV_POINTS_URL = "https://api.weather.gov/points";

const toLocalDateKey = (isoString) => (isoString ? isoString.split("T")[0] : null);

const toPercent = (value) =>
  value && typeof value.value === "number" ? value.value : null;

const toDewpoint = (value) =>
  value && typeof value.value === "number"
    ? { value: value.value, unitCode: value.unitCode || "" }
    : null;

const convertTemperature = (temperature, units) => {
  if (!temperature || typeof temperature.value !== "number") {
    return null;
  }
  const unitCode = temperature.unitCode || "";
  const value = temperature.value;
  if (units === "metric") {
    return unitCode.includes("degF") ? ((value - 32) * 5) / 9 : value;
  }
  if (units === "imperial") {
    return unitCode.includes("degC") ? (value * 9) / 5 + 32 : value;
  }
  return value;
};

const windDirectionToCardinal = (degrees) => {
  if (typeof degrees !== "number" || Number.isNaN(degrees)) {
    return "";
  }
  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW"
  ];
  const index = Math.round(degrees / 22.5) % directions.length;
  return directions[index];
};

const formatWindSpeed = (windSpeed, units) => {
  if (!windSpeed || typeof windSpeed.value !== "number") {
    return "";
  }
  const value = windSpeed.value;
  const unitCode = windSpeed.unitCode || "";
  const isMetersPerSecond = unitCode.includes("m_s-1");
  if (units === "metric") {
    const kmh = unitCode.includes("km_h-1")
      ? value
      : isMetersPerSecond
        ? value * 3.6
        : value * 1.60934;
    return `${Math.round(kmh)} km/h`;
  }
  if (units === "imperial") {
    const mph = unitCode.includes("km_h-1")
      ? value * 0.621371
      : isMetersPerSecond
        ? value * 2.23694
        : value;
    return `${Math.round(mph)} mph`;
  }
  return `${Math.round(value)}`;
};

const convertPressure = (pressure, units) => {
  if (!pressure || typeof pressure.value !== "number") {
    return null;
  }
  const value = pressure.value;
  const unitCode = pressure.unitCode || "";
  const isHPa = unitCode.includes("hPa") || unitCode.includes("mb");
  const isKPa = unitCode.includes("kPa");
  const isPascals = unitCode.includes("Pa") && !isHPa && !isKPa;
  const hPaValue = isHPa ? value : isKPa ? value * 10 : isPascals ? value / 100 : value;
  if (units === "metric") {
    return { value: hPaValue, unit: "hPa" };
  }
  if (units === "imperial") {
    const inHgValue = isPascals
      ? value * 0.0002953
      : isKPa
        ? value * 0.2953
        : isHPa
          ? value * 0.02953
          : value * 0.02953;
    return { value: inHgValue, unit: "inHg" };
  }
  return { value, unit: unitCode || "" };
};

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

const parseWeatherGovObservation = (observationPayload, units) => {
  const props = observationPayload?.properties;
  if (!props) {
    return null;
  }
  let isDaytime = null;
  if (props.icon?.includes("/day/")) {
    isDaytime = true;
  } else if (props.icon?.includes("/night/")) {
    isDaytime = false;
  }
  const temp = convertTemperature(props.temperature, units);
  const dewpoint = toDewpoint({
    value: convertTemperature(props.dewpoint, units),
    unitCode: units === "metric" ? "wmoUnit:degC" : "wmoUnit:degF"
  });
  const pressureSource = props.seaLevelPressure || props.barometricPressure;
  const pressure = convertPressure(pressureSource, units);
  const windChill = convertTemperature(props.windChill, units);
  const heatIndex = convertTemperature(props.heatIndex, units);
  return {
    temp,
    description: props.textDescription || "",
    icon: props.icon || "",
    time: props.timestamp || null,
    windSpeed: formatWindSpeed(props.windSpeed, units),
    windGust: formatWindSpeed(props.windGust, units),
    windDirection: windDirectionToCardinal(props.windDirection?.value),
    windDirectionDegrees: props.windDirection?.value ?? null,
    relativeHumidity: toPercent(props.relativeHumidity),
    dewpoint,
    pressure,
    windChill,
    heatIndex,
    isDaytime
  };
};

const mergeCurrentWeather = (forecastCurrent, observationCurrent) => {
  if (!observationCurrent) {
    return forecastCurrent;
  }
  const merged = { ...forecastCurrent };
  Object.entries(observationCurrent).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      merged[key] = value;
    }
  });
  return merged;
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
  const forecastData = parseWeatherGovForecast(pointsPayload, forecastPayload);
  const stationsUrl = pointsPayload?.properties?.observationStations;
  let observationCurrent = null;
  if (stationsUrl) {
    try {
      const stationsRes = await fetch(stationsUrl, { headers });
      if (stationsRes.ok) {
        const stationsPayload = await stationsRes.json();
        const station =
          stationsPayload?.features?.[0]?.properties?.stationIdentifier ||
          stationsPayload?.features?.[0]?.properties?.stationId;
        if (station) {
          const obsUrl = `https://api.weather.gov/stations/${station}/observations/latest`;
          const obsRes = await fetch(obsUrl, { headers });
          if (obsRes.ok) {
            const observationPayload = await obsRes.json();
            observationCurrent = parseWeatherGovObservation(
              observationPayload,
              forecastData.units
            );
          }
        }
      }
    } catch (_error) {
      observationCurrent = null;
    }
  }
  return {
    ...forecastData,
    current: mergeCurrentWeather(forecastData.current, observationCurrent)
  };
};

export const fetchWeather = async (config) => {
  return fetchWeatherGov(config);
};
