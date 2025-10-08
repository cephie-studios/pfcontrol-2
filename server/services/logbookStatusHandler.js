import { activateFlightByCallsign, completeFlightByCallsign } from '../db/logbook.js';
import pool from '../db/connections/connection.js';

export async function handleFlightStatusChange(callsign, status, controllerAirport = null) {
    if (!callsign || !status) {
        return { action: 'none', flightId: null };
    }

    const normalizedStatus = status.toLowerCase();
    let result = { action: 'none', flightId: null };
    let modifiedStatus = status;

    try {
        if (controllerAirport && (normalizedStatus === 'taxi' || normalizedStatus === 'rwy')) {
            const flightInfo = await pool.query(`
                SELECT departure_icao, arrival_icao
                FROM logbook_flights
                WHERE callsign = $1 AND flight_status IN ('pending', 'active')
                LIMIT 1
            `, [callsign]);

            if (flightInfo.rows.length > 0) {
                const { departure_icao, arrival_icao } = flightInfo.rows[0];

                if (controllerAirport.toUpperCase() === departure_icao?.toUpperCase()) {
                    modifiedStatus = normalizedStatus === 'taxi' ? 'origin_taxi' : 'origin_runway';
                } else if (controllerAirport.toUpperCase() === arrival_icao?.toUpperCase()) {
                    modifiedStatus = normalizedStatus === 'taxi' ? 'destination_taxi' : 'destination_runway';
                }
            }
        }

        let updateResult = await pool.query(`
            UPDATE logbook_flights lf
            SET controller_status = $2
            FROM logbook_active_flights laf
            WHERE laf.callsign = $1 AND laf.flight_id = lf.id
            RETURNING lf.id
        `, [callsign, modifiedStatus]);

        if (updateResult.rowCount === 0) {
            updateResult = await pool.query(`
                UPDATE logbook_flights
                SET controller_status = $2
                WHERE callsign = $1 AND flight_status IN ('pending', 'active')
                RETURNING id
            `, [callsign, modifiedStatus]);
        }

        if (updateResult.rowCount > 0) {
            console.log(`[Logbook] Updated controller_status for ${callsign} to ${modifiedStatus}`);
        } else {
            console.debug(`[Logbook] No flight found to update status for ${callsign}`);
        }

        if (normalizedStatus === 'departure' || normalizedStatus === 'approach') {
            const flightId = await activateFlightByCallsign(callsign);
            if (flightId) {
                result = { action: 'activated', flightId };
                console.log(`[Logbook] Flight ${callsign} activated by controller (status: ${normalizedStatus})`);
            }
        }

        else if (normalizedStatus === 'gate') {
            const flightId = await completeFlightByCallsign(callsign);
            if (flightId) {
                result = { action: 'completed', flightId };
                console.log(`[Logbook] Flight ${callsign} completed by controller (status: gate)`);
            }
        }

        if (result.action === 'none' && (normalizedStatus === 'departure' || normalizedStatus === 'gate')) {
            console.debug(`[Logbook] No action for ${callsign} status: ${normalizedStatus} (not tracked or invalid state)`);
        }
    } catch (error) {
        console.error(`[Logbook] Error handling status change for ${callsign}:`, error);
        throw error;
    }

    return result;
}
