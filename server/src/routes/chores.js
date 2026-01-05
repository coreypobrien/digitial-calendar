import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { loadChores, saveChores, toggleChore, loadHistory } from "../storage/choreStore.js";

const router = Router();

// Public: Get current chores (for Display)
router.get("/", async (_req, res, next) => {
  try {
    const data = await loadChores();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Public: Toggle chore status (for Display interaction)
router.post("/:userId/:choreId/toggle", async (req, res, next) => {
  try {
    const { userId, choreId } = req.params;
    const data = await toggleChore(userId, choreId);
    res.json(data);
  } catch (error) {
    if (error.message === "User not found" || error.message === "Chore not found") {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
});

// Admin: Update chore configuration (Users/Tasks)
router.post("/config", requireAuth, async (req, res, next) => {
  try {
    const data = await saveChores(req.body);
    res.json(data);
  } catch (error) {
    if (error.issues) {
      res.status(400).json({ error: "Invalid chore configuration", details: error.issues });
      return;
    }
    next(error);
  }
});

// Admin: Get history
router.get("/history", requireAuth, async (_req, res, next) => {
  try {
    const history = await loadHistory();
    res.json({ history });
  } catch (error) {
    next(error);
  }
});

export default router;
