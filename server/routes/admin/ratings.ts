import express from "express";
import { requirePermission } from "../../middleware/rolePermissions.js";
import {
  getControllerRatingStats,
  getControllerRatingsDailyStats,
} from "../../db/admin.js";

const router = express.Router();

// GET: /api/admin/ratings/stats - Get controller rating statistics
router.get("/stats", requirePermission("admin"), async (req, res) => {
  try {
    const stats = await getControllerRatingStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching controller rating stats:", error);
    res.status(500).json({ error: "Failed to fetch rating statistics" });
  }
});

// GET: /api/admin/ratings/daily - Get daily controller rating statistics
router.get("/daily", requirePermission("admin"), async (req, res) => {
  try {
    const daysParam = req.query.days;
    const days =
      typeof daysParam === "string"
        ? parseInt(daysParam)
        : Array.isArray(daysParam) && typeof daysParam[0] === "string"
          ? parseInt(daysParam[0])
          : 30;

    const dailyStats = await getControllerRatingsDailyStats(days);
    res.json(dailyStats);
  } catch (error) {
    console.error("Error fetching daily controller rating stats:", error);
    res.status(500).json({ error: "Failed to fetch daily rating statistics" });
  }
});

export default router;
