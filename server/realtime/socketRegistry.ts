import type { Server as SocketServer } from "socket.io";
import { persistWebsocketSnapshots } from "../db/websocketSnapshots.js";

export type RegisteredSocketNamespace = {
  id: string;
  label: string;
  path: string;
  io: SocketServer;
};

const namespaces = new Map<string, RegisteredSocketNamespace>();

const HISTORY_LEN = 60;
const history = new Map<string, number[]>();

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

export function registerAdminSocketNamespace(
  id: string,
  label: string,
  path: string,
  io: SocketServer
): void {
  namespaces.set(id, { id, label, path, io });
  if (!history.has(id)) {
    history.set(id, Array(HISTORY_LEN).fill(0));
  }
}

function pushHistory(id: string, count: number): void {
  const buf = history.get(id) ?? Array(HISTORY_LEN).fill(0);
  const next = [...buf.slice(1), count];
  history.set(id, next);
}

export function recordSocketCountsSnapshot(): void {
  const samples: Array<{ namespaceId: string; connected: number }> = [];

  for (const [id, ns] of namespaces) {
    const count = ns.io.engine?.clientsCount ?? ns.io.sockets.sockets.size;
    pushHistory(id, count);
    samples.push({ namespaceId: id, connected: count });
  }

  void persistWebsocketSnapshots(samples);
}

setInterval(recordSocketCountsSnapshot, 5000);

export function getAdminSocketStats(): Array<{
  id: string;
  label: string;
  path: string;
  connected: number;
  history: number[];
  history24h: number[];
}> {
  return Array.from(namespaces.values()).map((ns) => {
    const connected = ns.io.engine?.clientsCount ?? ns.io.sockets.sockets.size;
    return {
      id: ns.id,
      label: ns.label,
      path: ns.path,
      connected,
      history: [...(history.get(ns.id) ?? [])],
      history24h: [],
    };
  });
}

export async function getAdminSocketStatsWithHistory(): Promise<
  Array<{
    id: string;
    label: string;
    path: string;
    connected: number;
    history: number[];
    history24h: number[];
  }>
> {
  const { getWebsocketHourlyHistory } =
    await import("../db/websocketSnapshots.js");
  const hourly = await getWebsocketHourlyHistory();
  return getAdminSocketStats().map((ns) => ({
    ...ns,
    history24h: hourly.get(ns.id) ?? [],
  }));
}