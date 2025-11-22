import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const airportsPath = path.join(__dirname, '..', 'data', 'airportData.json');
const aircraftPath = path.join(__dirname, '..', 'data', 'aircraftData.json');

export function getAirportData() {
  if (!fs.existsSync(airportsPath)) {
    throw new Error('Airport data not found');
  }
  return JSON.parse(fs.readFileSync(airportsPath, 'utf8'));
}

export function getAircraftData() {
  if (!fs.existsSync(aircraftPath)) {
    throw new Error('Aircraft data not found');
  }
  return JSON.parse(fs.readFileSync(aircraftPath, 'utf8'));
}
