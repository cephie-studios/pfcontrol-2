import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getTesterSettings } from '../db/testers.js';
import { getActiveNotifications } from '../db/notifications.js';

import dotenv from 'dotenv';
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: envFile });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const airportsPath = path.join(__dirname, '..', 'data', 'airportData.json');
const aircraftPath = path.join(__dirname, '..', 'data', 'aircraftData.json');
const airlinesPath = path.join(__dirname, '..', 'data', 'airlineData.json');
const backgroundsPath = path.join(__dirname, '..', '..', 'public', 'assets', 'app', 'backgrounds');

const router = express.Router();

// GET: /api/data/airports - list of airports
router.get('/airports', (req, res) => {
  try {
    if (!fs.existsSync(airportsPath)) {
      return res.status(404).json({ error: "Airport data not found" });
    }

    const data = JSON.parse(fs.readFileSync(airportsPath, "utf8"));
    res.json(data);
  } catch (error) {
    console.error("Error reading airport data:", error);
    res.status(500).json({ error: "Internal server error", message: "Error reading airport data" });
  }
});

// GET: /api/data/aircrafts - list of aircrafts
router.get('/aircrafts', (req, res) => {
  try {
    if (!fs.existsSync(aircraftPath)) {
      return res.status(404).json({ error: "Aircraft data not found" });
    }

    const data = JSON.parse(fs.readFileSync(aircraftPath, "utf8"));
    res.json(data);
  } catch (error) {
    console.error("Error reading aircraft data:", error);
    res.status(500).json({ error: "Internal server error", message: "Error reading aircraft data" });
  }
});

// GET: /api/data/airlines - list of airlines
router.get('/airlines', (req, res) => {
  try {
    if (!fs.existsSync(airlinesPath)) {
      return res.status(404).json({ error: "Airline data not found" });
    }

    const data = JSON.parse(fs.readFileSync(airlinesPath, "utf8"));
    res.json(data);
  } catch (error) {
    console.error("Error reading airline data:", error);
    res.status(500).json({ error: "Internal server error", message: "Error reading airline data" });
  }
});

// GET: /api/data/frequencies - list of airport frequencies
router.get('/frequencies', (req, res) => {
  try {
    if (!fs.existsSync(airportsPath)) {
      return res.status(404).json({ error: "Airport data not found" });
    }

    const freqOrder = ['APP', 'TWR', 'GND', 'DEL'];
    const freqMapping = {
      clearanceDelivery: 'DEL',
      departure: 'DEP',
      ground: 'GND',
      tower: 'TWR',
      approach: 'APP'
    };

    const data = JSON.parse(fs.readFileSync(airportsPath, "utf8"));
    const frequencies = data.map(airport => {
      const allFreqs = airport.allFrequencies || airport.frequencies || {};
      const displayFreqs = freqOrder
        .map(type => {
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

      const usedTypes = new Set(displayFreqs.map(f => f.type));
      const remainingFreqs = Object.entries(allFreqs)
        .filter(([key, value]) =>
          !usedTypes.has(key) &&
          !Object.keys(freqMapping).includes(key) &&
          value.toLowerCase() !== 'n/a'
        )
        .slice(0, 4 - displayFreqs.length)
        .map(([type, freq]) => ({ type: type.toUpperCase(), freq }));

      const allDisplayFreqs = [...displayFreqs, ...remainingFreqs].slice(0, 4);

      return {
        icao: airport.icao,
        name: airport.name,
        frequencies: allDisplayFreqs
      };
    });
    res.json(frequencies);
  } catch (error) {
    console.error("Error reading airport frequencies:", error);
    res.status(500).json({ error: "Internal server error", message: "Error reading airport frequencies" });
  }
});

// GET: /api/data/backgrounds - list of background images
router.get('/backgrounds', (req, res) => {
  try {
    if (!fs.existsSync(backgroundsPath)) {
      return res.status(404).json({ error: "Backgrounds directory not found" });
    }

    const files = fs.readdirSync(backgroundsPath);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];

    const backgroundImages = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return imageExtensions.includes(ext);
      })
      .map(file => ({
        filename: file,
        path: `/assets/app/backgrounds/${file}`,
        extension: path.extname(file).toLowerCase()
      }));

    res.json(backgroundImages);
  } catch (error) {
    console.error("Error reading background images:", error);
    res.status(500).json({ error: "Internal server error", message: "Error reading background images" });
  }
});

