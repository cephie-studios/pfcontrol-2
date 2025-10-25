import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { createOrUpdateUser, getUserById, updateUserSettings, updateRobloxAccount, unlinkRobloxAccount, updateTutorialStatus } from '../db/users.js';
import { authLimiter } from '../middleware/security.js';
import { detectVPN } from '../utils/detectVPN.js';
import { isAdmin } from '../middleware/admin.js';
import { recordLogin, recordNewUser } from '../db/statistics.js';
import { isUserBanned } from '../db/ban.js';
import { isTester } from '../db/testers.js';
import { getClientIp } from '../utils/getIpAddress.js';
import { getUserRank, STATS_KEYS } from '../db/leaderboard.js';
import requireAuth from '../middleware/auth.js';

const router = express.Router();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET ?? '';
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI ?? '';
const FRONTEND_URL = process.env.FRONTEND_URL ?? '';
const JWT_SECRET = process.env.JWT_SECRET ?? '';

const ROBLOX_CLIENT_ID = process.env.ROBLOX_CLIENT_ID ?? '';
const ROBLOX_CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET ?? '';
const ROBLOX_REDIRECT_URI = process.env.ROBLOX_REDIRECT_URI ?? '';

// VATSIM OAuth (linking)
const VATSIM_CLIENT_ID = process.env.VATSIM_CLIENT_ID ?? '';
const VATSIM_CLIENT_SECRET = process.env.VATSIM_CLIENT_SECRET ?? '';
const VATSIM_REDIRECT_URI = process.env.VATSIM_REDIRECT_URI ?? '';
const VATSIM_AUTH_BASE = process.env.VATSIM_AUTH_BASE ?? '';

// GET: /api/auth/discord - redirect to Discord for authentication
router.get('/discord', (req, res) => {
    if (!CLIENT_ID || !REDIRECT_URI) {
        return res.status(500).json({ error: 'Discord OAuth not configured' });
    }
    const callback = typeof req.query.callback === 'string' ? req.query.callback : undefined;
    const state = callback ? Buffer.from(JSON.stringify({ callback })).toString('base64') : undefined;

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'identify'
    });

    if (state) {
        params.set('state', state);
    }

    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
    res.redirect(discordAuthUrl);
});

