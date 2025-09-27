// db/flights.js
import flightsPool from './flightsConnection.js';

export async function getFlightsBySession(sessionId) {
    const result = await flightsPool.query(
        'SELECT * FROM flights WHERE session_id = $1 ORDER BY created_at ASC',
        [sessionId]
    );
    return result.rows;
}

export async function addFlight(sessionId, flightData) {
    const fields = ['session_id'];
    const values = [sessionId];
    const placeholders = ['$1'];
    let idx = 2;

    for (const [key, value] of Object.entries(flightData)) {
        fields.push(key);
        values.push(value);
        placeholders.push(`$${idx++}`);
    }

    const query = `
        INSERT INTO flights (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
    `;
    const result = await flightsPool.query(query, values);
    return result.rows[0];
}

export async function updateFlight(flightId, updates) {
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
    }
    values.push(flightId);

    const query = `
        UPDATE flights SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${idx}
        RETURNING *
    `;
    const result = await flightsPool.query(query, values);
    return result.rows[0];
}

export async function deleteFlight(flightId) {
    await flightsPool.query('DELETE FROM flights WHERE id = $1', [flightId]);
}