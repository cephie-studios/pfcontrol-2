import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getTesterSettings } from '../db/testers';
import { getActiveNotifications } from '../db/notifications';
import { mainDb, flightsDb } from '../db/connection';
import { sql } from 'kysely';

import dotenv from 'dotenv';
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: envFile });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const airportsPath = path.join(__dirname, '..', 'data', 'airportData.json');
const aircraftPath = path.join(__dirname, '..', 'data', 'aircraftData.json');
const airlinesPath = path.join(__dirname, '..', 'data', 'airlineData.json');
const backgroundsPath = path.join(__dirname, '..', '..', 'public', 'assets', 'app', 'backgrounds');

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
router.get('/airports', (req, res) => {
    try {
        if (!fs.existsSync(airportsPath)) {
            return res.status(404).json({ error: "Airport data not found" });
        }

        const data: Airport[] = JSON.parse(fs.readFileSync(airportsPath, "utf8"));
        res.json(data);
    } catch (error) {
        console.error("Error reading airport data:", error);
        res.status(500).json({ error: "Internal server error", message: "Error reading airport data" });
    }
});

// GET: /api/data/aircrafts
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

// GET: /api/data/airlines
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

// GET: /api/data/frequencies
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

        const data: Airport[] = JSON.parse(fs.readFileSync(airportsPath, "utf8"));
        const frequencies = data.map((airport: Airport) => {
            const allFreqs = airport.allFrequencies || {};
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

            const usedTypes = new Set(displayFreqs.map(f => f!.type));
            const remainingFreqs = Object.entries(allFreqs)
                .filter(([key, value]) =>
                    !usedTypes.has(key) &&
                    !Object.keys(freqMapping).includes(key) &&
                    value && value.toLowerCase() !== 'n/a'
                )
                .slice(0, 4 - displayFreqs.length)
                .map(([type, freq]) => ({ type: type.toUpperCase(), freq }));

            const allDisplayFreqs = [...displayFreqs.filter(Boolean), ...remainingFreqs].slice(0, 4);

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

// GET: /api/data/backgrounds
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

// GET: /api/data/airports/:icao/runways
router.get('/airports/:icao/runways', (req, res) => {
    try {
        if (!fs.existsSync(airportsPath)) {
            return res.status(404).json({ error: "Airport data not found" });
        }

        const data: Airport[] = JSON.parse(fs.readFileSync(airportsPath, "utf8"));
        const airport = data.find((a: Airport) => a.icao === req.params.icao);
        if (!airport) {
            return res.status(404).json({ error: "Airport not found" });
        }
        res.json(airport.runways || []);
    } catch (error) {
        console.error("Error reading airport data:", error);
        res.status(500).json({ error: "Internal server error", message: "Error reading airport data" });
    }
});

// GET: /api/data/airports/:icao/sids
router.get('/airports/:icao/sids', (req, res) => {
    try {
        if (!fs.existsSync(airportsPath)) {
            return res.status(404).json({ error: "Airport data not found" });
        }

        const data: Airport[] = JSON.parse(fs.readFileSync(airportsPath, "utf8"));
        const airport = data.find((a: Airport) => a.icao === req.params.icao);
        if (!airport) {
            return res.status(404).json({ error: "Airport not found" });
        }
        res.json(airport.sids || []);
    } catch (error) {
        console.error("Error reading airport data:", error);
        res.status(500).json({ error: "Internal server error", message: "Error reading airport data" });
    }
});

// GET: /api/data/airports/:icao/stars
router.get('/airports/:icao/stars', (req, res) => {
    try {
        if (!fs.existsSync(airportsPath)) {
            return res.status(404).json({ error: "Airport data not found" });
        }

        const data: Airport[] = JSON.parse(fs.readFileSync(airportsPath, "utf8"));
        const airport = data.find((a: Airport) => a.icao === req.params.icao);
        if (!airport) {
            return res.status(404).json({ error: "Airport not found" });
        }
        res.json(airport.stars || []);
    } catch (error) {
        console.error("Error reading airport data:", error);
        res.status(500).json({ error: "Internal server error", message: "Error reading airport data" });
    }
});

// GET: /api/data/statistics
router.get('/statistics', async (req, res) => {
    try {
        const { getAllSessions } = await import('../db/sessions.js');

        const sessionsResult = await mainDb.selectFrom('sessions').select(sql`count(*)`.as('count')).executeTakeFirst();
        const sessionsCreated = parseInt(sessionsResult!.count as string, 10);

        const usersResult = await mainDb.selectFrom('users').select(sql`count(*)`.as('count')).executeTakeFirst();
        const registeredUsers = parseInt(usersResult!.count as string, 10);

        const sessions = await getAllSessions();
        let flightsLogged = 0;
        for (const session of sessions) {
            try {
                const tableName = `flights_${session.session_id}` as keyof typeof flightsDb.schema;
                const flightResult = await flightsDb.selectFrom(tableName).select(sql`count(*)`.as('count')).executeTakeFirst();
                flightsLogged += parseInt(flightResult!.count as string, 10);
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                console.warn(`Could not count flights for session ${session.session_id}:`, errMsg);
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

// GET: /api/data/settings
router.get('/settings', async (req, res) => {
    try {
        const settings = await getTesterSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error fetching tester settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
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

export default router;