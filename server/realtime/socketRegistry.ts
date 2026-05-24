import type { Server as SocketServer } from "socket.io";

let flightsIO: SocketServer | undefined;
let arrivalsIO: SocketServer | undefined;
let overviewIO: SocketServer | undefined;

export function setFlightsIO(io: SocketServer): void {
  flightsIO = io;
}

export function setArrivalsIO(io: SocketServer): void {
  arrivalsIO = io;
}

export function setOverviewIO(io: SocketServer): void {
  overviewIO = io;
}

export function getFlightsIO(): SocketServer | undefined {
  return flightsIO;
}

export function getArrivalsIO(): SocketServer | undefined {
  return arrivalsIO;
}

export function getOverviewIO(): SocketServer | undefined {
  return overviewIO;
}