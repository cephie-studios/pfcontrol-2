import pool from './connections/connection.js';
import { encrypt, decrypt } from '../tools/encryption.js';
import flightsPool from './connections/flightsConnection.js';

export async function initializeSessionsTable() {
    try {
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'sessions'
            )
        `);
        const exists = result.rows[0].exists;
        if (!exists) {
            await pool.query(`
                CREATE TABLE sessions (
                    session_id VARCHAR(8) PRIMARY KEY,
                    access_id VARCHAR(64) UNIQUE NOT NULL,
                    active_runway VARCHAR(10),
                    airport_icao VARCHAR(4) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    created_by VARCHAR(20) NOT NULL,
                    is_pfatc BOOLEAN DEFAULT false,
                    flight_strips TEXT,
                    atis TEXT
                )
            `);
        }
    } catch (error) {
        console.error('Error initializing sessions table:', error);
    }
}

export async function createSession({ sessionId, accessId, activeRunway, airportIcao, createdBy, isPFATC }) {
    const encryptedAtis = encrypt({
        letter: 'A',
        text: '',
        timestamp: new Date().toISOString()
    });

    await pool.query(`
        INSERT INTO sessions (
            session_id, access_id, active_runway, airport_icao,
            created_by, is_pfatc, atis
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
        sessionId,
        accessId,
        activeRunway,
        airportIcao.toUpperCase(),
        createdBy,
        isPFATC,
        JSON.stringify(encryptedAtis)
    ]);

    // Create flights table for this session
    await flightsPool.query(`
        CREATE TABLE IF NOT EXISTS flights_${sessionId} (
            id SERIAL PRIMARY KEY,
            session_id VARCHAR(8) NOT NULL,
            callsign VARCHAR(16) NOT NULL,
            aircraft_type VARCHAR(8),
            departure VARCHAR(4),
            arrival VARCHAR(4),
            route TEXT,
            stand VARCHAR(8),
            remark TEXT,
            flight_type VARCHAR(8),
            clearedFL VARCHAR(8),
            cruisingFL VARCHAR(8),
            status VARCHAR(16),
            squawk VARCHAR(8),
            sid VARCHAR(16),
            wtc VARCHAR(2),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `);
}

export async function getSessionById(sessionId) {
    const result = await pool.query(
        'SELECT * FROM sessions WHERE session_id = $1',
        [sessionId]
    );
    return result.rows[0] || null;
}

export async function getSessionsByUser(userId) {
    const result = await pool.query(
        'SELECT session_id, airport_icao, created_at, created_by, is_pfatc, active_runway FROM sessions WHERE created_by = $1 ORDER BY created_at DESC',
        [userId]
    );
    return result.rows;
}

export async function updateSession(sessionId, updates) {
    const fields = [];
    const values = [];
    let paramCounter = 1;

    if (updates.activeRunway !== undefined) {
        fields.push(`active_runway = $${paramCounter++}`);
        values.push(updates.activeRunway);
    }
    if (updates.atis !== undefined) {
        fields.push(`atis = $${paramCounter++}`);
        values.push(JSON.stringify(encrypt(updates.atis)));
    }
    if (fields.length === 0) return null;

    values.push(sessionId);
    const query = `UPDATE sessions SET ${fields.join(', ')} WHERE session_id = $${paramCounter} RETURNING *`;
    const result = await pool.query(query, values);
    return result.rows[0] || null;
}

export async function migrateSessionsTable() {
    try {
        await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS custom_name VARCHAR(50);`);
        await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS refreshed_at TIMESTAMP;`);
    } catch (error) {
        console.error('Error migrating sessions table:', error);
    }
}
migrateSessionsTable();

export async function updateSessionName(sessionId, customName) {
    const result = await pool.query(
        `UPDATE sessions SET custom_name = $2 WHERE session_id = $1 RETURNING custom_name`,
        [sessionId, customName]
    );
    return result.rows[0]?.custom_name || null;
}

export async function getSessionsByUserDetailed(userId) {
    const result = await pool.query(
        `SELECT session_id, access_id, airport_icao, active_runway, created_at, refreshed_at, custom_name, is_pfatc
        FROM sessions WHERE created_by = $1 ORDER BY created_at DESC`,
        [userId]
    );
    return result.rows.map(row => ({
        sessionId: row.session_id,
        accessId: row.access_id,
        airportIcao: row.airport_icao,
        activeRunway: row.active_runway,
        createdAt: row.created_at,
        refreshedAt: row.refreshed_at,
        customName: row.custom_name,
        flightCount: 0, // Will be set by frontend using flights API
        isLegacy: false,
        isPFATC: row.is_pfatc
    }));
}

export async function deleteSession(sessionId) {
    const result = await pool.query(
        'DELETE FROM sessions WHERE session_id = $1 RETURNING session_id',
        [sessionId]
    );
    return result.rows[0] || null;
}

export async function getAllSessions() {
    const result = await pool.query(
        'SELECT session_id, airport_icao, created_at, created_by, is_pfatc, active_runway FROM sessions ORDER BY created_at DESC'
    );
    return result.rows;
}

export { encrypt, decrypt };