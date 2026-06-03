import express from "express";
import type { Request, Response } from "express";
import { getControllerRatingStats } from "../../db/ratings.js";
import { getActiveNotifications } from "../../db/notifications.js";
import { listDeveloperFlightLogsMetadata } from "../../db/flightLogs.js";

const router = express.Router();

function extCtx(req: Request) {
  const ext = req.developerExt;
  if (!ext) throw new Error("developerExt missing");
  return ext;
}

router.get(
  "/ratings/controllers/:controllerId/stats",
  async (req: Request, res: Response) => {
    try {
      extCtx(req);
      const { controllerId } = req.params;
      if (!controllerId?.trim()) {
        return res.status(400).json({ error: "controllerId required" });
      }
      const stats = await getControllerRatingStats(controllerId.trim());
      res.json({
        controllerId: controllerId.trim(),
        averageRating: stats.averageRating,
        ratingCount: stats.ratingCount,
      });
    } catch (e) {
      console.error("[ext/ratings stats]", e);
      res.status(500).json({ error: "Failed to load rating stats" });
    }
  }
);

router.get("/notifications/active", async (req: Request, res: Response) => {
  try {
    extCtx(req);
    const notifications = await getActiveNotifications();
    res.json(
      notifications.map((n) => ({
        id: n.id,
        type: n.type,
        text: n.text,
        show: n.show,
        customColor: n.custom_color,
        createdAt: n.created_at,
      }))
    );
  } catch (e) {
    console.error("[ext/notifications]", e);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

router.get("/flight-logs", async (req: Request, res: Response) => {
  try {
    const ext = extCtx(req);
    const sessionId =
      typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
    const page =
      typeof req.query.page === "string"
        ? parseInt(req.query.page, 10) || 1
        : 1;
    const limit =
      typeof req.query.limit === "string"
        ? parseInt(req.query.limit, 10) || 50
        : 50;
    const data = await listDeveloperFlightLogsMetadata(ext.userId, {
      sessionId,
      page,
      limit,
    });
    res.json(data);
  } catch (e) {
    console.error("[ext/flight-logs]", e);
    res.status(500).json({ error: "Failed to load flight logs" });
  }
});

export default router;