// GET: /api/auth/discord/callback - handle Discord OAuth2 callback
router.get('/discord/callback', authLimiter, async (req, res) => {
    const { code, state } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'Authorization code missing' });
    }

    let callback: string | undefined;
    if (state && typeof state === 'string') {
        try {
            const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
            if (decoded && typeof decoded === 'object' && typeof decoded.callback === 'string') {
                callback = decoded.callback;
            }
        } catch (err) {
            console.error('Error decoding state:', err);
        }
    }

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: String(CLIENT_ID),
                client_secret: String(CLIENT_SECRET),
                grant_type: 'authorization_code',
                code: String(code),
                redirect_uri: String(REDIRECT_URI),
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        const { access_token, refresh_token } = tokenResponse.data;

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        const discordUser = userResponse.data;

        let ipAddress = getClientIp(req);
        if (Array.isArray(ipAddress)) ipAddress = ipAddress[0] || '';
        const isVpn = await detectVPN(req);

        const existingUser = await getUserById(discordUser.id);
        const isNewUser = !existingUser;

        await createOrUpdateUser({
            id: discordUser.id,
            username: discordUser.username,
            discriminator: discordUser.discriminator || '0',
            avatar: discordUser.avatar,
            accessToken: access_token,
            refreshToken: refresh_token,
            ipAddress: ipAddress,
            isVpn: isVpn
        });

        await recordLogin();
        if (isNewUser) {
            await recordNewUser();
        }

        const payload = {
            userId: discordUser.id,
            username: discordUser.username,
            discriminator: discordUser.discriminator || '0',
            avatar: discordUser.avatar,
            isAdmin: isAdmin(discordUser.id),
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7d
        };

        const token = jwt.sign(payload, JWT_SECRET as string, {
            algorithm: 'HS256'
        });

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
            path: '/'
        });

        const redirectUrl = callback && callback.startsWith('/')
            ? FRONTEND_URL + callback
            : FRONTEND_URL + '/';
        res.redirect(redirectUrl);

    } catch (error) {
        console.error('Discord auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// GET: /api/auth/roblox - redirect to Roblox for authentication
router.get('/roblox', requireAuth, (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const state = jwt.sign({ userId: req.user.userId }, JWT_SECRET as string, { expiresIn: '15m' });

    const params = new URLSearchParams({
        client_id: String(ROBLOX_CLIENT_ID),
        redirect_uri: String(ROBLOX_REDIRECT_URI),
        response_type: 'code',
        scope: 'openid profile',
        state: state
    });

    const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?${params.toString()}`;
    res.redirect(robloxAuthUrl);
});

// GET: /api/auth/roblox/callback - handle Roblox OAuth2 callback
router.get('/roblox/callback', authLimiter, async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';

    if (!code || !state) {
        return res.redirect(FRONTEND_URL + '/settings?error=roblox_auth_failed');
    }

    try {
        const decoded = jwt.verify(state, JWT_SECRET as string) as { userId: string };
        const userId = (decoded).userId;

        const tokenResponse = await axios.post('https://apis.roblox.com/oauth/v1/token',
            new URLSearchParams({
                client_id: String(ROBLOX_CLIENT_ID),
                client_secret: String(ROBLOX_CLIENT_SECRET),
                grant_type: 'authorization_code',
                code: String(code),
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        const { access_token, refresh_token } = tokenResponse.data;

        const userResponse = await axios.get('https://apis.roblox.com/oauth/v1/userinfo', {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        const robloxUser = userResponse.data;

        await updateRobloxAccount(userId, {
            robloxUserId: robloxUser.sub,
            robloxUsername: robloxUser.preferred_username || robloxUser.name,
            accessToken: access_token,
            refreshToken: refresh_token
        });

        res.redirect(FRONTEND_URL + '/settings?roblox_linked=true');
    } catch (error) {
        console.error('Roblox auth error:', error);
        res.redirect(FRONTEND_URL + '/settings?error=roblox_auth_failed');
    }
});

// POST: /api/auth/roblox/unlink - unlink Roblox account
router.post('/roblox/unlink', requireAuth, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        await unlinkRobloxAccount(req.user.userId);
        res.json({ success: true, message: 'Roblox account unlinked' });
    } catch (error) {
        console.error('Error unlinking Roblox:', error);
        res.status(500).json({ error: 'Failed to unlink Roblox account' });
    }
});

// GET: /api/auth/vatsim - redirect to VATSIM for linking
router.get('/vatsim', requireAuth, (req, res) => {
    if (!VATSIM_CLIENT_ID || !VATSIM_REDIRECT_URI || !VATSIM_AUTH_BASE) {
        return res.status(500).json({ error: 'VATSIM OAuth not configured' });
    }
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const state = jwt.sign({ userId: req.user.userId }, JWT_SECRET as string, { expiresIn: '15m' });
    const params = new URLSearchParams({
        client_id: String(VATSIM_CLIENT_ID),
        redirect_uri: String(VATSIM_REDIRECT_URI),
        response_type: 'code',
        scope: 'vatsim_details',
        state
    });
    const forceCookie = req.cookies && req.cookies.vatsim_force === '1';
    if (req.query.force === '1' || req.query.force === 'true' || forceCookie) {
        params.set('prompt', 'login');
        params.set('approval_prompt', 'force');
        if (forceCookie) {
            res.clearCookie('vatsim_force', { path: '/' });
        }
    }
    const url = `${VATSIM_AUTH_BASE.replace(/\/$/, '')}/oauth/authorize?${params.toString()}`;
    res.redirect(url);
});

// GET: /api/auth/vatsim/callback - handle VATSIM OAuth2 callback (server-side)
router.get('/vatsim/callback', authLimiter, async (req, res) => {

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state) {
        return res.redirect(FRONTEND_URL + '/settings?error=vatsim_auth_failed');
    }

    try {
        let decoded;
        try {
            decoded = jwt.verify(String(state), JWT_SECRET as string);
        } catch (err) {
            return res.redirect(FRONTEND_URL + '/settings?error=vatsim_auth_failed');
        }
        let userId: string | undefined;
        if (typeof decoded === 'object' && decoded !== null && 'userId' in decoded) {
            userId = (decoded as { userId: string }).userId;
        }
        if (!userId) {
            return res.redirect(FRONTEND_URL + '/settings?error=vatsim_auth_failed');
        }

        if (!VATSIM_CLIENT_ID || !VATSIM_CLIENT_SECRET || !VATSIM_REDIRECT_URI) {
            return res.redirect(FRONTEND_URL + '/settings?error=vatsim_not_configured');
        }

        const basic = Buffer.from(`${VATSIM_CLIENT_ID}:${VATSIM_CLIENT_SECRET}`).toString('base64');
        const tokenResponse = await axios.post(
            `${VATSIM_AUTH_BASE.replace(/\/$/, '')}/oauth/token`,
            new URLSearchParams({
                grant_type: 'authorization_code',
                code: String(code),
                redirect_uri: String(VATSIM_REDIRECT_URI),
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'Authorization': `Basic ${basic}`,
                }
            }
        );

        const { access_token } = tokenResponse.data || {};
        if (!access_token) {
            return res.redirect(FRONTEND_URL + '/settings?error=vatsim_token_failed');
        }

        const userResponse = await axios.get(`${VATSIM_AUTH_BASE.replace(/\/$/, '')}/api/user`, {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        const payload = userResponse.data || {};
        const root = payload.data || payload.user || payload;
        const cid = String(root?.cid ?? root?.id ?? '');
        const candidates = [
            root?.rating?.controller,
            root?.ratings?.controller,
            root?.ratings?.atc,
            root?.controller_rating,
            root?.controller,
            root?.rating,
            root?.vatsim?.rating,
            root?.vatsim?.ratings?.controller,
        ].filter(Boolean);
        let ratingShort = null;
        let ratingLong = null;
        let numeric = null;
        for (const r of candidates) {
            if (r == null) continue;
            if (typeof r === 'number' || typeof r === 'string') {
                const n = typeof r === 'number' ? r : parseInt(String(r), 10);
                if (Number.isFinite(n)) { numeric = n; break; }
            } else if (typeof r === 'object') {
                const id = r.id ?? r.rating ?? r.controller;
                if (id != null) {
                    const n = typeof id === 'number' ? id : parseInt(String(id), 10);
                    if (Number.isFinite(n)) numeric = n;
                }
                ratingShort = r.short || r.short_name || ratingShort;
                ratingLong = r.long || r.long_name || ratingLong;
                if (numeric != null || ratingShort || ratingLong) break;
            }
        }
        // parsed for VATSIM callback handled
        const fallbackMap: Record<number, string> = { 0: 'OBS', 1: 'S1', 2: 'S2', 3: 'S3', 4: 'C1', 5: 'C2', 6: 'C3', 7: 'I1', 8: 'I2', 9: 'I3', 10: 'SUP', 11: 'ADM' };
        const fallbackShort = ratingShort || (numeric != null && Number.isFinite(numeric) ? fallbackMap[numeric as number] || null : null);

        const { updateVatsimAccount } = await import('../db/users.js');
        await updateVatsimAccount(userId, {
            vatsimCid: cid || '',
            ratingId: Number.isFinite(numeric) ? numeric as number : 0,
            ratingShort: fallbackShort ?? undefined,
            ratingLong: ratingLong ?? undefined,
        });

        res.redirect(FRONTEND_URL + '/settings?vatsim_linked=true');
    } catch (error) {
        if (error instanceof Error) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            console.error('VATSIM link error (callback):', (error as any)?.response?.data || error.message);
        } else {
            console.error('VATSIM link error (callback):', error);
        }
        res.redirect(FRONTEND_URL + '/settings?error=vatsim_auth_failed');
    }
});

// POST: /api/auth/vatsim/exchange - exchange code to link account
router.post('/vatsim/exchange', authLimiter, requireAuth, async (req, res) => {
    try {
        const code = typeof req.body.code === 'string' ? req.body.code : '';
        const state = typeof req.body.state === 'string' ? req.body.state : '';
        if (!code || !state) {
            return res.status(400).json({ error: 'Missing code or state' });
        }
        let decoded: { userId?: string };
        try {
            decoded = jwt.verify(state, JWT_SECRET as string) as { userId?: string };
        } catch {
            return res.status(400).json({ error: 'Invalid state' });
        }
        if (!decoded || (decoded).userId !== req.user?.userId) {
            return res.status(400).json({ error: 'State/user mismatch' });
        }
        if (!VATSIM_CLIENT_ID || !VATSIM_CLIENT_SECRET || !VATSIM_REDIRECT_URI) {
            return res.status(500).json({ error: 'VATSIM OAuth not configured' });
        }

        // Per VATSIM Connect docs, client must authenticate via HTTP Basic
        const basic = Buffer.from(`${VATSIM_CLIENT_ID}:${VATSIM_CLIENT_SECRET}`).toString('base64');
        const tokenResponse = await axios.post(
            `${VATSIM_AUTH_BASE.replace(/\/$/, '')}/oauth/token`,
            new URLSearchParams({
                grant_type: 'authorization_code',
                code: String(code),
                redirect_uri: String(VATSIM_REDIRECT_URI),
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    'Authorization': `Basic ${basic}`,
                }
            }
        );
        const { access_token } = tokenResponse.data || {};
        if (!access_token) {
            return res.status(500).json({ error: 'Failed to retrieve VATSIM token' });
        }
        const userResponse = await axios.get(`${VATSIM_AUTH_BASE.replace(/\/$/, '')}/api/user`, {
            headers: { Authorization: `Bearer ${access_token}` },
        });
        const payload = userResponse.data || {};
        const root = payload.data || payload.user || payload;
        const cid = String(root?.cid ?? root?.id ?? '');
        const candidates2 = [
            root?.rating?.controller,
            root?.ratings?.controller,
            root?.ratings?.atc,
            root?.controller_rating,
            root?.controller,
            root?.rating,
            root?.vatsim?.rating,
            root?.vatsim?.ratings?.controller,
        ].filter(Boolean);
        let ratingShort2 = null;
        let ratingLong2 = null;
        let numeric2 = null;
        for (const r of candidates2) {
            if (r == null) continue;
            if (typeof r === 'number' || typeof r === 'string') {
                const n = typeof r === 'number' ? r : parseInt(String(r), 10);
                if (Number.isFinite(n)) { numeric2 = n; break; }
            } else if (typeof r === 'object') {
                const id = r.id ?? r.rating ?? r.controller;
                if (id != null) {
                    const n = typeof id === 'number' ? id : parseInt(String(id), 10);
                    if (Number.isFinite(n)) numeric2 = n;
                }
                ratingShort2 = r.short || r.short_name || ratingShort2;
                ratingLong2 = r.long || r.long_name || ratingLong2;
                if (numeric2 != null || ratingShort2 || ratingLong2) break;
            }
        }
        // parsed for VATSIM exchange handled
        const fallbackMap2: Record<number, string> = { 0: 'OBS', 1: 'S1', 2: 'S2', 3: 'S3', 4: 'C1', 5: 'C2', 6: 'C3', 7: 'I1', 8: 'I2', 9: 'I3', 10: 'SUP', 11: 'ADM' };
        const fallbackShort = ratingShort2 || (numeric2 != null && Number.isFinite(numeric2) ? fallbackMap2[numeric2 as number] || null : null);

        const { updateVatsimAccount } = await import('../db/users.js');
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        await updateVatsimAccount(req.user.userId, {
            vatsimCid: cid || '',
            ratingId: Number.isFinite(numeric2) ? numeric2 as number : 0,
            ratingShort: fallbackShort ?? undefined,
            ratingLong: ratingLong2 ?? undefined,
        });
        res.json({ success: true, vatsimCid: cid, ratingShort: fallbackShort, ratingLong: ratingLong2 });
    } catch (error) {
        if (error instanceof Error) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            console.error('VATSIM link error:', (error as any)?.response?.data || error.message);
        } else {
            console.error('VATSIM link error:', error);
        }
        res.status(500).json({ error: 'VATSIM link failed' });
    }
});

// POST: /api/auth/vatsim/unlink - unlink
router.post('/vatsim/unlink', requireAuth, async (req, res) => {
    try {
        const { unlinkVatsimAccount } = await import('../db/users.js');
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        await unlinkVatsimAccount(req.user.userId);
        res.cookie('vatsim_force', '1', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 5 * 60 * 1000,
            path: '/',
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error unlinking VATSIM:', error);
        res.status(500).json({ error: 'Failed to unlink VATSIM account' });
    }
});

// PUT: /api/auth/tutorial - update tutorial completion status
router.put('/tutorial', requireAuth, async (req, res) => {
    try {
        const { completed } = req.body;
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        await updateTutorialStatus(req.user.userId, completed);
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: 'Failed to update tutorial status' });
    }
});

// GET: /api/auth/me - get current user info
router.get('/me', requireAuth, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const user = await getUserById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const banRecord = await isUserBanned(req.user.userId);

        const ranks: Record<string, number | null> = {};
        for (const key of STATS_KEYS) {
            ranks[key] = await getUserRank(req.user.userId, key);
        }

        res.json({
            userId: req.user.userId,
            username: req.user.username,
            discriminator: req.user.discriminator,
            avatar: req.user.avatar ? `https://cdn.discordapp.com/avatars/${req.user.userId}/${req.user.avatar}.png` : null,
            settings: user.settings || {},
            lastLogin: user.lastLogin,
            totalSessionsCreated: user.totalSessionsCreated || 0,
            isAdmin: isAdmin(req.user.userId),
            isBanned: !!banRecord,
            isTester: await isTester(req.user.userId),
            roleId: user.roleId,
            roleName: user.roleName,
            rolePermissions: user.role_permissions || {},
            robloxUserId: user.roblox_user_id,
            robloxUsername: user.roblox_username,
            vatsimCid: user.vatsim_cid,
            vatsimRatingId: user.vatsim_rating_id,
            vatsimRatingShort: user.vatsim_rating_short,
            vatsimRatingLong: user.vatsim_rating_long,
            statistics: user.statistics || {},
            ranks,
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT: /api/auth/me - update current user settings
router.put('/me', requireAuth, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Invalid settings payload' });
        }

        const updatedUser = await updateUserSettings(req.user.userId, settings);

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            userId: req.user.userId,
            username: req.user.username,
            discriminator: req.user.discriminator,
            avatar: req.user.avatar ? `https://cdn.discordapp.com/avatars/${req.user.userId}/${req.user.avatar}.png` : null,
            isAdmin: req.user.isAdmin,
            settings: updatedUser.settings,
            lastLogin: updatedUser.lastLogin,
            totalSessionsCreated: updatedUser.totalSessionsCreated || 0
        });
    } catch (error) {
        console.error('Error updating user settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// POST: /api/auth/logout - log out user
router.post('/logout', (req, res) => {
    res.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });
    res.json({ message: 'Logged out successfully' });
});

export default router;
