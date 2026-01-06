import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import {
  clearTokens,
  exchangeCodeForTokens,
  getAuthUrl,
  hasGoogleCredentials,
  loadTokens
} from "../services/googleAuth.js";
import { syncCalendarEvents } from "../services/calendarSync.js";
import { listCalendars } from "../services/googleCalendar.js";

const router = Router();

router.get("/status", async (_req, res, next) => {
  try {
    const tokens = await loadTokens();
    res.json({
      configured: hasGoogleCredentials(),
      connected: Boolean(tokens)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/auth-url", (_req, res, next) => {
  try {
    if (!hasGoogleCredentials()) {
      res.status(400).json({ error: "Google OAuth credentials are missing" });
      return;
    }
    const url = getAuthUrl();
    res.json({ url });
  } catch (error) {
    next(error);
  }
});

router.get("/callback", async (req, res, next) => {
  try {
    const { code } = req.query;
    const authCode = Array.isArray(code) ? code[0] : code;
    if (!authCode) {
      res.status(400).send("Missing OAuth code.");
      return;
    }
    await exchangeCodeForTokens(authCode);
    const adminBase = process.env.ADMIN_APP_URL;
    if (adminBase) {
      const trimmed = adminBase.replace(/\/$/, "");
      res.redirect(`${trimmed}?google=connected`);
      return;
    }
    res.redirect("/admin?google=connected");
  } catch (error) {
    next(error);
  }
});

router.post("/disconnect", requireAuth, async (_req, res, next) => {
  try {
    await clearTokens();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get("/calendars", requireAuth, async (_req, res, next) => {
  try {
    const calendars = await listCalendars();
    res.json({ calendars });
  } catch (error) {
    if (error.code === "NOT_CONNECTED") {
      res.status(409).json({ error: "Google account not connected" });
      return;
    }
    next(error);
  }
});

router.post("/sync", requireAuth, async (_req, res, next) => {
  try {
    const summary = await syncCalendarEvents({ requireGoogle: true });
    res.json({ summary });
  } catch (error) {
    if (error.code === "NOT_CONNECTED") {
      res.status(409).json({ error: "Google account not connected" });
      return;
    }
    next(error);
  }
});

export default router;
