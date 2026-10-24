import express from 'express';
import requireAuth from '../middleware/auth.js';
import { updateSession } from '../db/sessions.js';
import { encrypt } from '../utils/encryption.js';
import { capture } from '../utils/posthog.js';
import { generateAtis } from '../utils/atisGenerator.js';

const router = express.Router();

interface ATISGenerateRequest {
  sessionId: string;
  ident: string;
  icao: string;
  remarks1?: string;
  landing_runways: string[];
  departing_runways: string[];
  metar?: string;
}

// POST: /api/atis/generate
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const body: ATISGenerateRequest = req.body;

    const {
      sessionId,
      ident,
      icao,
      remarks1,
      landing_runways,
      departing_runways,
      metar,
    } = body;

    if (!sessionId || !icao || !ident) {
      return res
        .status(400)
        .json({ error: 'Session ID, ICAO, and Ident are required' });
    }
    if (!Array.isArray(landing_runways) || !Array.isArray(departing_runways)) {
      return res
        .status(400)
        .json({ error: 'Landing and departing runways must be arrays' });
    }

    const generatedAtis = await generateAtis({
      icao,
      ident,
      landingRunways: landing_runways,
      departingRunways: departing_runways,
      remarks: remarks1,
      metar,
    });

    const atisTimestamp = new Date().toISOString();

    const atisData = {
      letter: ident,
      text: generatedAtis,
      timestamp: atisTimestamp,
    };

    const newDepartureRunway = departing_runways[0] ?? landing_runways[0];
    const newArrivalRunway = landing_runways[0] ?? departing_runways[0];

    const encryptedAtis = encrypt(atisData);
    const updatedSession = await updateSession(sessionId, {
      atis: JSON.stringify(encryptedAtis),
      ...(newDepartureRunway ? { active_runway: newDepartureRunway } : {}),
      ...(newArrivalRunway ? { arrival_runway: newArrivalRunway } : {}),
    });
    if (!updatedSession) {
      throw new Error('Failed to update session with ATIS data');
    }

    if (req.user?.userId)
      capture(req, {
        distinctId: req.user.userId,
        event: 'atis_generated',
        properties: { session_id: sessionId, icao, ident },
      });

    res.json({
      text: generatedAtis,
      letter: ident,
      timestamp: atisTimestamp,
      atisText: generatedAtis,
      ident: ident,
    });
  } catch (error) {
    console.error('Error generating ATIS:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to generate ATIS';
    res.status(500).json({ error: errorMessage });
  }
});

export default router;
