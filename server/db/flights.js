import { generateSID, generateSquawk, getWakeTurbulence, generateRandomId } from '../utils/flightUtils.js';
import flightsPool from './connections/flightsConnection.js';

export async function getFlightsBySession(sessionId) {
    const tableName = `flights_${sessionId}`;
    const result = await flightsPool.query(
        `SELECT * FROM ${tableName} ORDER BY created_at ASC`
    );
    return result.rows;
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
    if (!flightData.sid) {
        const sidResult = await generateSID(flightData);
        flightData.sid = sidResult.sid;
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
    return result.rows[0];
}

export async function updateFlight(sessionId, flightId, updates) {
    const tableName = `flights_${sessionId}`;
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
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
    return result.rows[0];
}

export async function deleteFlight(sessionId, flightId) {
    const tableName = `flights_${sessionId}`;
    await flightsPool.query(`DELETE FROM ${tableName} WHERE id = $1`, [flightId]);
}