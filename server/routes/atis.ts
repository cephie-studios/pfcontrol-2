import express from 'express';
import requireAuth from '../middleware/auth.js';
import { updateSession } from '../db/sessions.js';
import { encrypt } from '../utils/encryption.js';

const router = express.Router();

interface ATISGenerateRequest {
  sessionId: string;
  ident: string;
  icao: string;
  remarks1?: string;
  remarks2?: Record<string, unknown>;
  landing_runways: string[];
  departing_runways: string[];
  metar?: string;
}

interface ExternalATISResponse {
  status: string;
  message?: string;
  data?: {
    text: string;
  };
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
      remarks2 = {},
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

    const requestBody = {
      ident,
      icao,
      remarks1,
      remarks2,
      landing_runways,
      departing_runways,
      'output-type': 'atis',
      override_runways: false,
      metar: metar || undefined,
    };

    let response;
    try {
      response = await fetch(
        `https://atisgenerator.com/api/v1/airports/${icao}/atis`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );
    } catch (fetchError) {
      console.error('Failed to fetch from ATIS generator API:', fetchError);
      throw new Error('Unable to connect to ATIS generation service');
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`ATIS API error: ${response.status} - ${errorText}`);

      if (metar && (response.status === 400 || response.status === 500)) {
        console.warn('Retrying ATIS generation without METAR data');
        try {
          const retryBody = { ...requestBody, metar: undefined };
          const retryResponse = await fetch(
            `https://atisgenerator.com/api/v1/airports/${icao}/atis`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(retryBody),
            }
          );

          if (retryResponse.ok) {
            response = retryResponse;
          } else {
            throw new Error(
              `External API responded with ${response.status}: ${errorText}`
            );
          }
        } catch {
          throw new Error(
            `External API responded with ${response.status}: ${errorText}`
          );
        }
      } else {
        throw new Error(
          `External API responded with ${response.status}: ${errorText}`
        );
      }
    }

    const data = (await response.json()) as ExternalATISResponse;

    if (data.status !== 'success') {
      throw new Error(data.message || 'Failed to generate ATIS');
    }

    const generatedAtis = data.data?.text;
    if (!generatedAtis) {
      throw new Error('No ATIS text in response');
    }

    const atisTimestamp = new Date().toISOString();

    const atisData = {
      letter: ident,
      text: generatedAtis,
      timestamp: atisTimestamp,
    };

    const encryptedAtis = encrypt(atisData);
    const updatedSession = await updateSession(sessionId, {
      atis: JSON.stringify(encryptedAtis),
    });
    if (!updatedSession) {
      throw new Error('Failed to update session with ATIS data');
    }

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
