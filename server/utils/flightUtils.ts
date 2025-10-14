import { getAirportData, getAircraftData } from "./getData";
import { generateFlightId } from "./ids";

export interface Flight {
    flightType?: string;
    flight_type?: string;
    icao?: string;
    runway?: string;
    arrival?: string;
}

export const generateRandomId = generateFlightId;

export async function generateSquawk(flight: Flight) {
    let squawk = "";
    if (flight.flightType === "VFR" || flight.flight_type === "VFR") {
        squawk = "7000";
    } else {
        for (let i = 0; i < 4; i++) {
            squawk += Math.floor(Math.random() * 6) + 1;
        }
    }
    return squawk;
}

export async function generateSID(flight: Flight) {
    const { icao, runway, arrival } = flight;
    const airportData = getAirportData();
    type DepartureData = { [runway: string]: { [arrival: string]: string } };
    type Airport = { icao: string; departures?: DepartureData };
    const airport = airportData.find((ap: Airport) => ap.icao === icao);

    if (!airport) {
        throw new Error("Airport not found");
    }

    let selectedRunway: string | undefined = runway;
    if (!selectedRunway || !airport.departures || !airport.departures[selectedRunway]) {
        const runways = airport.departures ? Object.keys(airport.departures) : [];
        selectedRunway = runways.length > 0 ? runways[0] : undefined;
    }

    if (!selectedRunway || !airport.departures || !airport.departures[selectedRunway]) {
        throw new Error("No SIDs available for this runway");
    }

    const runwayData = airport.departures[selectedRunway];
    let sid = "";

    if (arrival && runwayData[arrival]) {
        sid = runwayData[arrival];
    } else {
        const firstAvailableSid = Object.values(runwayData).find((val) => val !== "");
        sid = typeof firstAvailableSid === "string" ? firstAvailableSid : "";
    }

    return { sid };
}

interface AircraftInfo {
    type: string;
    wtc?: string;
    [key: string]: unknown;
}

export async function getWakeTurbulence(aircraftType: string) {
    const aircraftDataRaw = getAircraftData();
    let aircraftArray: AircraftInfo[] = [];

    if (Array.isArray(aircraftDataRaw)) {
        aircraftArray = aircraftDataRaw as AircraftInfo[];
    } else {
        aircraftArray = Object.entries(aircraftDataRaw).map(([type, info]) => {
            if (typeof info === "object" && info !== null) {
                return {
                    type,
                    ...(info as object)
                } as AircraftInfo;
            } else {
                return { type } as AircraftInfo;
            }
        });
    }

    if (!aircraftArray || aircraftArray.length === 0) {
        return "N/A";
    }

    const aircraft = aircraftArray.find((ac) => ac.type === aircraftType);
    return aircraft ? aircraft.wtc : "N/A";
}