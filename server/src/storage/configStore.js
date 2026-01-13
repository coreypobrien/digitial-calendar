import { ConfigSchema } from "../config/schema.js";
import { defaultConfig } from "../config/defaultConfig.js";
import { fileExists, readJsonFile, resolveDataPath, writeJsonAtomic } from "./jsonStore.js";

const configPath = resolveDataPath("config.json");

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const mergeDeep = (base, override) => {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : override;
  }

  const result = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      result[key] = value;
      return;
    }
    if (isPlainObject(value) && isPlainObject(base[key])) {
      result[key] = mergeDeep(base[key], value);
      return;
    }
    result[key] = value;
  });
  return result;
};

const normalizeConfig = (config) => {
  const next = { ...config };
  if (
    next.display?.defaultView !== "month" &&
    next.display?.defaultView !== "fourWeek" &&
    next.display?.defaultView !== "week" &&
    next.display?.defaultView !== "activity" &&
    next.display?.defaultView !== "chores"
  ) {
    next.display = { ...next.display, defaultView: "month" };
  }
  if (next.display?.mergeCalendars === undefined) {
    next.display = {
      ...next.display,
      mergeCalendars: defaultConfig.display.mergeCalendars
    };
  }
  if (next.weather?.showIcons === undefined) {
    next.weather = {
      ...next.weather,
      showIcons: defaultConfig.weather.showIcons
    };
  }
  next.weather = {
    ...next.weather,
    provider: "weathergov",
    location: {
      ...next.weather.location,
      type: "coords"
    }
  };
  if (next.refresh) {
    const { calendarMinutes, weatherMinutes, ...rest } = next.refresh;
    next.refresh = {
      ...rest,
      calendarSyncMinutes:
        rest.calendarSyncMinutes ??
        calendarMinutes ??
        defaultConfig.refresh.calendarSyncMinutes,
      weatherSyncMinutes:
        rest.weatherSyncMinutes ?? weatherMinutes ?? defaultConfig.refresh.weatherSyncMinutes,
      clientMinutes: rest.clientMinutes ?? calendarMinutes ?? defaultConfig.refresh.clientMinutes
    };
  } else {
    next.refresh = { ...defaultConfig.refresh };
  }
  return next;
};

export const ensureConfig = async () => {
  const exists = await fileExists(configPath);
  if (!exists) {
    await writeJsonAtomic(configPath, defaultConfig);
    return { config: defaultConfig, errors: [] };
  }
  return loadConfig();
};

export const loadConfig = async () => {
  const data = await readJsonFile(configPath, {});
  const merged = normalizeConfig(mergeDeep(defaultConfig, data));
  const parsed = ConfigSchema.safeParse(merged);
  if (!parsed.success) {
    return { config: defaultConfig, errors: parsed.error.issues };
  }
  const rawParsed = ConfigSchema.safeParse(data);
  const errors = rawParsed.success ? [] : rawParsed.error.issues;
  return { config: parsed.data, errors };
};

export const saveConfig = async (nextConfig) => {
  const parsed = ConfigSchema.parse(nextConfig);
  await writeJsonAtomic(configPath, parsed);
  return parsed;
};
