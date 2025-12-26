import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ now: new Date().toISOString() });
});

export default router;
