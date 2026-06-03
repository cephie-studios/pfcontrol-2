import express from "express";

import dataRouter from "./data.js";
import sessionRouter from "./sessions.js";
import flightsRouter from "./flights.js";
import authRouter from "./auth.js";
import chatsRouter from "./chats.js";
import metarRoutes from "./metar.js";
import atisRouter from "./atis.js";
import uploadsRouter from "./uploads.js";
import pilotRouter from "./pilot.js";
import adminRouter from "./admin/index.js";
import updateModalRouter from "./updateModal.js";
import versionRouter from "./version.js";
import feedbackRouter from "./feedback.js";
import ratingsRouter from "./ratings.js";
import developerRouter from "./developer.js";
import extV1Router from "./ext/v1.js";
import seoRouter from "./seo.js";
import ogImagesRouter from "./ogImages.js";

const router = express.Router();

router.use("/data", dataRouter);
router.use("/sessions", sessionRouter);
router.use("/flights", flightsRouter);
router.use("/auth", authRouter);
router.use("/chats", chatsRouter);
router.use("/metar", metarRoutes);
router.use("/atis", atisRouter);
router.use("/uploads", uploadsRouter);
router.use("/pilot", pilotRouter);
router.use("/admin", adminRouter);
router.use("/update-modal", updateModalRouter);
router.use("/version", versionRouter);
router.use("/feedback", feedbackRouter);
router.use("/ratings", ratingsRouter);
router.use("/developer", developerRouter);
router.use("/ext/v1", extV1Router);
router.use("/seo", seoRouter);
router.use("/og", ogImagesRouter);

export default router;
