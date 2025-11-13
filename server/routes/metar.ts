import express from 'express';

const router = express.Router();

async function fetchWithRetry(url: string, maxRetries = 2, timeoutMs = 10000): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            clearTimeout(timeoutId);
            return response;
        } catch (fetchError) {
            clearTimeout(timeoutId);

            if (fetchError instanceof Error) {
                lastError = fetchError;

                if (attempt === maxRetries) {
                    if (fetchError.name === 'AbortError') {
                        throw new Error('Request timed out. The weather service is taking too long to respond.');
                    }
                    throw new Error(`Failed to connect to weather service after ${maxRetries + 1} attempts: ${fetchError.message}`);
                }

                await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            }
        }
    }

    throw lastError || new Error('Unknown error during fetch');
}

// GET: /api/metar/:icao - get METAR data for an airport
router.get('/:icao', async (req, res) => {
    try {
        const { icao } = req.params;

        const response = await fetchWithRetry(
            `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`
        );

        if (!response.ok) {
            if (response.status === 404) {
                return res.status(404).json({ error: 'No METAR data available for this airport' });
            }
            return res.status(response.status).json({ error: 'Failed to fetch METAR data' });
        }

        const text = await response.text();
        if (!text || text.trim() === '') {
            return res.status(404).json({ error: 'No METAR data found' });
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            console.error(`Failed to parse response for ${icao}:`, parseError);
            return res.status(500).json({ error: 'Invalid METAR data format' });
        }

        if (Array.isArray(data) && data.length > 0) {
            res.json(data[0]);
        } else {
            console.warn(`No data in response array for ${icao}`);
            res.status(404).json({
                error: 'No METAR data available for this airport',
                details: 'The airport may not exist or has no current weather report'
            });
        }
    } catch (error) {
        console.error('Error fetching METAR:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;