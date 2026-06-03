import { Server as SocketServer } from 'socket.io';
import { updateFlight, getFlightById } from '../db/flights.js';
import { getUserById } from '../db/users.js';
import {
  getOverviewForClient,
  setOverviewSessionUsersIO,
  refreshOverviewSnapshot,
} from '../realtime/overview.js';
import { setOverviewIO as registerOverviewIO } from '../realtime/socketRegistry.js';
import { getFlightsIO } from '../realtime/socketRegistry.js';
import { validateFlightId, validateSessionId } from '../utils/validation.js';
import {
  sanitizeCallsign,
  sanitizeString,
  sanitizeSquawk,
  sanitizeFlightLevel,
  sanitizeRunway,
} from '../utils/sanitization.js';
import {
  isPFATCSectorController,
  isAATCSectorController,
} from '../middleware/flightAccess.js';
import { incrementStat } from '../utils/statisticsCache.js';
import { logFlightAction } from '../db/flightLogs.js';
import type { Server as HTTPServer } from 'http';
import type { SessionUsersServer } from './sessionUsersWebsocket.js';
import type { Flight } from '../utils/flightUtils.js';
import { createHandshakeRateLimiter } from './handshakeRateLimit.js';

let io: SocketServer;
const activeOverviewClients = new Set<string>();
const eventControllerClients = new Set<string>();

