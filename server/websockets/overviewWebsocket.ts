import { Server as SocketServer } from 'socket.io';
import { getAllSessions } from '../db/sessions.js';
import { getFlightsBySessionWithTime, updateFlight } from '../db/flights.js';
import { decrypt } from '../utils/encryption.js';
import { getUserById } from '../db/users.js';
import { validateFlightId, validateSessionId } from '../utils/validation.js';
import {
  sanitizeCallsign,
  sanitizeString,
  sanitizeSquawk,
  sanitizeFlightLevel,
  sanitizeRunway,
} from '../utils/sanitization.js';
import { isEventController } from '../middleware/flightAccess.js';
import { incrementStat } from '../utils/statisticsCache.js';
import { logFlightAction } from '../db/flightLogs.js';
import type { Server as HTTPServer } from 'http';
import type { SessionUsersServer } from './sessionUsersWebsocket.js';
import type { Flight } from '../utils/flightUtils.js';

let io: SocketServer;
const activeOverviewClients = new Set<string>();
const eventControllerClients = new Set<string>();

export function setupOverviewWebsocket(
  httpServer: HTTPServer,
  sessionUsersIO: SessionUsersServer
) {
  io = new SocketServer(httpServer, {
    path: '/sockets/overview',
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:9901',
        'https://control.pfconnect.online',
        'https://test.pfconnect.online',
      ],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  io.engine.on('connection_error', (err) => {
    console.error('[Overview Socket] Engine connection error:', err);
  });

  io.on('connection', async (socket) => {
    activeOverviewClients.add(socket.id);

    const userId = socket.handshake.query.userId as string;
    const isEventControllerFlag =
      socket.handshake.query.isEventController === 'true';

    if (isEventControllerFlag && userId) {
      const hasEventControllerRole = await isEventController(userId);
      if (hasEventControllerRole) {
        eventControllerClients.add(socket.id);
        socket.data.isEventController = true;
        socket.data.userId = userId;
        socket.data.username =
          (socket.handshake.query.username as string) || 'Unknown';
      }
    }

    try {
      const overviewData = await getOverviewData(sessionUsersIO);
      socket.emit('overviewData', overviewData);
    } catch (error) {
      console.error('[Overview Socket] Error sending initial data:', error);
      socket.emit('overviewError', { error: 'Failed to fetch overview data' });
    }

    socket.on(
      'updateFlight',
      async ({
        sessionId,
        flightId,
        updates,
      }: {
        sessionId: string;
        flightId: string | number;
        updates: Record<string, unknown>;
      }) => {
        if (!socket.data.isEventController) {
          socket.emit('flightError', {
            action: 'update',
            flightId,
            error: 'Not authorized',
          });
          return;
        }

        try {
          const validSessionId = validateSessionId(sessionId);
          validateFlightId(flightId);

          if (Object.prototype.hasOwnProperty.call(updates, 'hidden')) {
            return;
          }

          socket.emit('flightUpdateAck', { flightId, updates });

          if (updates.callsign && typeof updates.callsign === 'string')
            updates.callsign = sanitizeCallsign(updates.callsign);
          if (updates.remark && typeof updates.remark === 'string')
            updates.remark = sanitizeString(updates.remark, 500);
          if (updates.squawk && typeof updates.squawk === 'string')
            updates.squawk = sanitizeSquawk(updates.squawk);
          if (updates.clearedFL && typeof updates.clearedFL === 'string')
            updates.clearedFL = sanitizeFlightLevel(updates.clearedFL);
          if (updates.cruisingFL && typeof updates.cruisingFL === 'string')
            updates.cruisingFL = sanitizeFlightLevel(updates.cruisingFL);
          if (updates.runway && typeof updates.runway === 'string')
            updates.runway = sanitizeRunway(updates.runway);
          if (updates.stand && typeof updates.stand === 'string')
            updates.stand = sanitizeString(updates.stand, 8);
          if (updates.gate && typeof updates.gate === 'string')
            updates.gate = sanitizeString(updates.gate, 8);
          if (updates.sid && typeof updates.sid === 'string')
            updates.sid = sanitizeString(updates.sid, 16);
          if (updates.star && typeof updates.star === 'string')
            updates.star = sanitizeString(updates.star, 16);

          if (updates.clearance !== undefined) {
            if (typeof updates.clearance === 'string') {
              updates.clearance = updates.clearance.toLowerCase() === 'true';
            }
          }

          const updatedFlight = await updateFlight(validSessionId, flightId as string, updates);

          if (updatedFlight) {
            io.emit('flightUpdated', {
                sessionId: validSessionId,
                flight: updatedFlight
            });

            const flightsIO = (await import('./flightsWebsocket.js')).getFlightsIO();
            if (flightsIO) {
                flightsIO.to(validSessionId).emit('flightUpdated', updatedFlight);
            }

            await broadcastToArrivalSessions(updatedFlight);

            await logFlightAction({
              userId: socket.data.userId || 'unknown',
              username: socket.data.username || 'unknown',
              sessionId: validSessionId,
              action: 'update',
              flightId: flightId as string,
              newData: updatedFlight,
              ipAddress: socket.handshake.address,
            });

            if (socket.data.userId) {
              incrementStat(
                socket.data.userId,
                'total_flight_edits',
                1,
                'total_edit_actions'
              );
            }
          } else {
            socket.emit('flightError', {
              action: 'update',
              flightId,
              error: 'Flight not found',
            });
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error('Error updating flight via overview socket:', error);
          socket.emit('flightError', {
            action: 'update',
            flightId,
            error: errorMessage || 'Failed to update flight',
          });
        }
      }
    );

    socket.on(
      'contactMe',
      async ({
        sessionId,
        flightId,
        message,
        station,
        position,
      }: {
        sessionId: string;
        flightId: string | number;
        message?: string;
        station?: string;
        position?: string;
      }) => {
        if (!socket.data.isEventController) {
          socket.emit('flightError', {
            action: 'contactMe',
            flightId,
            error: 'Not authorized',
          });
          return;
        }

        try {
          const validSessionId = validateSessionId(sessionId);
          validateFlightId(flightId);

          const sanitizedMessage = message
            ? sanitizeString(message, 200)
            : 'CONTACT CONTROLLER ON FREQUENCY';

          const flightsIO = (
            await import('./flightsWebsocket.js')
          ).getFlightsIO();
          if (flightsIO) {
            flightsIO.to(validSessionId).emit('contactMe', {
              flightId,
              message: sanitizedMessage,
              station: station ? sanitizeString(station, 50) : undefined,
              position: position ? sanitizeString(position, 50) : undefined,
              ts: new Date().toISOString(),
            });
          }
        } catch {
          socket.emit('flightError', {
            action: 'contactMe',
            flightId,
            error: 'Failed to send contact message',
          });
        }
      }
    );

    socket.on('disconnect', () => {
      activeOverviewClients.delete(socket.id);
      eventControllerClients.delete(socket.id);
    });

    socket.on('error', (error) => {
      console.error(
        '[Overview Socket] Socket error for',
        socket.id,
        ':',
        error
      );
    });
  });

  setInterval(async () => {
    if (activeOverviewClients.size > 0) {
      try {
        const overviewData = await getOverviewData(sessionUsersIO);
        io.emit('overviewData', overviewData);
      } catch (error) {
        console.error('Error broadcasting overview data:', error);
      }
    }
  }, 10000);

  return io;
}

async function broadcastToArrivalSessions(flight: Flight): Promise<void> {
  try {
    if (!flight.arrival) return;

    const allSessions = await getAllSessions();
    const arrivalSessions = allSessions.filter(
      (session) =>
        session.is_pfatc &&
        typeof flight.arrival === 'string' &&
        session.airport_icao === flight.arrival.toUpperCase()
    );

    const arrivalsIO = (await import('./arrivalsWebsocket.js')).getArrivalsIO();
    if (arrivalsIO) {
      for (const session of arrivalSessions) {
        arrivalsIO.to(session.session_id).emit('arrivalUpdated', flight);
      }
    }
  } catch {
    // Silent
  }
}

export async function getOverviewData(sessionUsersIO: SessionUsersServer) {
  try {
    const { getActiveSectorControllers } = await import(
      './sectorControllerWebsocket.js'
    );
    const sectorControllers = await getActiveSectorControllers();

    const allSessions = await getAllSessions();
    const pfatcSessions = allSessions.filter((session) => session.is_pfatc);
    const activeSessions = [];

    for (const session of pfatcSessions) {
      const sessionUsers = await sessionUsersIO.getActiveUsersForSession(
        session.session_id
      );
      const isActive = sessionUsers && sessionUsers.length > 0;

      if (isActive) {
        try {
          const flights = await getFlightsBySessionWithTime(
            session.session_id,
            2
          );

          let atisData = null;
          if (session.atis) {
            try {
              const encryptedAtis = JSON.parse(session.atis);
              atisData = decrypt(encryptedAtis);
            } catch (err) {
              console.error('Error decrypting ATIS:', err);
            }
          }

          const controllers = await Promise.all(
            sessionUsers.map(async (user) => {
              let hasVatsimRating = false;
              let isEventController = false;
              let avatar = null;

              if (user.id) {
                try {
                  const userData = await getUserById(user.id);
                  hasVatsimRating =
                    userData?.vatsim_rating_id && userData.vatsim_rating_id > 1;

                  if (userData?.avatar) {
                    avatar = `https://cdn.discordapp.com/avatars/${user.id}/${userData.avatar}.png`;
                  }

                  if (user.roles) {
                    isEventController = user.roles.some(
                      (role) => role.name === 'Event Controller'
                    );
                  }
                } catch (err) {
                  console.error(
                    'Error fetching user data for controller badges:',
                    err
                  );
                }
              }

              return {
                username: user.username || 'Unknown',
                role: user.position || 'APP',
                avatar,
                hasVatsimRating,
                isEventController,
              };
            })
          );

          activeSessions.push({
            sessionId: session.session_id,
            airportIcao: session.airport_icao,
            activeRunway: session.active_runway,
            createdAt: session.created_at,
            createdBy: session.created_by,
            isPFATC: session.is_pfatc,
            activeUsers: sessionUsers.length,
            controllers: controllers,
            atis: atisData,
            flights: flights || [],
            flightCount: flights ? flights.length : 0,
          });
        } catch (error) {
          console.error(
            `Error fetching flights for session ${session.session_id}:`,
            error
          );

          const controllers = await Promise.all(
            sessionUsers.map(async (user) => {
              let avatar = null;

              if (user.id) {
                try {
                  const userData = await getUserById(user.id);
                  if (userData?.avatar) {
                    avatar = `https://cdn.discordapp.com/avatars/${user.id}/${userData.avatar}.png`;
                  }
                } catch {
                  // Ignore avatar fetch errors in fallback
                }
              }

              return {
                username: user.username || 'Unknown',
                role: user.position || 'APP',
                avatar,
                hasVatsimRating: false,
                isEventController: false,
              };
            })
          );

          activeSessions.push({
            sessionId: session.session_id,
            airportIcao: session.airport_icao,
            activeRunway: session.active_runway,
            createdAt: session.created_at,
            createdBy: session.created_by,
            isPFATC: session.is_pfatc,
            activeUsers: sessionUsers.length,
            controllers: controllers,
            atis: null,
            flights: [],
            flightCount: 0,
          });
        }
      }
    }

    for (const sectorController of sectorControllers) {
      let hasVatsimRating = false;
      let isEventController = false;
      let avatar = sectorController.avatar;

      try {
        const userData = await getUserById(sectorController.id);
        hasVatsimRating =
          userData?.vatsim_rating_id && userData.vatsim_rating_id > 1;

        if (userData?.avatar && !avatar) {
          avatar = `https://cdn.discordapp.com/avatars/${sectorController.id}/${userData.avatar}.png`;
        }

        if (sectorController.roles) {
          isEventController = sectorController.roles.some(
            (role) => role.name === 'Event Controller'
          );
        }
      } catch (err) {
        console.error('Error fetching user data for sector controller:', err);
      }

      const controllerData = {
        username: sectorController.username || 'Unknown',
        role: 'CTR',
        avatar,
        hasVatsimRating,
        isEventController,
      };

      activeSessions.push({
        sessionId: `sector-${sectorController.id}`,
        airportIcao: sectorController.station,
        activeRunway: null,
        createdAt: new Date(sectorController.joinedAt).toISOString(),
        createdBy: sectorController.id,
        isPFATC: true,
        activeUsers: 1,
        controllers: [controllerData],
        atis: null,
        flights: [],
        flightCount: 0,
      });
    }

    type ArrivalFlight = (typeof activeSessions)[number]['flights'][number] & {
      sessionId: string;
      departureAirport: string;
    };
    const arrivalsByAirport: { [key: string]: ArrivalFlight[] } = {};
    activeSessions.forEach((session) => {
      session.flights.forEach((flight) => {
        if (flight.arrival) {
          const arrivalIcao = flight.arrival.toUpperCase();
          if (!arrivalsByAirport[arrivalIcao]) {
            arrivalsByAirport[arrivalIcao] = [];
          }
          arrivalsByAirport[arrivalIcao].push({
            ...flight,
            sessionId: session.sessionId,
            departureAirport: session.airportIcao,
          });
        }
      });
    });

    return {
      activeSessions,
      totalActiveSessions: activeSessions.length,
      totalFlights: activeSessions.reduce(
        (sum, session) => sum + session.flightCount,
        0
      ),
      arrivalsByAirport,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error in getOverviewData:', error);
    throw error;
  }
}

export function getOverviewIO() {
  return io;
}

export function hasOverviewClients() {
  return activeOverviewClients.size > 0;
}

export function broadcastFlightUpdate(sessionId: string, flight: Flight) {
  io.emit('flightUpdated', {
    sessionId,
    flight: flight,
  });
}
