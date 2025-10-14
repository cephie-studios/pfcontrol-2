import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const airportsPath = path.join(__dirname, '..', 'data', 'airportData.json');

const router = express.Router();

router.get('/airports', (_req, res) => {
  if (!fs.existsSync(airportsPath)) {
    return res.status(404).json({ error: "Airport data not found" });
  }
  const data = JSON.parse(fs.readFileSync(airportsPath, "utf8"));
  res.json(data);
});

export default router;