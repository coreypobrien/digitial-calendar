import { Router } from "express";

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

export default router;
