import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getTesterSettings } from '../db/testers.js';
import { getActiveNotifications } from '../db/notifications.js';
import { mainDb, flightsDb, redisConnection } from '../db/connection.js';
import { getTopUsers, STATS_KEYS } from '../db/leaderboard.js';
import { getUserById } from '../db/users.js';
import { sql } from 'kysely';

import dotenv from 'dotenv';
const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env.development';
dotenv.config({ path: envFile });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const airportsPath = path.join(__dirname, '..', 'data', 'airportData.json');
const aircraftPath = path.join(__dirname, '..', 'data', 'aircraftData.json');
const airlinesPath = path.join(__dirname, '..', 'data', 'airlineData.json');
const backgroundsPath = path.join(
  process.cwd(),
  'public',
  'assets',
  'app',
  'backgrounds'
);

if (
  !fs.existsSync(airportsPath) ||
  !fs.existsSync(aircraftPath) ||
  !fs.existsSync(airlinesPath) ||
  !fs.existsSync(backgroundsPath)
) {
  console.error(`Data file missing`);
}

interface AirportFrequencies {
  APP?: string;
  TWR?: string;
  GND?: string;
  DEL?: string;
  [key: string]: string | undefined;
}

interface Airport {
  icao: string;
  name: string;
  controlName?: string;
  elevation: number;
  picture: string;
  allFrequencies: AirportFrequencies;
  sids: string[];
  runways: string[];
  departures: Record<string, Record<string, string>>;
  stars: string[];
  arrivals: Record<string, Record<string, string>>;
}

const router = express.Router();

// GET: /api/data/airports
router.get('/airports', async (req, res) => {
  const cacheKey = 'data:airports';

  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.warn('[Redis] Failed to read cache for airports:', error.message);
    }
  }

  try {
    if (!fs.existsSync(airportsPath)) {
      return res.status(404).json({ error: 'Airport data not found' });
    }

    const data: Airport[] = JSON.parse(fs.readFileSync(airportsPath, 'utf8'));

    try {
      await redisConnection.set(cacheKey, JSON.stringify(data), 'EX', 43200); // Cache for 12 hours
    } catch (error) {
      if (error instanceof Error) {
        console.warn(
          '[Redis] Failed to set cache for airports:',
          error.message
        );
      }
    }

    res.json(data);
  } catch (error) {
    console.error('Error reading airport data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error reading airport data',
    });
  }
});

// GET: /api/data/aircrafts
router.get('/aircrafts', async (req, res) => {
  const cacheKey = 'data:aircrafts';

  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.warn(
        '[Redis] Failed to read cache for aircrafts:',
        error.message
      );
    }
  }

  try {
    if (!fs.existsSync(aircraftPath)) {
      return res.status(404).json({ error: 'Aircraft data not found' });
    }

    const data = JSON.parse(fs.readFileSync(aircraftPath, 'utf8'));

    try {
      await redisConnection.set(cacheKey, JSON.stringify(data), 'EX', 43200);
    } catch (error) {
      if (error instanceof Error) {
        console.warn(
          '[Redis] Failed to set cache for aircrafts:',
          error.message
        );
      }
    }

    res.json(data);
  } catch (error) {
    console.error('Error reading aircraft data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error reading aircraft data',
    });
  }
});

// GET: /api/data/airlines
router.get('/airlines', async (req, res) => {
  const cacheKey = 'data:airlines';

  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.warn('[Redis] Failed to read cache for airlines:', error.message);
    }
  }

  try {
    if (!fs.existsSync(airlinesPath)) {
      return res.status(404).json({ error: 'Airline data not found' });
    }

    const data = JSON.parse(fs.readFileSync(airlinesPath, 'utf8'));

    try {
      await redisConnection.set(cacheKey, JSON.stringify(data), 'EX', 43200);
    } catch (error) {
      if (error instanceof Error) {
        console.warn(
          '[Redis] Failed to set cache for airlines:',
          error.message
        );
      }
    }

    res.json(data);
  } catch (error) {
    console.error('Error reading airline data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error reading airline data',
    });
  }
});

