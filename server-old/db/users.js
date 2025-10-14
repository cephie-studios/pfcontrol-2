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
                    ip_address TEXT,
                    is_vpn BOOLEAN DEFAULT false,
                    sessions TEXT DEFAULT '[]',
                    last_session_created TIMESTAMP,
                    last_session_deleted TIMESTAMP,
                    settings TEXT,
                    settings_updated_at TIMESTAMP DEFAULT NOW(),
                    total_sessions_created INTEGER DEFAULT 0,
                    total_minutes INTEGER DEFAULT 0,
                    -- VATSIM linkage
                    vatsim_cid VARCHAR(16),
                    vatsim_rating_id INTEGER,
                    vatsim_rating_short VARCHAR(8),
                    vatsim_rating_long VARCHAR(32),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
    } else {
      // Ensure VATSIM columns exist on existing installations
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS vatsim_cid VARCHAR(16)");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS vatsim_rating_id INTEGER");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS vatsim_rating_short VARCHAR(8)");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS vatsim_rating_long VARCHAR(32)");
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
        newStripSound: { enabled: true, volume: 100 },
        acarsBeep: { enabled: true, volume: 100 },
        acarsChatPop: { enabled: true, volume: 100 }
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
      acars: {
        notesEnabled: true,
        chartsEnabled: true,
        terminalWidth: 50,
        notesWidth: 20
      }
    };

    const existingUser = await pool.query('SELECT * FROM users WHERE id = $1', [id]);

    const encryptedIP = encrypt(ipAddress);

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
        JSON.stringify(encryptedIP),
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
        JSON.stringify(encryptedIP),
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
    const result = await pool.query(`
            SELECT u.*, r.name as role_name, r.permissions as role_permissions
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.id = $1
        `, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];

    let decryptedAccessToken;
    if (user.access_token) {
      try {
        const parsed = JSON.parse(user.access_token);
        decryptedAccessToken = decrypt(parsed);
      } catch (error) {
        console.warn(`Failed to parse access_token for user ${id}, attempting direct decryption:`, error.message);
        decryptedAccessToken = decrypt(user.access_token);
      }
    } else {
      decryptedAccessToken = null;
    }

    let decryptedRefreshToken;
    if (user.refresh_token) {
      try {
        const parsed = JSON.parse(user.refresh_token);
        decryptedRefreshToken = decrypt(parsed);
      } catch (error) {
        console.warn(`Failed to parse refresh_token for user ${id}, attempting direct decryption:`, error.message);
        decryptedRefreshToken = decrypt(user.refresh_token);
      }
    } else {
      decryptedRefreshToken = null;
    }

    let decryptedSessions;
    if (user.sessions) {
      try {
        const parsed = JSON.parse(user.sessions);
        decryptedSessions = decrypt(parsed) || [];
      } catch (error) {
        console.warn(`Failed to parse sessions for user ${id}, attempting direct decryption:`, error.message);
        decryptedSessions = decrypt(user.sessions) || [];
      }
    } else {
      decryptedSessions = [];
    }

    let decryptedSettings;
    if (user.settings) {
      try {
        const parsed = JSON.parse(user.settings);
        decryptedSettings = decrypt(parsed) || {};
      } catch (error) {
        console.warn(`Failed to parse settings for user ${id}, attempting direct decryption:`, error.message);
        decryptedSettings = decrypt(user.settings) || {};
      }
    } else {
      decryptedSettings = {};
    }

    let rolePermissions = null;
    if (user.role_permissions) {
      if (typeof user.role_permissions === 'string') {
        try {
          rolePermissions = JSON.parse(user.role_permissions);
        } catch (error) {
          console.warn(`Failed to parse role_permissions for user ${id}:`, error.message);
          rolePermissions = null;
        }
      } else {
        rolePermissions = user.role_permissions;
      }
    }

    let decryptedIP = null;
    if (user.ip_address) {
      try {
        if (typeof user.ip_address === 'string' && user.ip_address.trim().startsWith('{')) {
          const parsed = JSON.parse(user.ip_address);
          decryptedIP = decrypt(parsed);
        } else if (
          typeof user.ip_address === 'object' &&
          user.ip_address.iv && user.ip_address.data && user.ip_address.authTag
        ) {
          decryptedIP = decrypt(user.ip_address);
        } else if (
          typeof user.ip_address === 'string' &&
          user.ip_address.split('.').length === 4
        ) {
          decryptedIP = user.ip_address;
        } else {
          decryptedIP = null;
        }
      } catch (error) {
        console.warn(`Failed to parse/decrypt ip_address for user ${user.id}:`, error.message);
        decryptedIP = null;
      }
    }
    user.ip_address = decryptedIP;

    return {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      accessToken: decryptedAccessToken,
      refreshToken: decryptedRefreshToken,
      lastLogin: user.last_login,
      ipAddress: decryptedIP,
      isVpn: user.is_vpn,
      sessions: decryptedSessions,
      lastSessionCreated: user.last_session_created,
      lastSessionDeleted: user.last_session_deleted,
      settings: decryptedSettings,
      settingsUpdatedAt: user.settings_updated_at,
      totalSessionsCreated: user.total_sessions_created,
      totalMinutes: user.total_minutes,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      roleId: user.role_id,
      roleName: user.role_name,
      rolePermissions: rolePermissions,
      robloxUserId: user.roblox_user_id,
      robloxUsername: user.roblox_username,
      // VATSIM linkage
      vatsimCid: user.vatsim_cid,
      vatsimRatingId: user.vatsim_rating_id,
      vatsimRatingShort: user.vatsim_rating_short,
      vatsimRatingLong: user.vatsim_rating_long
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

export async function updateRobloxAccount(userId, { robloxUserId, robloxUsername, accessToken, refreshToken }) {
  try {
    await pool.query(`
            UPDATE users SET
                roblox_user_id = $2,
                roblox_username = $3,
                roblox_access_token = $4,
                roblox_refresh_token = $5,
                updated_at = NOW()
            WHERE id = $1
        `, [userId, robloxUserId, robloxUsername, accessToken, refreshToken]);

    return await getUserById(userId);
  } catch (error) {
    console.error('Error updating Roblox account:', error);
    throw error;
  }
}

export async function unlinkRobloxAccount(userId) {
  try {
    await pool.query(`
            UPDATE users SET
                roblox_user_id = NULL,
                roblox_username = NULL,
                roblox_access_token = NULL,
                roblox_refresh_token = NULL,
                updated_at = NOW()
            WHERE id = $1
        `, [userId]);

    return await getUserById(userId);
  } catch (error) {
    console.error('Error unlinking Roblox account:', error);
    throw error;
  }
}

export async function updateVatsimAccount(userId, { vatsimCid, ratingId, ratingShort, ratingLong }) {
  try {
    await pool.query(`
            UPDATE users SET
                vatsim_cid = $2,
                vatsim_rating_id = $3,
                vatsim_rating_short = $4,
                vatsim_rating_long = $5,
                updated_at = NOW()
            WHERE id = $1
        `, [userId, vatsimCid, ratingId, ratingShort, ratingLong]);

    return await getUserById(userId);
  } catch (error) {
    console.error('Error updating VATSIM account:', error);
    throw error;
  }
}

export async function unlinkVatsimAccount(userId) {
  try {
    await pool.query(`
            UPDATE users SET
                vatsim_cid = NULL,
                vatsim_rating_id = NULL,
                vatsim_rating_short = NULL,
                vatsim_rating_long = NULL,
                updated_at = NOW()
            WHERE id = $1
        `, [userId]);

    return await getUserById(userId);
  } catch (error) {
    console.error('Error unlinking VATSIM account:', error);
    throw error;
  }
}

initializeUsersTable();

export { initializeUsersTable };
