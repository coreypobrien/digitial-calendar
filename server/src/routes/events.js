import { Router } from "express";

import { syncCalendarEvents } from "../services/calendarSync.js";
import { loadConfig, saveConfig } from "../storage/configStore.js";
import { loadEventCache } from "../storage/eventStore.js";

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
    const { timeMax } = req.body || {};
    if (!timeMax) {
      res.status(400).json({ error: "timeMax is required" });
      return;
    }
    const target = new Date(timeMax);
    if (Number.isNaN(target.getTime())) {
      res.status(400).json({ error: "timeMax must be a valid ISO date" });
      return;
    }
    const cache = await loadEventCache();
    const cachedMax = cache?.range?.timeMax ? new Date(cache.range.timeMax) : null;
    if (cachedMax && !Number.isNaN(cachedMax.getTime()) && target <= cachedMax) {
      const { config } = await loadConfig();
      res.json({ updated: false, syncDays: config.google.syncDays });
      return;
    }
    const now = new Date();
    if (target <= now) {
      const { config } = await loadConfig();
      res.json({ updated: false, syncDays: config.google.syncDays });
      return;
    }
    const msPerDay = 24 * 60 * 60 * 1000;
    const requiredDays = Math.ceil((target.getTime() - now.getTime()) / msPerDay);
    const { config } = await loadConfig();
    const currentDays = config.google.syncDays;
    const nextDays = Math.min(Math.max(currentDays, requiredDays), 365);
    if (nextDays === currentDays) {
      res.json({ updated: false, syncDays: currentDays });
      return;
    }
    const saved = await saveConfig({
      ...config,
      google: { ...config.google, syncDays: nextDays }
    });
    try {
      const summary = await syncCalendarEvents();
      res.json({ updated: true, syncDays: saved.google.syncDays, summary });
    } catch (error) {
      if (error?.code === "NOT_CONNECTED") {
        res.status(409).json({
          error: "Google account not connected",
          updated: true,
          syncDays: saved.google.syncDays
        });
        return;
      }
      if (error?.code === "NO_SOURCES") {
        res.status(409).json({
          error: "No calendar sources configured",
          updated: true,
          syncDays: saved.google.syncDays
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

export default router;