// GET: /api/data/frequencies
router.get('/frequencies', async (req, res) => {
  const cacheKey = 'data:frequencies';

  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.warn(
        '[Redis] Failed to read cache for frequencies:',
        error.message
      );
    }
  }

  try {
    if (!fs.existsSync(airportsPath)) {
      return res.status(404).json({ error: 'Airport data not found' });
    }

    const freqOrder = ['APP', 'TWR', 'GND', 'DEL'];
    const freqMapping = {
      clearanceDelivery: 'DEL',
      departure: 'DEP',
      ground: 'GND',
      tower: 'TWR',
      approach: 'APP',
    };

    const data: Airport[] = JSON.parse(fs.readFileSync(airportsPath, 'utf8'));
    const frequencies = data.map((airport: Airport) => {
      const allFreqs = airport.allFrequencies || {};
      const displayFreqs = freqOrder
        .map((type) => {
          let freq = allFreqs[type];
          if (!freq) {
            for (const [key, value] of Object.entries(freqMapping)) {
              if (value === type && allFreqs[key]) {
                freq = allFreqs[key];
                break;
              }
            }
          }
          return freq && freq.toLowerCase() !== 'n/a' ? { type, freq } : null;
        })
        .filter(Boolean);

      const usedTypes = new Set(displayFreqs.map((f) => f!.type));
      const remainingFreqs = Object.entries(allFreqs)
        .filter(
          ([key, value]) =>
            !usedTypes.has(key) &&
            !Object.keys(freqMapping).includes(key) &&
            value &&
            value.toLowerCase() !== 'n/a'
        )
        .slice(0, 4 - displayFreqs.length)
        .map(([type, freq]) => ({ type: type.toUpperCase(), freq }));

      const allDisplayFreqs = [
        ...displayFreqs.filter(Boolean),
        ...remainingFreqs,
      ].slice(0, 4);

      return {
        icao: airport.icao,
        name: airport.name,
        frequencies: allDisplayFreqs,
      };
    });

    try {
      await redisConnection.set(
        cacheKey,
        JSON.stringify(frequencies),
        'EX',
        43200
      ); // Cache for 12 hours
    } catch (error) {
      if (error instanceof Error) {
        console.warn(
          '[Redis] Failed to set cache for frequencies:',
          error.message
        );
      }
    }

    res.json(frequencies);
  } catch (error) {
    console.error('Error reading airport frequencies:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error reading airport frequencies',
    });
  }
});

// GET: /api/data/backgrounds
router.get('/backgrounds', (req, res) => {
  try {
    if (!fs.existsSync(backgroundsPath)) {
      return res.status(404).json({ error: 'Backgrounds directory not found' });
    }

    const files = fs.readdirSync(backgroundsPath);
    const imageExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.bmp',
      '.webp',
      '.svg',
    ];

    const backgroundImages = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return imageExtensions.includes(ext);
      })
      .map((file) => ({
        filename: file,
        path: `/assets/app/backgrounds/${file}`,
        extension: path.extname(file).toLowerCase(),
      }));

    res.json(backgroundImages);
  } catch (error) {
    console.error('Error reading background images:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error reading background images',
    });
  }
});

// GET: /api/data/airports/:icao/runways
router.get('/airports/:icao/runways', (req, res) => {
  try {
    if (!fs.existsSync(airportsPath)) {
      return res.status(404).json({ error: 'Airport data not found' });
    }

    const data: Airport[] = JSON.parse(fs.readFileSync(airportsPath, 'utf8'));
    const airport = data.find((a: Airport) => a.icao === req.params.icao);
    if (!airport) {
      return res.status(404).json({ error: 'Airport not found' });
    }
    res.json(airport.runways || []);
  } catch (error) {
    console.error('Error reading airport data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error reading airport data',
    });
  }
});

// GET: /api/data/airports/:icao/sids
router.get('/airports/:icao/sids', (req, res) => {
  try {
    if (!fs.existsSync(airportsPath)) {
      return res.status(404).json({ error: 'Airport data not found' });
    }

    const data: Airport[] = JSON.parse(fs.readFileSync(airportsPath, 'utf8'));
    const airport = data.find((a: Airport) => a.icao === req.params.icao);
    if (!airport) {
      return res.status(404).json({ error: 'Airport not found' });
    }
    res.json(airport.sids || []);
  } catch (error) {
    console.error('Error reading airport data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error reading airport data',
    });
  }
});

