import { readJsonFile, resolveDataPath, writeJsonAtomic } from "./jsonStore.js";

const weatherCachePath = resolveDataPath("weather_cache.json");

export const loadWeatherCache = async () =>
  readJsonFile(weatherCachePath, { updatedAt: null, data: null });

export const saveWeatherCache = async (payload) => writeJsonAtomic(weatherCachePath, payload);
