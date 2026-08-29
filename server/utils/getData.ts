import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const airportsPath = path.join(__dirname, '..', 'data', 'airportData.json');
const airportsLegacyPath = path.join(
  __dirname,
  '..',
  'data',
  'airportDataLegacy.json'
);
const aircraftPath = path.join(__dirname, '..', 'data', 'aircraftData.json');
const waypointsPath = path.join(__dirname, '..', 'data', 'waypointData.json');

// Update 9: merges the current active roster with retired airports kept in airportDataLegacy.json
export function getAirportData() {
  if (!fs.existsSync(airportsPath)) {
    throw new Error('Airport data not found');
  }
  const base = JSON.parse(fs.readFileSync(airportsPath, 'utf8'));
  const legacy = fs.existsSync(airportsLegacyPath)
    ? JSON.parse(fs.readFileSync(airportsLegacyPath, 'utf8'))
    : [];
  return [...base, ...legacy];
}

export function getAircraftData() {
  if (!fs.existsSync(aircraftPath)) {
    throw new Error('Aircraft data not found');
  }
  return JSON.parse(fs.readFileSync(aircraftPath, 'utf8'));
}

export function getWaypointData() {
  if (!fs.existsSync(waypointsPath)) {
    throw new Error('Waypoint data not found');
  }
  return JSON.parse(fs.readFileSync(waypointsPath, 'utf8'));
}
