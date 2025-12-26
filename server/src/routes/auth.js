import { Router } from "express";
import bcrypt from "bcryptjs";

import { loadConfig, saveConfig } from "../storage/configStore.js";

const router = Router();

router.get("/status", async (_req, res, next) => {
  try {
    const { config } = await loadConfig();
    res.json({ configured: Boolean(config.admin.passwordHash) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", (req, res) => {
  res.json({ user: req.session?.user || null });
});

router.post("/setup", async (req, res, next) => {
  try {
    const { config } = await loadConfig();
    if (config.admin.passwordHash) {
      res.status(409).json({ error: "Admin already configured" });
      return;
    }

    const { username, password } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const nextConfig = {
      ...config,
      admin: {
        username,
        passwordHash
      }
    };

    await saveConfig(nextConfig);
    req.session.user = { username };
    res.json({ user: { username } });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { config } = await loadConfig();
    if (!config.admin.passwordHash) {
      res.status(409).json({ error: "Admin not configured" });
      return;
    }

    const { username, password } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    if (username !== config.admin.username) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const ok = await bcrypt.compare(password, config.admin.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    req.session.user = { username: config.admin.username };
    res.json({ user: { username: config.admin.username } });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

export default router;
