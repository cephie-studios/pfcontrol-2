import express from 'express';

import { getAppVersion } from '../db/version.js';

import dataRouter from "./data.js";
import sessionRouter from "./sessions.js";
import flightsRouter from "./flights.js";
import authRouter from "./auth.js";
import chatsRouter from "./chats.js";
import metarRoutes from './metar.js';
import atisRouter from './atis.js';
import uploadsRouter from './uploads.js';
import pilotRouter from './pilot.js';
import adminRouter from './admin/index.js';
import updateModalRouter from './updateModal.js';

const router = express.Router();

router.use("/data", dataRouter);
router.use("/sessions", sessionRouter);
router.use("/flights", flightsRouter);
router.use("/auth", authRouter);
router.use("/chats", chatsRouter);
router.use('/metar', metarRoutes);
router.use('/atis', atisRouter);
router.use('/uploads', uploadsRouter);
router.use('/pilot', pilotRouter);
router.use('/admin', adminRouter);
router.use('/update-modal', updateModalRouter);

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