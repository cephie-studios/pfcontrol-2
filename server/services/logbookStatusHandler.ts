import chalk from 'chalk';
import { activateFlightByCallsign, completeFlightByCallsign } from '../db/logbook.js';
import { mainDb } from '../db/connection.js';

const log = (message: string, type: 'log' | 'error' | 'debug' = 'log') => {
  const coloredMessage = message.replace(/\[Logbook\]/g, chalk.bgMagenta('[Logbook]'));
  if (type === 'error') console.error(coloredMessage);
  else if (type === 'debug') console.debug(coloredMessage);
  else console.log(coloredMessage);
};

export async function handleFlightStatusChange(callsign: string, status: string, controllerAirport: string | null = null): Promise<{ action: string; flightId: number | null }> {
  if (!callsign || !status) {
    return { action: 'none', flightId: null };
  }

  const normalizedStatus = status.toLowerCase();
  let result: { action: string; flightId: number | null } = { action: 'none', flightId: null };
  let modifiedStatus = status;

  try {
    if (controllerAirport && (normalizedStatus === 'taxi' || normalizedStatus === 'rwy')) {
      const flightInfo = await mainDb
        .selectFrom('logbook_flights')
        .select(['departure_icao', 'arrival_icao'])
        .where('callsign', '=', callsign)
        .where('flight_status', 'in', ['pending', 'active'])
        .limit(1)
        .executeTakeFirst();

      if (flightInfo) {
        const { departure_icao, arrival_icao } = flightInfo;

        if (controllerAirport.toUpperCase() === departure_icao?.toUpperCase()) {
          modifiedStatus = normalizedStatus === 'taxi' ? 'origin_taxi' : 'origin_runway';
        } else if (controllerAirport.toUpperCase() === arrival_icao?.toUpperCase()) {
          modifiedStatus = normalizedStatus === 'taxi' ? 'destination_taxi' : 'destination_runway';
        }
      }
    }

    let updateResult = await mainDb
      .updateTable('logbook_flights as lf')
      .from('logbook_active_flights as laf')
      .set({ controller_status: modifiedStatus })
      .where('laf.callsign', '=', callsign)
      .whereRef('laf.flight_id', '=', 'lf.id')
      .returning('lf.id')
      .execute();

    if (updateResult.length === 0) {
      updateResult = await mainDb
        .updateTable('logbook_flights')
        .set({ controller_status: modifiedStatus })
        .where('callsign', '=', callsign)
        .where('flight_status', 'in', ['pending', 'active'])
        .returning('id')
        .execute();
    }

    if (updateResult.length > 0) {
      log(`[Logbook] Updated controller_status for ${callsign} to ${modifiedStatus}`);
    } else {
      log(`[Logbook] No flight found to update status for ${callsign}`, 'debug');
    }

    if (normalizedStatus === 'departure' || normalizedStatus === 'approach') {
      const flightId = await activateFlightByCallsign(callsign);
      if (flightId) {
        result = { action: 'activated', flightId };
        log(`[Logbook] Flight ${callsign} activated by controller (status: ${normalizedStatus})`);
      }
    } else if (normalizedStatus === 'gate') {
      const flightId = await completeFlightByCallsign(callsign);
      if (flightId) {
        result = { action: 'completed', flightId };
        log(`[Logbook] Flight ${callsign} completed by controller (status: gate)`);
      }
    }

    if (result.action === 'none' && (normalizedStatus === 'departure' || normalizedStatus === 'gate')) {
      log(`[Logbook] No action for ${callsign} status: ${normalizedStatus} (not tracked or invalid state)`, 'debug');
    }
  } catch (error) {
    log(`[Logbook] Error handling status change for ${callsign}: ${error}`, 'error');
    throw error;
  }

  return result;
}