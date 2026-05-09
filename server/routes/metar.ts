import express from "express";

import { resolveAviationMetar } from "../utils/metarAviationWeather.js";

const router = express.Router();

// GET: /api/metar/:icao - get METAR data for an airport
router.get("/:icao", async (req, res) => {
  const { icao } = req.params;

  const result = await resolveAviationMetar(icao);

  if (!result.ok) {
    if (result.httpStatus === 404) {
      return res.status(404).json({
        error: result.clientMessage,
        ...(result.log ? { details: result.log } : {}),
      });
    }
    return res.status(500).json({
      error: result.clientMessage,
      ...(result.log ? { details: result.log } : {}),
    });
  }

  if (result.stale) {
    res.set("X-Metar-Stale", "1");
  }
  if (result.cacheHit && !result.stale) {
    res.set("X-Metar-Cache", "fresh");
  }
  if (result.cacheHit && result.stale) {
    res.set("X-Metar-Cache", "stale");
  }

  res.json(result.body);
});

export default router;