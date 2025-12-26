import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { ensureConfig, saveConfig } from "../storage/configStore.js";

const router = Router();

const toPublicConfig = (config) => ({
  display: config.display,
  refresh: config.refresh,
  weather: config.weather
});

router.get("/public", async (_req, res, next) => {
  try {
    const { config, errors } = await ensureConfig();
    if (errors.length) {
      res.status(200).json({ config: toPublicConfig(config), warnings: errors });
      return;
    }
    res.json({ config: toPublicConfig(config) });
  } catch (error) {
    next(error);
  }
});

router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const { config, errors } = await ensureConfig();
    if (errors.length) {
      res.status(200).json({ config, warnings: errors });
      return;
    }
    res.json({ config });
  } catch (error) {
    next(error);
  }
});

router.put("/", requireAuth, async (req, res, next) => {
  try {
    const saved = await saveConfig(req.body);
    res.json({ config: saved });
  } catch (error) {
    if (error.issues) {
      res.status(400).json({ error: "Invalid configuration", details: error.issues });
      return;
    }
    next(error);
  }
});

export default router;
