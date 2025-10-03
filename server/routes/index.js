import express from "express";

import dataRouter from "./data.js";
import sessionRouter from "./sessions.js";
import flightsRouter from "./flights.js";
import authRouter from "./auth.js";
import chatsRouter from "./chats.js";
import metarRoutes from './metar.js';
import atisRouter from './atis.js';

const router = express.Router();

router.use("/data", dataRouter);
router.use("/sessions", sessionRouter);
router.use("/flights", flightsRouter);
router.use("/auth", authRouter);
router.use("/chats", chatsRouter);
router.use('/metar', metarRoutes);
router.use('/atis', atisRouter);

export default router;