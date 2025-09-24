export interface SessionInfo {
    sessionId: string;
    airportIcao: string;
    createdAt: string;
    createdBy: string;
    isPFATC: boolean;
    activeRunway?: string;
    customName?: string;
    isLegacy: boolean;
    flightCount: number;
}