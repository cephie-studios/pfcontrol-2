import express from "express";
import { requirePermission } from "../../middleware/rolePermissions.js";
import { getAdminSocketStatsWithHistory } from "../../realtime/socketRegistry.js";

const router = express.Router();

router.get("/", requirePermission("admin"), async (_req, res) => {
  try {
    const namespaces = await getAdminSocketStatsWithHistory();
    const totalConnected = namespaces.reduce((sum, n) => sum + n.connected, 0);
    res.json({
      namespaces,
      totalConnected,
      polledAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching websocket stats:", error);
    res.status(500).json({ error: "Failed to fetch websocket stats" });
  }
});

export default router;
