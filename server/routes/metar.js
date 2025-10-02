import express from 'express';

const router = express.Router();

// GET: /api/metar/:icao - get METAR data for an airport
router.get('/:icao', async (req, res) => {
    try {
        const { icao } = req.params;

        const response = await fetch(`https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`);

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch METAR data' });
        }

        const text = await response.text();
        if (!text) {
            return res.status(404).json({ error: 'No METAR data found' });
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (jsonError) {
            return res.status(500).json({ error: 'Invalid METAR data format' });
        }

        if (data && data.length > 0) {
            res.json(data[0]);
        } else {
            res.status(404).json({ error: 'No METAR data available for this airport' });
        }
    } catch (error) {
        console.error('Error fetching METAR:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;