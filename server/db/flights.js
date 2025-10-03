import { generateSID, generateSquawk, getWakeTurbulence, generateRandomId } from '../utils/flightUtils.js';
import { getSessionById } from './sessions.js';
import flightsPool from './connections/flightsConnection.js';

function sanitizeFlightForClient(flight) {
    const { user_id, ip_address, ...sanitizedFlight } = flight;
    return {
        ...sanitizedFlight,
        cruisingFL: flight.cruisingfl,
        clearedFL: flight.clearedfl,
    };
}

export async function getFlightsBySession(sessionId) {
    const tableName = `flights_${sessionId}`;
    const result = await flightsPool.query(
        `SELECT * FROM ${tableName} ORDER BY created_at ASC`
    );

    const flights = result.rows.map(flight => sanitizeFlightForClient(flight));
    return flights;
}

export async function getFlightsBySessionWithTime(sessionId, hoursBack = 2) {
    try {
        const tableName = `flights_${sessionId}`;

        const tableExists = await flightsPool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = $1
            )
        `, [tableName]);

        if (!tableExists.rows[0].exists) {
            return [];
        }

        const result = await flightsPool.query(
            `SELECT * FROM ${tableName} 
             WHERE created_at >= NOW() - INTERVAL '${hoursBack} hours'
             ORDER BY created_at ASC`
        );

        const flights = result.rows.map(flight => sanitizeFlightForClient(flight));
        return flights;
    } catch (error) {
        console.error(`Error fetching flights for session ${sessionId}:`, error);
        return [];
    }
}

function validateFlightFields(updates) {
    if (updates.callsign && updates.callsign.length > 16) {
        throw new Error('Callsign must be 16 characters or less');
    }
    if (updates.stand && updates.stand.length > 8) {
        throw new Error('Stand must be 8 characters or less');
    }
    if (updates.squawk) {
        if (updates.squawk.length > 4 || !/^\d{1,4}$/.test(updates.squawk)) {
            throw new Error('Squawk must be up to 4 numeric digits');
        }
    }
    if (updates.remark && updates.remark.length > 50) {
        throw new Error('Remark must be 50 characters or less');
    }
    if (updates.cruisingFL !== undefined) {
        const fl = parseInt(updates.cruisingFL, 10);
        if (isNaN(fl) || fl < 0 || fl > 200 || fl % 5 !== 0) {
            throw new Error('Cruising FL must be between 0 and 200 in 50-step increments');
        }
    }
    if (updates.clearedFL !== undefined) {
        const fl = parseInt(updates.clearedFL, 10);
        if (isNaN(fl) || fl < 0 || fl > 200 || fl % 5 !== 0) {
            throw new Error('Cleared FL must be between 0 and 200 in 50-step increments');
        }
    }
}

export async function addFlight(sessionId, flightData) {
    const tableName = `flights_${sessionId}`;
    const fields = ['session_id'];
    const values = [sessionId];
    const placeholders = ['$1'];
    let idx = 2;

    flightData.id = await generateRandomId();
    flightData.squawk = await generateSquawk(flightData);
    flightData.wtc = await getWakeTurbulence(flightData.aircraft_type);
    if (!flightData.timestamp) {
        flightData.timestamp = new Date().toISOString();
    }

    if (flightData.aircraft_type) {
        flightData.aircraft = flightData.aircraft_type;
        delete flightData.aircraft_type;
    }

    flightData.icao = flightData.departure;

    if (!flightData.runway) {
        try {
            const session = await getSessionById(sessionId);
            if (session && session.active_runway) {
                flightData.runway = session.active_runway;
            }
        } catch (error) {
            console.error('Error fetching session for runway assignment:', error);
        }
    }

    if (!flightData.sid) {
        const sidResult = await generateSID(flightData);
        flightData.sid = sidResult.sid;
    }

    if (flightData.cruisingFL) {
        flightData.cruisingfl = flightData.cruisingFL;
        delete flightData.cruisingFL;
    }
    if (flightData.clearedFL) {
        flightData.clearedfl = flightData.clearedFL;
        delete flightData.clearedFL;
    }

    const { icao, ...flightDataForDb } = flightData;

    for (const [key, value] of Object.entries(flightDataForDb)) {
        fields.push(key);
        values.push(value);
        placeholders.push(`$${idx++}`);
    }

    const query = `
        INSERT INTO ${tableName} (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
    `;
    const result = await flightsPool.query(query, values);

    const flight = result.rows[0];
    return sanitizeFlightForClient(flight);
}

export async function updateFlight(sessionId, flightId, updates) {
    const tableName = `flights_${sessionId}`;
    const fields = [];
    const values = [];
    let idx = 1;

    const dbUpdates = { ...updates };
    if (dbUpdates.cruisingFL) {
        dbUpdates.cruisingfl = dbUpdates.cruisingFL;
        delete dbUpdates.cruisingFL;
    }
    if (dbUpdates.clearedFL) {
        dbUpdates.clearedfl = dbUpdates.clearedFL;
        delete dbUpdates.clearedFL;
    }

    validateFlightFields(updates);

    for (const [key, value] of Object.entries(dbUpdates)) {
        let processedValue = value;
        if (key === 'clearance' && typeof value === 'string') {
            processedValue = value.toLowerCase() === 'true';
        }

        fields.push(`${key} = $${idx++}`);
        values.push(processedValue);
    }
    values.push(flightId);

    const query = `
        UPDATE ${tableName} SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${idx}
        RETURNING *
    `;
    const result = await flightsPool.query(query, values);

    const flight = result.rows[0];
    return sanitizeFlightForClient(flight);
}

export async function deleteFlight(sessionId, flightId) {
    const tableName = `flights_${sessionId}`;
    await flightsPool.query(`DELETE FROM ${tableName} WHERE id = $1`, [flightId]);
}