export function setupOverviewWebsocket(
  httpServer: HTTPServer,
  sessionUsersIO: SessionUsersServer
) {
  io = new SocketServer(httpServer, {
    path: '/sockets/overview',
    allowRequest: createHandshakeRateLimiter({ scope: 'overview' }),
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:9901',
        'https://pfcontrol.com',
        'https://canary.pfcontrol.com',
      ],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    perMessageDeflate: {
      threshold: 1024,
    },
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
      const [canPfatc, canAatc] = await Promise.all([
        isPFATCSectorController(userId),
        isAATCSectorController(userId),
      ]);

      if (canPfatc || canAatc) {
        eventControllerClients.add(socket.id);
        socket.data.isEventController = true;
        socket.data.canEditPfatc = canPfatc;
        socket.data.canEditAatc = canAatc;
        socket.data.userId = userId;
        socket.data.username =
          (socket.handshake.query.username as string) || 'Unknown';
      }
    }

    try {
      const overviewData = await getOverviewForClient(sessionUsersIO);
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

          // Enforce per-network-type access
          const session = await (
            await import('../db/sessions.js')
          ).getSessionById(validSessionId);
          if (!session) {
            socket.emit('flightError', {
              action: 'update',
              flightId,
              error: 'Session not found',
            });
            return;
          }
          if (session.is_pfatc && !socket.data.canEditPfatc) {
            socket.emit('flightError', {
              action: 'update',
              flightId,
              error: 'Not authorized to edit PFATC flights',
            });
            return;
          }
          if (session.is_advanced_atc && !socket.data.canEditAatc) {
            socket.emit('flightError', {
              action: 'update',
              flightId,
              error: 'Not authorized to edit AATC flights',
            });
            return;
          }
          validateFlightId(flightId);

          if (Object.prototype.hasOwnProperty.call(updates, 'hidden')) {
            return;
          }

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

          if (updates.req_at !== undefined) {
            if (updates.req_at === '' || updates.req_at === null) {
              updates.req_at = null;
            } else if (
              typeof updates.req_at === 'string' &&
              !isNaN(Date.parse(updates.req_at))
            ) {
              // valid ISO timestamp — keep as-is
            } else {
              delete updates.req_at;
            }
          }
          if (updates.req_phase !== undefined) {
            if (updates.req_phase === '' || updates.req_phase === null) {
              updates.req_phase = null;
            } else if (
              typeof updates.req_phase === 'string' &&
              ['C', 'P', 'T', 'G'].includes(updates.req_phase)
            ) {
              // valid phase — keep as-is
            } else {
              delete updates.req_phase;
            }
          }

          if (updates.clearance !== undefined) {
            if (typeof updates.clearance === 'string') {
              updates.clearance = updates.clearance.toLowerCase() === 'true';
            }
          }

          const oldFlight = await getFlightById(
            validSessionId,
            flightId as string
          );

          const updatedFlight = await updateFlight(
            validSessionId,
            flightId as string,
            updates
          );

          if (updatedFlight) {
            socket.emit('flightUpdateAck', { flightId, updates });

            const flightsIO = getFlightsIO();
            if (flightsIO) {
              flightsIO.to(validSessionId).emit('flightUpdated', updatedFlight);
            }

            setImmediate(() => {
              void (async () => {
                const flightOwner = oldFlight?.user_id
                  ? await getUserById(oldFlight.user_id)
                  : null;
                const {
                  user_id: _uid,
                  ip_address: _ip,
                  acars_token: _at,
                  ...oldSanitized
                } = oldFlight || {};
                await logFlightAction({
                  userId: socket.data.userId || 'unknown',
                  username: socket.data.username || 'unknown',
                  sessionId: validSessionId,
                  action: 'update',
                  flightId: flightId as string,
                  oldData: {
                    ...oldSanitized,
                    flight_owner_user_id: oldFlight?.user_id || null,
                    flight_owner_username: flightOwner?.username || null,
                  },
                  newData: updatedFlight ?? {},
                  ipAddress: socket.handshake.address,
                });
              })();
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

          // Enforce per-network-type access for contactMe
          const session = await (
            await import('../db/sessions.js')
          ).getSessionById(validSessionId);
          if (!session) {
            socket.emit('flightError', {
              action: 'contactMe',
              flightId,
              error: 'Session not found',
            });
            return;
          }
          if (session.is_pfatc && !socket.data.canEditPfatc) {
            socket.emit('flightError', {
              action: 'contactMe',
              flightId,
              error: 'Not authorized for PFATC sessions',
            });
            return;
          }
          if (session.is_advanced_atc && !socket.data.canEditAatc) {
            socket.emit('flightError', {
              action: 'contactMe',
              flightId,
              error: 'Not authorized for AATC sessions',
            });
            return;
          }

          const sanitizedMessage = message
            ? sanitizeString(message, 200)
            : 'CONTACT CONTROLLER ON FREQUENCY';

          const flightsIO = getFlightsIO();
          if (flightsIO) {
            flightsIO.to(validSessionId).emit('contactMe', {
              flightId,
              message: sanitizedMessage,
              station: station ? sanitizeString(station, 50) : undefined,
              position: position ? sanitizeString(position, 50) : undefined,
              ts: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error('Error sending contact message:', error);
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

  setOverviewSessionUsersIO(sessionUsersIO);
  registerOverviewIO(io);

  const overviewRefreshInterval = setInterval(async () => {
    if (activeOverviewClients.size === 0) return;
    try {
      const overviewData = await refreshOverviewSnapshot(sessionUsersIO);
      io.emit('overviewData', overviewData);
    } catch (error) {
      console.error('Error refreshing overview data:', error);
    }
  }, 5000);

  const overviewReconcileInterval = setInterval(async () => {
    if (activeOverviewClients.size === 0) return;
    try {
      const overviewData = await getOverviewForClient(sessionUsersIO, {
        forceRefresh: true,
      });
      io.emit('overviewData', overviewData);
    } catch (error) {
      console.error('Error reconciling overview data:', error);
    }
  }, 90000);

  // Cleanup on shutdown
  process.on('SIGTERM', () => {
    console.log('[Overview] Cleaning up intervals...');
    clearInterval(overviewRefreshInterval);
    clearInterval(overviewReconcileInterval);
    activeOverviewClients.clear();
    eventControllerClients.clear();
  });

  return io;
}

export async function getOverviewData(sessionUsersIO: SessionUsersServer) {
  return getOverviewForClient(sessionUsersIO, { forceRefresh: true });
}

export function getOverviewIO() {
  return io;
}

export function hasOverviewClients() {
  return activeOverviewClients.size > 0;
}

export function broadcastFlightUpdate(sessionId: string, flight: Flight) {
  if (!io) {
    console.error('Overview IO not initialized');
    return;
  }
  io.emit('flightUpdated', { sessionId, flight });
}
