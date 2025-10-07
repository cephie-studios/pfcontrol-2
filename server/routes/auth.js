import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { createOrUpdateUser, getUserById, updateUserSettings, updateRobloxAccount, unlinkRobloxAccount } from '../db/users.js';
import { authLimiter } from '../middleware/security.js';
import { detectVPN } from '../tools/detectVPN.js';
import { isAdmin } from '../middleware/isAdmin.js';
import { recordLogin, recordNewUser } from '../db/statistics.js';
import { isUserBanned } from '../db/ban.js';
import { isTester } from '../db/testers.js';
import { getClientIp } from '../tools/getIpAddress.js';
import requireAuth from '../middleware/isAuthenticated.js';

const router = express.Router();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const FRONTEND_URL = process.env.FRONTEND_URL;
const JWT_SECRET = process.env.JWT_SECRET;

const ROBLOX_CLIENT_ID = process.env.ROBLOX_CLIENT_ID;
const ROBLOX_CLIENT_SECRET = process.env.ROBLOX_CLIENT_SECRET;
const ROBLOX_REDIRECT_URI = process.env.ROBLOX_REDIRECT_URI;

// GET: /api/auth/discord - redirect to Discord for authentication
router.get('/discord', (req, res) => {
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(discordAuthUrl);
});

// GET: /api/auth/discord/callback - handle Discord OAuth2 callback
router.get('/discord/callback', authLimiter, async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'Authorization code missing' });
    }

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token',
            new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
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

        const ipAddress = getClientIp(req);
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

        const token = jwt.sign(payload, JWT_SECRET, {
            algorithm: 'HS256'
        });

        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
            path: '/'
        });

        res.redirect(FRONTEND_URL + '/');

    } catch (error) {
        console.error('Discord auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// GET: /api/auth/roblox - redirect to Roblox for authentication
router.get('/roblox', requireAuth, (req, res) => {
    const state = jwt.sign({ userId: req.user.userId }, JWT_SECRET, { expiresIn: '15m' });

    const params = new URLSearchParams({
        client_id: ROBLOX_CLIENT_ID,
        redirect_uri: ROBLOX_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid profile',
        state: state
    });

    const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?${params.toString()}`;
    res.redirect(robloxAuthUrl);
});

// GET: /api/auth/roblox/callback - handle Roblox OAuth2 callback
router.get('/roblox/callback', authLimiter, async (req, res) => {
    const { code, state } = req.query;

    if (!code || !state) {
        return res.redirect(FRONTEND_URL + '/settings?error=roblox_auth_failed');
    }

    try {
        const decoded = jwt.verify(state, JWT_SECRET);
        const userId = decoded.userId;

        const tokenResponse = await axios.post('https://apis.roblox.com/oauth/v1/token',
            new URLSearchParams({
                client_id: ROBLOX_CLIENT_ID,
                client_secret: ROBLOX_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
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
        await unlinkRobloxAccount(req.user.userId);
        res.json({ success: true, message: 'Roblox account unlinked' });
    } catch (error) {
        console.error('Error unlinking Roblox:', error);
        res.status(500).json({ error: 'Failed to unlink Roblox account' });
    }
});

// GET: /api/auth/me - get current user info
router.get('/me', requireAuth, async (req, res) => {
    try {
        const user = await getUserById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const banRecord = await isUserBanned(req.user.userId);

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
            rolePermissions: user.rolePermissions,
            robloxUserId: user.robloxUserId,
            robloxUsername: user.robloxUsername,
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT: /api/auth/me - update current user settings
router.put('/me', requireAuth, async (req, res) => {
    try {
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