// GET: /api/data/airports/:icao/stars
router.get('/airports/:icao/stars', (req, res) => {
  try {
    if (!fs.existsSync(airportsPath)) {
      return res.status(404).json({ error: 'Airport data not found' });
    }

    const data: Airport[] = JSON.parse(fs.readFileSync(airportsPath, 'utf8'));
    const airport = data.find((a: Airport) => a.icao === req.params.icao);
    if (!airport) {
      return res.status(404).json({ error: 'Airport not found' });
    }
    res.json(airport.stars || []);
  } catch (error) {
    console.error('Error reading airport data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error reading airport data',
    });
  }
});

// GET: /api/data/statistics
router.get('/statistics', async (req, res) => {
  const cacheKey = 'homepage:stats';

  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
  } catch (error) {
    if (error instanceof Error) {
      console.warn(
        '[Redis] Failed to read cache for homepage stats:',
        error.message
      );
    }
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const sessionsCreated = await mainDb
      .selectFrom('sessions')
      .select(({ fn }) => fn.countAll().as('count'))
      .where('created_at', '>=', thirtyDaysAgo)
      .executeTakeFirst();

    const registeredUsers = await mainDb
      .selectFrom('users')
      .select(({ fn }) => fn.countAll().as('count'))
      .executeTakeFirst();

    const sessions = await mainDb
      .selectFrom('sessions')
      .select(['session_id'])
      .execute();

    let flightsLogged = 0;
    for (const session of sessions) {
      try {
        const tableName =
          `flights_${session.session_id}` as keyof typeof flightsDb.schema;
        const flightResult = await flightsDb
          .selectFrom(tableName)
          .select(sql`count(*)`.as('count'))
          .executeTakeFirst();
        flightsLogged += parseInt(flightResult!.count as string, 10);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.warn(
          `Could not count flights for session ${session.session_id}:`,
          errMsg
        );
      }
    }

    const result = {
      sessionsCreated: Number(sessionsCreated?.count) || 0,
      registeredUsers: Number(registeredUsers?.count) || 0,
      flightsLogged,
    };

    try {
      await redisConnection.set(cacheKey, JSON.stringify(result), 'EX', 3600); // Cache for 1 hour
    } catch (error) {
      if (error instanceof Error) {
        console.warn(
          '[Redis] Failed to set cache for homepage stats:',
          error.message
        );
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch statistics',
    });
  }
});

// GET: /api/data/settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await getTesterSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching tester settings:', error);
    res.status(500).json({ error: 'Failed to fetch tester settings' });
  }
});

// GET: /api/data/notifications/active
router.get('/notifications/active', async (req, res) => {
  try {
    const notifications = await getActiveNotifications();
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching active notifications:', error);
    res.status(500).json({ error: 'Failed to fetch active notifications' });
  }
});

// GET: /api/data/leaderboard - Fetch top users for each stat (public)
router.get('/leaderboard', async (req, res) => {
  try {
    const leaderboard: Record<
      string,
      Array<{
        userId: string;
        username: string;
        avatar: string | null;
        score: number;
      }>
    > = {};
    interface TopUser {
      userId: string;
      username: string;
      avatar?: string | null;
      score: number;
    }
    for (const key of STATS_KEYS) {
      const users = (await getTopUsers(key, 10)) as TopUser[];
      const visibleUsers: TopUser[] = [];
      for (const user of users) {
        const userData = await getUserById(user.userId);
        if (!userData?.settings?.hideFromLeaderboard) {
          visibleUsers.push(user);
          if (visibleUsers.length >= 3) break;
        }
      }
      leaderboard[key] = visibleUsers.slice(0, 3).map((u) => ({
        userId: u.userId,
        username: u.username,
        avatar: u.avatar ?? null,
        score: u.score,
      }));
    }
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// GET: /api/data/tester-settings - get tester gate settings
router.get('/tester-settings', async (req, res) => {
  try {
    const host = req.get('host') || req.get('x-forwarded-host') || '';

    if (host === 'control.pfconnect.online') {
      return res.json({ tester_gate_enabled: false });
    }

    const settings = await getTesterSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching tester settings:', error);
    res.status(500).json({ error: 'Failed to fetch tester settings' });
  }
});

export default router;
