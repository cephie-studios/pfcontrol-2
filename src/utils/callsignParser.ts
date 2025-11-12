import type { Airline } from '../types/airlines';

export function parseCallsign(callsign: string | undefined, airlines: Airline[]): string {
    if (!callsign) return '';

    const match = callsign.match(/^([A-Z]{2,3})(.+)$/);

    if (!match) {
        return callsign;
    }

    const airlineCode = match[1];
    const flightNumber = match[2];
    const airline = airlines.find(a => a.icao === airlineCode);

    if (airline) {
        const formattedName = airline.callsign
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');

        return `${formattedName} ${flightNumber}`;
    }
    return callsign;
}

export function getAirportName(icao: string | undefined, airports: { icao: string; name: string }[]): string {
    if (!icao) return '';

    const airport = airports.find(a => a.icao === icao);
    return airport ? `${icao} ${airport.name}` : icao;
}