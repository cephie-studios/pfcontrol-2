import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createOrUpdateUser, getUserById } from '../db/users.js';
import { authLimiter } from '../middleware/security.js';
import { detectVPN } from '../tools/detectVPN.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const FRONTEND_URL = process.env.FRONTEND_URL;
const JWT_SECRET = process.env.JWT_SECRET;

export function isAdmin(userId) {
    try {
        const adminsPath = path.join(__dirname, '..', 'data', 'admins.json');
        const adminIds = JSON.parse(fs.readFileSync(adminsPath, 'utf8'));
        return adminIds.includes(userId);
    } catch (error) {
        console.error('Error reading admin IDs:', error);
        return false;
    }
}

export const verifyToken = (req, res, next) => {
    const token = req.cookies.auth_token;

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

router.get('/discord', (req, res) => {
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(discordAuthUrl);
});

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

        const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
        const isVpn = await detectVPN(ipAddress);

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

router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await getUserById(req.user.userId);

        res.json({
            userId: req.user.userId,
            username: req.user.username,
            discriminator: req.user.discriminator,
            avatar: req.user.avatar ? `https://cdn.discordapp.com/avatars/${req.user.userId}/${req.user.avatar}.png` : null,
            isAdmin: req.user.isAdmin,
            settings: user?.settings || {},
            lastLogin: user?.lastLogin,
            totalSessionsCreated: user?.totalSessionsCreated || 0
        });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

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