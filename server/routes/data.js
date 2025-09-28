// routes/data.js
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: envFile });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const airportsPath = path.join(__dirname, '..', 'data', 'airportData.json');
const aircraftPath = path.join(__dirname, '..', 'data', 'aircraftData.json');

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

export default router;