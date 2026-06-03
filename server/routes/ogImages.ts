import express from "express";
import { getPublicPilotProfile } from "../services/publicPilotProfile.js";
import { getPublicSubmitSession } from "../services/publicSubmitSession.js";
import { resolveProfileBackground } from "../og/profileBackground.js";
import { resolveSubmitSessionBackground } from "../og/submitBackground.js";
import { resolvedBackgroundToDataUrl } from "../og/resolvedBackgroundToDataUrl.js";
import {
  fetchAvatarDataUrl,
  renderPublicProfileOgPng,
} from "../og/renderProfileOgPng.js";
import { renderPublicSubmitOgPng } from "../og/renderSubmitOgPng.js";
import {
  getCachedProfileOgPng,
  profileOgCacheControlHeader,
  profileOgRedisKey,
  setCachedProfileOgPng,
} from "../og/profileOgCache.js";
import {
  getCachedSubmitOgPng,
  submitOgCacheControlHeader,
  submitOgRedisKey,
  setCachedSubmitOgPng,
} from "../og/submitOgCache.js";

const router = express.Router();

// GET /api/og/profile/:username — dynamic Open Graph PNG for pilot profiles
router.get("/profile/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const profile = await getPublicPilotProfile(username);
    if (!profile) {
      return res.status(404).end();
    }

    const cacheKey = profileOgRedisKey(profile);
    const cached = await getCachedProfileOgPng(cacheKey);
    if (cached) {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", profileOgCacheControlHeader());
      res.send(cached);
      return;
    }

    const frontendBase =
      (process.env.FRONTEND_URL || process.env.PUBLIC_SITE_URL || "")
        .trim()
        .replace(/\/$/, "") || "https://pfcontrol.com";
    const avatarDataUrl = await fetchAvatarDataUrl(profile);
    const resolvedBg = resolveProfileBackground(profile, frontendBase);
    const backgroundDataUrl = await resolvedBackgroundToDataUrl(resolvedBg);
    const png = await renderPublicProfileOgPng(
      profile,
      avatarDataUrl,
      backgroundDataUrl
    );
    await setCachedProfileOgPng(cacheKey, png);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", profileOgCacheControlHeader());
    res.send(png);
  } catch (error) {
    console.error("[og] profile png:", error);
    res.status(500).end();
  }
});

// GET /api/og/submit/:sessionId — dynamic Open Graph PNG for public submit sessions
router.get("/submit/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await getPublicSubmitSession(sessionId);
    if (!session) {
      return res.status(404).end();
    }

    const cacheKey = submitOgRedisKey(session);
    const cached = await getCachedSubmitOgPng(cacheKey);
    if (cached) {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", submitOgCacheControlHeader());
      res.send(cached);
      return;
    }

    const resolvedBg = resolveSubmitSessionBackground(session.airportIcao);
    const backgroundDataUrl = await resolvedBackgroundToDataUrl(resolvedBg);
    const png = await renderPublicSubmitOgPng(session, backgroundDataUrl);
    await setCachedSubmitOgPng(cacheKey, png);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", submitOgCacheControlHeader());
    res.send(png);
  } catch (error) {
    console.error("[og] submit png:", error);
    res.status(500).end();
  }
});

export default router;
