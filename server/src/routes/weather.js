import { Router } from "express";

import { loadConfig } from "../storage/configStore.js";
import { loadWeatherCache, saveWeatherCache } from "../storage/weatherStore.js";
import { fetchWeather } from "../services/weatherService.js";

const router = Router();

const isFresh = (updatedAt, minutes) => {
  if (!updatedAt) {
    return false;
  }
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  return ageMs < minutes * 60 * 1000;
};

router.get("/", async (_req, res, next) => {
  try {
    const { config } = await loadConfig();
    const cache = await loadWeatherCache();
    if (cache.updatedAt && isFresh(cache.updatedAt, config.refresh.weatherMinutes)) {
      res.json({ ...cache, stale: false });
      return;
    }

    try {
      const data = await fetchWeather(config);
      const payload = { updatedAt: data.updatedAt, data };
      await saveWeatherCache(payload);
      res.json({ ...payload, stale: false });
    } catch (error) {
      if (cache.updatedAt) {
        res.json({ ...cache, stale: true, error: "Using cached weather data" });
        return;
      }
      if (error.code === "INVALID_LOCATION") {
        res.status(400).json({ error: "Latitude and longitude are required." });
        return;
      }
      next(error);
    }
  } catch (error) {
    next(error);
  }
});

export default router;
