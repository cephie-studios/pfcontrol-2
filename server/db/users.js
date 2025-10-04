import pool from './connections/connection.js';
import { encrypt, decrypt } from '../tools/encryption.js';

async function initializeUsersTable() {
    try {
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'users'
            )
        `);
        const exists = result.rows[0].exists;

        if (!exists) {
            await pool.query(`
                CREATE TABLE users (
                    id VARCHAR(20) PRIMARY KEY,
                    username VARCHAR(32) NOT NULL,
                    discriminator VARCHAR(4) DEFAULT '0',
                    avatar VARCHAR(32),
                    access_token TEXT,
                    refresh_token TEXT,
                    last_login TIMESTAMP DEFAULT NOW(),
                    ip_address INET,
                    is_vpn BOOLEAN DEFAULT false,
                    sessions TEXT DEFAULT '[]',
                    last_session_created TIMESTAMP,
                    last_session_deleted TIMESTAMP,
                    settings TEXT,
                    settings_updated_at TIMESTAMP DEFAULT NOW(),
                    total_sessions_created INTEGER DEFAULT 0,
                    total_minutes INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
        }
    } catch (error) {
        console.error('Error initializing users table:', error);
    }
}

export async function createOrUpdateUser(userData) {
    const {
        id,
        username,
        discriminator = '0',
        avatar,
        accessToken,
        refreshToken,
        ipAddress,
        isVpn = false
    } = userData;

    try {
        const defaultSettings = {
            sounds: {
                startupSound: { enabled: true, volume: 100 },
                chatNotificationSound: { enabled: true, volume: 100 },
                newStripSound: { enabled: true, volume: 100 }
            },
            backgroundImage: {
                selectedImage: null,
                useCustomBackground: false,
                favorites: []
            },
            layout: {
                showCombinedView: false,
                flightRowOpacity: 100
            },
            departureTableColumns: {
                time: true, // cannot be disabled
                callsign: true,
                stand: true,
                aircraft: true,
                wakeTurbulence: true,
                flightType: true,
                arrival: true,
                runway: true,
                sid: true,
                rfl: true,
                cfl: true,
                squawk: true,
                clearance: true,
                status: true,
                remark: true,
                pdc: true,
                hide: true,
                delete: true
            },
            arrivalsTableColumns: {
                time: true, // cannot be disabled
                callsign: true,
                gate: true,
                aircraft: true,
                wakeTurbulence: true,
                flightType: true,
                departure: true,
                runway: true,
                star: true,
                rfl: true,
                cfl: true,
                squawk: true,
                status: true,
                remark: true,
                hide: true
            },
        };

        const existingUser = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

        if (existingUser.rows.length > 0) {
            const encryptedAccessToken = encrypt(accessToken);
            const encryptedRefreshToken = encrypt(refreshToken);

            await pool.query(`
                UPDATE users SET
                    username = $2,
                    discriminator = $3,
                    avatar = $4,
                    access_token = $5,
                    refresh_token = $6,
                    last_login = NOW(),
                    ip_address = $7,
                    is_vpn = $8,
                    updated_at = NOW()
                WHERE id = $1
            `, [
                id,
                username,
                discriminator,
                avatar,
                JSON.stringify(encryptedAccessToken),
                JSON.stringify(encryptedRefreshToken),
                ipAddress,
                isVpn
            ]);

            return await getUserById(id);
        } else {
            // Create new user
            const encryptedAccessToken = encrypt(accessToken);
            const encryptedRefreshToken = encrypt(refreshToken);
            const encryptedSettings = encrypt(defaultSettings);
            const encryptedSessions = encrypt([]);

            await pool.query(`
                INSERT INTO users (
                    id, username, discriminator, avatar, access_token, refresh_token,
                    ip_address, is_vpn, sessions, settings
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                id,
                username,
                discriminator,
                avatar,
                JSON.stringify(encryptedAccessToken),
                JSON.stringify(encryptedRefreshToken),
                ipAddress,
                isVpn,
                JSON.stringify(encryptedSessions),
                JSON.stringify(encryptedSettings)
            ]);

            return await getUserById(id);
        }
    } catch (error) {
        console.error('Error creating/updating user:', error);
        throw error;
    }
}

export async function getUserById(id) {
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return null;
        }

        const user = result.rows[0];

        const decryptedAccessToken = decrypt(JSON.parse(user.access_token || 'null'));
        const decryptedRefreshToken = decrypt(JSON.parse(user.refresh_token || 'null'));
        const decryptedSessions = decrypt(JSON.parse(user.sessions || 'null')) || [];
        const decryptedSettings = decrypt(JSON.parse(user.settings || 'null')) || {};

        return {
            id: user.id,
            username: user.username,
            discriminator: user.discriminator,
            avatar: user.avatar,
            accessToken: decryptedAccessToken,
            refreshToken: decryptedRefreshToken,
            lastLogin: user.last_login,
            ipAddress: user.ip_address,
            isVpn: user.is_vpn,
            sessions: decryptedSessions,
            lastSessionCreated: user.last_session_created,
            lastSessionDeleted: user.last_session_deleted,
            settings: decryptedSettings,
            settingsUpdatedAt: user.settings_updated_at,
            totalSessionsCreated: user.total_sessions_created,
            totalMinutes: user.total_minutes,
            createdAt: user.created_at,
            updatedAt: user.updated_at
        };
    } catch (error) {
        console.error('Error fetching user:', error);
        throw error;
    }
}

export async function updateUserSettings(id, settings) {
    try {
        const existingUser = await getUserById(id);
        if (!existingUser) {
            throw new Error('User not found');
        }

        const mergedSettings = { ...existingUser.settings, ...settings };

        const encryptedSettings = encrypt(mergedSettings);

        await pool.query(`
            UPDATE users SET
                settings = $2,
                settings_updated_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
        `, [id, JSON.stringify(encryptedSettings)]);

        return await getUserById(id);
    } catch (error) {
        console.error('Error updating user settings:', error);
        throw error;
    }
}

export async function addSessionToUser(userId, sessionId) {
    try {
        const user = await getUserById(userId);
        if (!user) throw new Error('User not found');

        const sessions = [...user.sessions, sessionId];
        const encryptedSessions = encrypt(sessions);

        await pool.query(`
            UPDATE users SET
                sessions = $2,
                last_session_created = NOW(),
                total_sessions_created = total_sessions_created + 1,
                updated_at = NOW()
            WHERE id = $1
        `, [userId, JSON.stringify(encryptedSessions)]);

        return await getUserById(userId);
    } catch (error) {
        console.error('Error adding session to user:', error);
        throw error;
    }
}

initializeUsersTable();

export { initializeUsersTable };