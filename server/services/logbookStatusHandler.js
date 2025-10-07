import { activateFlightByCallsign, completeFlightByCallsign } from '../db/logbook.js';
import pool from '../db/connections/connection.js';

/**
 * Handle flight status changes from controller interface
 * @param {string} callsign - Flight callsign
 * @param {string} status - New status from controller
 * @param {string} controllerAirport - ICAO code of the controller's airport
 * @returns {Promise<{action: string, flightId: number|null}>}
 */
export async function handleFlightStatusChange(callsign, status, controllerAirport = null) {
    if (!callsign || !status) {
        return { action: 'none', flightId: null };
    }

    const normalizedStatus = status.toLowerCase();
    let result = { action: 'none', flightId: null };
    let modifiedStatus = status;

    try {
        // If controller set TAXI or RWY and we know their airport, determine origin vs destination
        if (controllerAirport && (normalizedStatus === 'taxi' || normalizedStatus === 'rwy')) {
            // Get flight's departure and arrival airports
            const flightInfo = await pool.query(`
                SELECT departure_icao, arrival_icao
                FROM logbook_flights
                WHERE callsign = $1 AND flight_status IN ('pending', 'active')
                LIMIT 1
            `, [callsign]);

            if (flightInfo.rows.length > 0) {
                const { departure_icao, arrival_icao } = flightInfo.rows[0];

                if (controllerAirport.toUpperCase() === departure_icao?.toUpperCase()) {
                    // Controller is at departure airport = origin
                    modifiedStatus = normalizedStatus === 'taxi' ? 'origin_taxi' : 'origin_runway';
                } else if (controllerAirport.toUpperCase() === arrival_icao?.toUpperCase()) {
                    // Controller is at arrival airport = destination
                    modifiedStatus = normalizedStatus === 'taxi' ? 'destination_taxi' : 'destination_runway';
                }
            }
        }

        // Update controller_status for the flight (so we can display it in UI)
        // Try updating via active flights table first (for flights being actively tracked)
        let updateResult = await pool.query(`
            UPDATE logbook_flights lf
            SET controller_status = $2
            FROM logbook_active_flights laf
            WHERE laf.callsign = $1 AND laf.flight_id = lf.id
            RETURNING lf.id
        `, [callsign, modifiedStatus]);

        // If no rows updated, try updating directly by callsign (for flights not in active tracking yet)
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


        // Activate flight when controller sets status to "departure" or "approach"
        // "departure" = departure controller releasing the flight
        // "approach" = arrival controller picking up the flight (in case departure controller didn't track it)
        if (normalizedStatus === 'departure' || normalizedStatus === 'approach') {
            const flightId = await activateFlightByCallsign(callsign);
            if (flightId) {
                result = { action: 'activated', flightId };
                console.log(`[Logbook] Flight ${callsign} activated by controller (status: ${normalizedStatus})`);
            }
        }

        // Complete flight when controller sets status to "gate"
        else if (normalizedStatus === 'gate') {
            const flightId = await completeFlightByCallsign(callsign);
            if (flightId) {
                result = { action: 'completed', flightId };
                console.log(`[Logbook] Flight ${callsign} completed by controller (status: gate)`);
            }
        }

        // Log if no action was taken (flight not in logbook or wrong state)
        if (result.action === 'none' && (normalizedStatus === 'departure' || normalizedStatus === 'gate')) {
            console.debug(`[Logbook] No action for ${callsign} status: ${normalizedStatus} (not tracked or invalid state)`);
        }
    } catch (error) {
        console.error(`[Logbook] Error handling status change for ${callsign}:`, error);
        throw error;
    }

    return result;
}
