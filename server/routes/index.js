import express from "express";

import dataRouter from "./data.js";
import sessionRouter from "./sessions.js";
import authRouter from "./auth.js";

const router = express.Router();

router.use("/data", dataRouter);
router.use("/sessions", sessionRouter);
router.use("/auth", authRouter);

export default router;