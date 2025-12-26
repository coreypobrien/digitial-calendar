import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import pinoHttp from "pino-http";

import { createLogger } from "./logger.js";
import { rootDir } from "./paths.js";
import authRouter from "./routes/auth.js";
import configRouter from "./routes/config.js";
import eventsRouter from "./routes/events.js";
import googleRouter from "./routes/google.js";
import weatherRouter from "./routes/weather.js";

export const createApp = () => {
  dotenv.config({ path: path.join(rootDir, ".env") });

  const logger = createLogger();
  const app = express();

  const displayDist = path.join(rootDir, "client-display", "dist");
  const adminDist = path.join(rootDir, "client-admin", "dist");

  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: "1mb" }));
  app.use(
    session({
      name: "wall_calendar_session",
      secret: process.env.SESSION_SECRET || "dev-session-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax"
      }
    })
  );

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/settings", configRouter);
  app.use("/api/google", googleRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api/weather", weatherRouter);

  const sendIfExists = (res, filePath) => {
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
      return true;
    }
    return false;
  };

  if (fs.existsSync(displayDist)) {
    app.use("/", express.static(displayDist));
  }

  if (fs.existsSync(adminDist)) {
    app.use("/admin", express.static(adminDist));
  }

  app.get("/", (_req, res) => {
    const indexPath = path.join(displayDist, "index.html");
    if (!sendIfExists(res, indexPath)) {
      res
        .status(200)
        .send("Display app not built yet. Run the client build to generate static assets.");
    }
  });

  app.get("/admin", (_req, res) => {
    const indexPath = path.join(adminDist, "index.html");
    if (!sendIfExists(res, indexPath)) {
      res
        .status(200)
        .send("Admin app not built yet. Run the client build to generate static assets.");
    }
  });

  app.use((error, _req, res, _next) => {
    logger.error({ err: error }, "Unhandled error");
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
};
