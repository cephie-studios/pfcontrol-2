import express from 'express';

import { getAppVersion } from '../db/version';

import dataRouter from './data';

const router = express.Router();

router.use('/data', dataRouter);

router.get('/version', async (_req, res) => {
  try {
    const version = await getAppVersion();
    res.json({ version: version.version });
  } catch (error) {
    console.error('Error fetching version:', error);
    res.json({ version: '2.0.0.3' });
  }
});

export default router;