// GET: /api/data/airports/:icao/runways - runways for specific airport
router.get('/airports/:icao/runways', (req, res) => {
  try {
    if (!fs.existsSync(airportsPath)) {
      return res.status(404).json({ error: "Airport data not found" });
    }

    const data = JSON.parse(fs.readFileSync(airportsPath, "utf8"));
    const airport = data.find((a) => a.icao === req.params.icao);
    if (!airport) {
      return res.status(404).json({ error: "Airport not found" });
    }
    res.json(airport.runways || []);
  } catch (error) {
    console.error("Error reading airport data:", error);
    res.status(500).json({ error: "Internal server error", message: "Error reading airport data" });
  }
});

// GET: /api/data/airports/:icao/sids - sids for specific airport
router.get('/airports/:icao/sids', (req, res) => {
  try {
    if (!fs.existsSync(airportsPath)) {
      return res.status(404).json({ error: "Airport data not found" });
    }

    const data = JSON.parse(fs.readFileSync(airportsPath, "utf8"));
    const airport = data.find((a) => a.icao === req.params.icao);
    if (!airport) {
      return res.status(404).json({ error: "Airport not found" });
    }
    res.json(airport.sids || []);
  } catch (error) {
    console.error("Error reading airport data:", error);
    res.status(500).json({ error: "Internal server error", message: "Error reading airport data" });
  }
});

// GET: /api/data/airports/:icao/stars - stars for specific airport
router.get('/airports/:icao/stars', (req, res) => {
  try {
    if (!fs.existsSync(airportsPath)) {
      return res.status(404).json({ error: "Airport data not found" });
    }

    const data = JSON.parse(fs.readFileSync(airportsPath, "utf8"));
    const airport = data.find((a) => a.icao === req.params.icao);
    if (!airport) {
      return res.status(404).json({ error: "Airport not found" });
    }
    res.json(airport.stars || []);
  } catch (error) {
    console.error("Error reading airport data:", error);
    res.status(500).json({ error: "Internal server error", message: "Error reading airport data" });
  }
});

// GET: /api/data/statistics - get application statistics
router.get('/statistics', async (req, res) => {
  try {
    const pool = (await import('../db/connections/connection.js')).default;
    const flightsPool = (await import('../db/connections/flightsConnection.js')).default;
    const { getAllSessions } = await import('../db/sessions.js');

    const sessionsResult = await pool.query('SELECT COUNT(*) FROM sessions');
    const sessionsCreated = parseInt(sessionsResult.rows[0].count, 10);

    const usersResult = await pool.query('SELECT COUNT(*) FROM users');
    const registeredUsers = parseInt(usersResult.rows[0].count, 10);

    const sessions = await getAllSessions();
    let flightsLogged = 0;
    for (const session of sessions) {
      try {
        const flightResult = await flightsPool.query(`SELECT COUNT(*) FROM flights_${session.session_id}`);
        flightsLogged += parseInt(flightResult.rows[0].count, 10);
      } catch (error) {
        console.warn(`Could not count flights for session ${session.session_id}:`, error.message);
      }
    }

    res.set('Cache-Control', 'public, max-age=3600');

    res.json({
      sessionsCreated,
      registeredUsers,
      flightsLogged
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch statistics' });
  }
});

// GET: /api/data/settings - Get tester gate settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await getTesterSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching tester settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// GET: /api/data/notifications/active - Get active notifications (for Navbar)
router.get('/notifications/active', async (req, res) => {
  try {
    const notifications = await getActiveNotifications();
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching active notifications:', error);
    res.status(500).json({ error: 'Failed to fetch active notifications' });
  }
});

export default router;