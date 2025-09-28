import { getAirportData, getAircraftData } from "../tools/getData.js";

export async function generateSquawk(flight) {
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

export async function generateSID(flight) {
    const { icao, runway, arrival } = flight;
    const airportData = getAirportData();
    const airport = airportData.find((ap) => ap.icao === icao);

    if (!airport) {
        throw new Error("Airport not found");
    }

    let selectedRunway = runway;
    if (!selectedRunway || !airport.departures || !airport.departures[selectedRunway]) {
        const runways = airport.departures ? Object.keys(airport.departures) : [];
        selectedRunway = runways.length > 0 ? runways[0] : null;
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
        sid = firstAvailableSid || "";
    }

    return { sid };
}

export async function getWakeTurbulence(aircraftType) {
    const aircraftDataRaw = getAircraftData();
    let aircraftArray = [];

    if (Array.isArray(aircraftDataRaw)) {
        aircraftArray = aircraftDataRaw;
    } else {
        aircraftArray = Object.entries(aircraftDataRaw).map(([type, info]) => ({
            type,
            ...info
        }));
    }

    if (!aircraftArray || aircraftArray.length === 0) {
        return "N/A";
    }

    const aircraft = aircraftArray.find((ac) => ac.type === aircraftType);
    return aircraft ? aircraft.wtc : "N/A";
}