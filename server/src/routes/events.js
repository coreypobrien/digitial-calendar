import { Router } from "express";

import { syncCalendarEvents } from "../services/calendarSync.js";
import { loadConfig, saveConfig } from "../storage/configStore.js";
import { loadEventCache, saveEventCache } from "../storage/eventStore.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const cache = await loadEventCache();
    res.json(cache);
  } catch (error) {
    next(error);
  }
});

router.post("/extend", async (req, res, next) => {
  try {
    const { timeMin, timeMax } = req.body || {};
    if (!timeMin && !timeMax) {
      res.status(400).json({ error: "timeMin or timeMax is required" });
      return;
    }
    const minTarget = timeMin ? new Date(timeMin) : null;
    const maxTarget = timeMax ? new Date(timeMax) : null;
    if (minTarget && Number.isNaN(minTarget.getTime())) {
      res.status(400).json({ error: "timeMin must be a valid ISO date" });
      return;
    }
    if (maxTarget && Number.isNaN(maxTarget.getTime())) {
      res.status(400).json({ error: "timeMax must be a valid ISO date" });
      return;
    }

    const cache = await loadEventCache();
    const cachedMin = cache?.range?.timeMin ? new Date(cache.range.timeMin) : null;
    const cachedMax = cache?.range?.timeMax ? new Date(cache.range.timeMax) : null;
    const now = new Date();
    const { config } = await loadConfig();
    const currentDays = config.google.syncDays;
    let nextConfig = config;

    let desiredMin = null;
    let desiredMax = null;
    if (
      maxTarget &&
      maxTarget > now &&
      (!cachedMax || Number.isNaN(cachedMax.getTime()) || maxTarget > cachedMax)
    ) {
      const msPerDay = 24 * 60 * 60 * 1000;
      const requiredDays = Math.ceil((maxTarget.getTime() - now.getTime()) / msPerDay);
      const nextDays = Math.min(Math.max(currentDays, requiredDays), 365);
      if (nextDays !== currentDays) {
        nextConfig = await saveConfig({
          ...config,
          google: { ...config.google, syncDays: nextDays }
        });
      }
      desiredMax = maxTarget;
    }

    if (
      minTarget &&
      (!cachedMin || Number.isNaN(cachedMin.getTime()) || minTarget < cachedMin)
    ) {
      desiredMin = minTarget;
    }

    if (!desiredMin && !desiredMax) {
      res.json({ updated: false, syncDays: currentDays });
      return;
    }

    if (!desiredMin) {
      desiredMin =
        cachedMin && !Number.isNaN(cachedMin.getTime()) ? cachedMin : new Date(now);
    }
    if (!desiredMax) {
      desiredMax =
        cachedMax && !Number.isNaN(cachedMax.getTime())
          ? cachedMax
          : new Date(now.getTime() + currentDays * 24 * 60 * 60 * 1000);
    }

    try {
      const summary = await syncCalendarEvents({
        timeMin: desiredMin.toISOString(),
        timeMax: desiredMax.toISOString()
      });
      res.json({ updated: true, syncDays: nextConfig.google.syncDays, summary });
    } catch (error) {
      if (error?.code === "NOT_CONNECTED") {
        res.status(409).json({
          error: "Google account not connected",
          updated: true,
          syncDays: nextConfig.google.syncDays
        });
        return;
      }
      if (error?.code === "NO_SOURCES") {
        res.status(409).json({
          error: "No calendar sources configured",
          updated: true,
          syncDays: nextConfig.google.syncDays
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", async (_req, res, next) => {
  try {
    await saveEventCache({ updatedAt: null, range: null, events: [] });
    await syncCalendarEvents();
    const cache = await loadEventCache();
    res.json(cache);
  } catch (error) {
    if (error?.code === "NO_SOURCES") {
      res.status(409).json({ error: "No calendar sources configured" });
      return;
    }
    next(error);
  }
});

export default router;
