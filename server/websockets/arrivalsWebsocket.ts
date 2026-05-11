import { Server as SocketServer, Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import { updateFlight, getExternalArrivalFlights, type ClientFlight } from "../db/flights.js";
import { validateSessionAccess } from "../middleware/sessionAccess.js";
import { getSessionById, getSessionsByAirportAndNetwork } from "../db/sessions.js";
import { getFlightsIO } from "./flightsWebsocket.js";
import { validateSessionId, validateAccessId, validateFlightId } from "../utils/validation.js";
import { sanitizeString, sanitizeSquawk, sanitizeFlightLevel } from "../utils/sanitization.js";
import { mainDb } from "../db/connection.js";
import { createHandshakeRateLimiter } from "./handshakeRateLimit.js";
import {
  isAdvancedNetworkSession,
  getNetworkKind,
  type NetworkKind,
} from "../utils/advancedNetworkSession.js";

interface ArrivalUpdateData {
  flightId: string | number;
  updates: Record<string, unknown>;
}

let io: SocketServer;
export function setupArrivalsWebsocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    path: "/sockets/arrivals",
    allowRequest: createHandshakeRateLimiter({ scope: "arrivals" }),
    cors: {
      origin: [
        "http://localhost:5173",
        "http://localhost:9901",
        "https://pfcontrol.com",
        "https://canary.pfcontrol.com",
      ],
      credentials: true,
    },
    perMessageDeflate: {
      threshold: 1024,
    },
  });

  io.on("connection", async (socket: Socket) => {
    try {
      const sessionId = validateSessionId(socket.handshake.query.sessionId as string);
      const accessId = validateAccessId(socket.handshake.query.accessId as string);

      const valid = await validateSessionAccess(sessionId, accessId);
      if (!valid) {
        socket.disconnect(true);
        return;
      }

      const session = await getSessionById(sessionId);
      if (!session || !isAdvancedNetworkSession(session)) {
        socket.disconnect(true);
        return;
      }

      socket.data.sessionId = sessionId;
      socket.data.session = session;
      socket.data.networkKind = getNetworkKind(session);

      socket.join(sessionId);

      try {
        const externalArrivals = await getExternalArrivalFlights(
          session.airport_icao,
          socket.data.networkKind,
        );
        socket.emit("initialExternalArrivals", externalArrivals);
      } catch (error) {
        console.error("Error fetching external arrivals:", error);
      }

      socket.on("updateArrival", async ({ flightId, updates }: ArrivalUpdateData) => {
        const sessionId = socket.data.sessionId;
        const session = socket.data.session;
        try {
          validateFlightId(flightId);

          const sourceSessionId = await findFlightSourceSession(
            flightId as string,
            session.airport_icao,
            socket.data.networkKind,
          );

          if (!sourceSessionId) {
            socket.emit("arrivalError", {
              action: "update",
              flightId,
              error: "Flight not found in any session",
            });
            return;
          }

          const allowedFields = ["clearedfl", "status", "star", "remark", "squawk", "gate"];
          const filteredUpdates: Record<string, unknown> = {};

          for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
              filteredUpdates[key] = value;
            }
          }

          if (Object.keys(filteredUpdates).length === 0) {
            socket.emit("arrivalError", {
              action: "update",
              flightId,
              error: "No valid fields to update",
            });
            return;
          }

          if (filteredUpdates.clearedfl && typeof filteredUpdates.clearedfl === "string")
            filteredUpdates.clearedfl = sanitizeFlightLevel(filteredUpdates.clearedfl);
          if (filteredUpdates.star && typeof filteredUpdates.star === "string")
            filteredUpdates.star = sanitizeString(filteredUpdates.star, 16);
          if (filteredUpdates.remark && typeof filteredUpdates.remark === "string")
            filteredUpdates.remark = sanitizeString(filteredUpdates.remark, 500);
          if (filteredUpdates.squawk && typeof filteredUpdates.squawk === "string")
            filteredUpdates.squawk = sanitizeSquawk(filteredUpdates.squawk);
          if (filteredUpdates.gate && typeof filteredUpdates.gate === "string")
            filteredUpdates.gate = sanitizeString(filteredUpdates.gate, 8);

          const updatedFlight = await updateFlight(
            sourceSessionId,
            flightId as string,
            filteredUpdates,
          );

          if (updatedFlight) {
            const flightsIO = getFlightsIO();
            if (flightsIO) {
              flightsIO.to(sourceSessionId).emit("flightUpdated", updatedFlight);
            }

            io.to(sessionId).emit("arrivalUpdated", updatedFlight);

            await broadcastToOtherArrivalSessions(
              updatedFlight,
              sessionId,
              socket.data.networkKind,
            );
          } else {
            socket.emit("arrivalError", {
              action: "update",
              flightId,
              error: "Flight not found",
            });
          }
        } catch (error) {
          console.error("Error updating arrival via websocket:", error);
          socket.emit("arrivalError", {
            action: "update",
            flightId,
            error: "Failed to update arrival",
          });
        }
      });
    } catch {
      socket.disconnect(true);
    }
  });

  return io;
}

async function findFlightSourceSession(
  flightId: string,
  arrivalAirport: string,
  networkKind: NetworkKind | null,
): Promise<string | null> {
  try {
    let query = mainDb
      .selectFrom("flights as f")
      .innerJoin("sessions as s", "s.session_id", "f.session_id")
      .select("f.session_id")
      .where("f.id", "=", flightId)
      .where("s.airport_icao", "!=", arrivalAirport.toUpperCase());

    if (networkKind === "pfatc") {
      query = query.where("s.is_pfatc", "=", true);
    } else if (networkKind === "advanced_atc") {
      query = query.where("s.is_advanced_atc", "=", true);
    } else {
      return null;
    }

    const row = await query.executeTakeFirst();
    return row?.session_id ?? null;
  } catch (error) {
    console.error("Error finding flight source session:", error);
    return null;
  }
}

async function broadcastToOtherArrivalSessions(
  flight: ClientFlight,
  excludeSessionId: string,
  networkKind: NetworkKind | null,
): Promise<void> {
  if (!networkKind || !flight.arrival) return;
  try {
    const arrivalSessions = await getSessionsByAirportAndNetwork(flight.arrival, networkKind);
    for (const session of arrivalSessions) {
      if (session.session_id !== excludeSessionId) {
        io.to(session.session_id).emit("arrivalUpdated", flight);
      }
    }
  } catch (error) {
    console.error("Error broadcasting to other arrival sessions:", error);
  }
}


export function getArrivalsIO(): SocketServer | undefined {
  return io;
}

export function broadcastArrivalEvent(sessionId: string, event: string, data: unknown): void {
  if (io) {
    io.to(sessionId).emit(event, data);
  }
}