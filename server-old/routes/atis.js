import express from 'express';
import requireAuth from '../middleware/isAuthenticated.js';
import { updateSession } from '../db/sessions.js';

const router = express.Router();

// POST: /api/atis/generate - Generate ATIS and store in session
router.post('/generate', requireAuth, async (req, res) => {
    try {
        const {
            sessionId,
            ident,
            icao,
            remarks1,
            remarks2 = {},
            landing_runways,
            departing_runways,
            metar
        } = req.body;

        if (!sessionId || !icao) {
            return res.status(400).json({ error: 'Session ID and ICAO are required' });
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

        const response = await fetch(`https://atisgenerator.com/api/v1/airports/${icao}/atis`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`External API responded with ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'success') {
            throw new Error(data.message || 'Failed to generate ATIS');
        }

        const generatedAtis = data.data.text;
        if (!generatedAtis) {
            throw new Error('No ATIS data in response');
        }

        const atisData = {
            letter: ident,
            text: generatedAtis,
            timestamp: new Date().toISOString(),
        };

        const updatedSession = await updateSession(sessionId, { atis: atisData });
        if (!updatedSession) {
            throw new Error('Failed to update session with ATIS data');
        }

        res.json({
            atisText: generatedAtis,
            ident,
            timestamp: atisData.timestamp,
        });
    } catch (error) {
        console.error('Error generating ATIS:', error);
        res.status(500).json({ error: error.message || 'Failed to generate ATIS' });
    }
});

export default router;