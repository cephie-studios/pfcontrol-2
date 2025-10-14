import WebSocket from 'ws';
import protobuf from 'protobufjs';
import { HttpsProxyAgent } from 'https-proxy-agent';
import chalk from 'chalk';
import { sql } from 'kysely';
import {
  getActiveFlightByUsername,
  storeTelemetryPoint,
  updateActiveFlightState,
  addApproachAltitude,
  calculateLandingRate,
  finalizeFlight,
  removeActiveFlightTracking,
  updateUserStatsCache
} from '../db/logbook.js';
import { mainDb } from '../db/connection.js';
import { startLandingDataCollection, stopLandingDataCollection } from './landingDataFetcher.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const debug = (message: string, type = 'log') => {
  if (process.env.DEBUG === 'true') {
    const coloredMessage = message.replace(/\[Flight Tracker\]/g, chalk.bgYellow('[Flight Tracker]'));
    if (type === 'error') console.error(coloredMessage);
    else if (type === 'warn') console.warn(coloredMessage);
    else console.log(coloredMessage);
  }
};

const airportData = JSON.parse(readFileSync(join(__dirname, '../data/airportData.json'), 'utf-8'));
type Airport = { icao: string; elevation?: number };
const airportElevations: { [icao: string]: number } = {};
(airportData as Airport[]).forEach((airport: Airport) => {
  airportElevations[airport.icao] = airport.elevation || 0;
});

const PFATC_SERVER_ID = '2ykygVZiX5';

const PHASE_THRESHOLDS = {
  GROUND_ALT_BUFFER: 50,    // +/- 50ft from airport elevation = ground
  TAKEOFF_SPEED: 80,        // Above 80kts + climbing = takeoff
  CRUISE_ALT: 10000,        // Above 10,000ft = cruise
  APPROACH_ALT: 3000,       // Below 3,000ft descending = approach
  LANDING_SPEED: 100,       // Below 100kts on ground = landed
};

function getGroundLevel(arrivalIcao: string) {
  const elevation = airportElevations[arrivalIcao] || 0;
  return {
    min: elevation - PHASE_THRESHOLDS.GROUND_ALT_BUFFER,
    max: elevation + PHASE_THRESHOLDS.GROUND_ALT_BUFFER,
    elevation: elevation
  };
}

function isAtGroundLevel(altitude: number, arrivalIcao: string) {
  const ground = getGroundLevel(arrivalIcao);
  return altitude >= ground.min && altitude <= ground.max;
}

const STATE_THRESHOLDS = {
  MOVEMENT_SPEED: 5,        // Speed > 5kts = movement detected
  STATIONARY_SPEED: 3,      // Speed < 3kts = stationary
  STATIONARY_TIME: 120,     // 2 minutes stationary = at gate
  MOVEMENT_DISTANCE: 50,    // 50m movement from initial position = active
  PENDING_TIMEOUT: 1800,    // 30 minutes - cancel if no movement
  TRACKING_TIMEOUT: 600,    // 10 minutes - complete if no telemetry after landing
};

interface Plane {
  server_id: string;
  callsign: string;
  roblox_username: string;
  x: number;
  y: number;
  heading: number;
  altitude: number;
  speed: number;
  model: string;
  livery: string;
}

class FlightTracker {
  private socket: WebSocket | null;
  private reconnectInterval: number;
  private protobufRoot: protobuf.Root | null;
  private planesType: protobuf.Type | null;
  private isConnected: boolean;
  private flightData: Map<string, {
    x: number;
    y: number;
    altitude: number;
    speed: number;
    heading: number;
    model: string;
    livery: string;
    timestamp: Date;
  }>;
  private lastTelemetryTime: Map<string, number>;
  private reconnectAttempts: number;
  private maxReconnectAttempts: number;
  private connectionFailed: boolean;
  private lastPlaneCountLog: number;
  private flightNotFoundTimeout: number;
  private proxies: string[];
  private currentProxyIndex: number;

  constructor() {
    this.socket = null;
    this.reconnectInterval = 5000;
    this.protobufRoot = null;
    this.planesType = null;
    this.isConnected = false;
    this.flightData = new Map();
    this.lastTelemetryTime = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.connectionFailed = false;
    this.lastPlaneCountLog = 0;
    this.flightNotFoundTimeout = 30000;

    this.proxies = this.loadProxies();
    this.currentProxyIndex = 0;

    this.startFlightMonitoring();
  }

  loadProxies(): string[] {
    const proxies: (string | undefined)[] = [];

    if (process.env.PROXY_URL) {
      proxies.push(...process.env.PROXY_URL.split(',').map(p => p.trim()));
    }

    let i = 1;
    while (process.env[`PROXY_URL_${i}`]) {
      proxies.push(process.env[`PROXY_URL_${i}`]);
      i++;
    }

    return proxies.filter((p): p is string => typeof p === 'string' && p.length > 0);
  }

  getNextProxy() {
    if (this.proxies.length === 0) return null;

    const proxy = this.proxies[this.currentProxyIndex];
    this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
    return proxy;
  }

  async initialize() {
    this.protobufRoot = new protobuf.Root();
    const data = this.protobufRoot.define("data");

    data.add(new protobuf.Type("Plane")
      .add(new protobuf.Field("server_id", 1, "string"))
      .add(new protobuf.Field("callsign", 2, "string"))
      .add(new protobuf.Field("roblox_username", 3, "string"))
      .add(new protobuf.Field("x", 4, "double"))
      .add(new protobuf.Field("y", 5, "double"))
      .add(new protobuf.Field("heading", 6, "double"))
      .add(new protobuf.Field("altitude", 7, "double"))
      .add(new protobuf.Field("speed", 8, "double"))
      .add(new protobuf.Field("model", 9, "string"))
      .add(new protobuf.Field("livery", 10, "string"))
    );

    data.add(new protobuf.Type("planes")
      .add(new protobuf.Field("planes", 1, "Plane", "repeated"))
    );

    this.planesType = this.protobufRoot.lookupType("data.planes");

    this.connect();

    this.startTimeoutChecker();
  }

  startTimeoutChecker() {
    setInterval(async () => {
      await this.checkTimeouts();
    }, 60000);
  }

  async checkTimeouts() {
    try {
      const cancelResult = await mainDb
        .updateTable('logbook_flights')
        .set({ flight_status: 'cancelled' })
        .where(
          sql`flight_status = 'pending' AND created_at < NOW() - INTERVAL '${STATE_THRESHOLDS.PENDING_TIMEOUT} seconds'`,
          '=',
          true
        )
        .returning(['id', 'callsign'])
        .execute();

      if (cancelResult.length > 0) {
        for (const flight of cancelResult) {
          debug(`[Flight Tracker] Flight ${flight.callsign} cancelled - never departed`);
        }
      }

      const abortResult = await mainDb
        .updateTable('logbook_flights')
        .set({ flight_status: 'aborted' })
        .from('logbook_active_flights as af')
        .where(
          sql`logbook_flights.id = af.flight_id AND logbook_flights.flight_status = 'active' AND af.landing_detected = true AND af.last_update < NOW() - INTERVAL '${STATE_THRESHOLDS.TRACKING_TIMEOUT} seconds'`,
          '=',
          true
        )
        .returning(['logbook_flights.id', 'logbook_flights.callsign'])
        .execute();

      if (abortResult.length > 0) {
        for (const flight of abortResult) {
          debug(`[Flight Tracker] Flight ${flight.callsign} aborted - tracking lost after landing`);
          await mainDb.deleteFrom('logbook_active_flights').where('flight_id', '=', flight.id).execute();
        }
      }

    } catch (err) {
      debug(`[Flight Tracker] Error checking timeouts: ${err}`, 'error');
    }
  }

  connect() {
    if (this.connectionFailed || this.reconnectAttempts >= this.maxReconnectAttempts) {
      debug('[Flight Tracker] Max reconnection attempts reached or connection permanently failed. Flight tracking disabled.');
      return;
    }

    const wsOptions: WebSocket.ClientOptions & { headers: { [key: string]: string } } = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://project-flight.com'
      }
    };

    const proxyUrl = this.getNextProxy();
    if (proxyUrl) {
      wsOptions.agent = new HttpsProxyAgent(proxyUrl);
    }

    this.socket = new WebSocket('wss://v3api.project-flight.com/v3/traffic/server/ws/' + PFATC_SERVER_ID, wsOptions);

    this.socket.on('open', () => {
      const proxyInfo = proxyUrl ? ` (proxy ${this.currentProxyIndex}/${this.proxies.length})` : '';
      debug(`[Flight Tracker] WebSocket connected to PFATC server${proxyInfo}`);
      debug('[Flight Tracker] Ready to receive plane data and track active flights');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('message', async (data) => {
      let processedData: Buffer | ArrayBuffer | { arrayBuffer: () => Promise<ArrayBuffer> };
      if (Array.isArray(data)) {
        processedData = Buffer.concat(data);
      } else {
        processedData = data;
      }
      await this.handleMessage(processedData);
    });

    this.socket.on('close', () => {
      this.isConnected = false;

      if (!this.connectionFailed && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const backoffDelay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
        debug(`[Flight Tracker] WebSocket closed. Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${backoffDelay}ms`);
        setTimeout(() => this.connect(), backoffDelay);
      }
    });

    this.socket.on('error', (err) => {
      if (err.message && err.message.includes('403')) {
        debug('[Flight Tracker] Access denied (403). The Project Flight API may require authentication or have IP restrictions. Flight tracking disabled.', 'error');
        this.connectionFailed = true;
        if (this.socket) {
          this.socket.removeAllListeners();
        }
      } else if (this.reconnectAttempts === 0) {
        debug(`[Flight Tracker] WebSocket error: ${err.message}`, 'error');
      }
    });
  }

  async handleMessage(data: Buffer | ArrayBuffer | { arrayBuffer: () => Promise<ArrayBuffer> }) {
    try {
      let buffer: Uint8Array;
      if (data instanceof Buffer) {
        buffer = new Uint8Array(data);
      } else if (data instanceof ArrayBuffer) {
        buffer = new Uint8Array(data);
      } else if (typeof data === 'object' && typeof (data as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer === 'function') {
        buffer = new Uint8Array(await (data as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer());
      } else {
        throw new Error('Unsupported data type received in handleMessage');
      }
      if (!this.planesType) {
        debug(`[Flight Tracker] planesType is not initialized`, 'error');
        return;
      }
      const decoded = this.planesType.decode(buffer);
      const object = this.planesType.toObject(decoded, { defaults: true }) as { planes: Plane[] };

      const pfatcPlanes = (object.planes as Plane[]).filter(
        (plane) =>
          plane.server_id === PFATC_SERVER_ID &&
          typeof plane.callsign === 'string' &&
          typeof plane.roblox_username === 'string' &&
          typeof plane.x === 'number' &&
          typeof plane.y === 'number' &&
          typeof plane.heading === 'number' &&
          typeof plane.altitude === 'number' &&
          typeof plane.speed === 'number' &&
          typeof plane.model === 'string' &&
          typeof plane.livery === 'string'
      );

      const now = Date.now();
      if (!this.lastPlaneCountLog || (now - this.lastPlaneCountLog) >= 30000) {
        debug(`[Flight Tracker] Received data: ${pfatcPlanes.length} plane(s) in PFATC server`);
        this.lastPlaneCountLog = now;
      }

      for (const plane of pfatcPlanes) {
        await this.processPlane(plane as Plane);
      }
    } catch (err) {
      debug(`[Flight Tracker] Failed to decode protobuf message: ${err}`, 'error');
    }
  }
  
    async processPlane(plane: Plane) {
    try {
      const activeFlight = await getActiveFlightByUsername(plane.roblox_username);
      if (!activeFlight) return;

      if (!this.flightData.has(plane.roblox_username)) {
        debug(`[Flight Tracker] Now tracking ${plane.roblox_username} (${activeFlight.callsign}) - alt: ${Math.round(plane.altitude)}ft, spd: ${Math.round(plane.speed)}kts`);
      }

      const currentData = {
        x: plane.x,
        y: plane.y,
        altitude: Math.round(plane.altitude),
        speed: Math.round(plane.speed),
        heading: Math.round(plane.heading),
        model: plane.model,
        livery: plane.livery,
        timestamp: new Date()
      };

      const previousData = this.flightData.get(plane.roblox_username);

      if (typeof activeFlight.flight_id === 'undefined') {
        debug(`[Flight Tracker] activeFlight.flight_id is undefined`, 'error');
        return;
      }
      const flightResult = await mainDb
        .selectFrom('logbook_flights')
        .select(['controller_status', 'arrival_icao', 'flight_status'])
        .where('id', '=', activeFlight.flight_id)
        .executeTakeFirst();

      if (!flightResult) {
        debug(`[Flight Tracker] Flight not found for id ${activeFlight.flight_id}`, 'error');
        return;
      }

      let controllerStatus = flightResult.controller_status;
      const arrivalIcao = flightResult.arrival_icao;
      const flightStatus = flightResult.flight_status;

      if (controllerStatus?.toLowerCase() === 'depa' && currentData.altitude > 1000 && previousData) {
        const vs = this.calculateVerticalSpeed(currentData, previousData);
        if (Math.abs(vs) < 300) {
          await mainDb
        .updateTable('logbook_flights')
        .set({ controller_status: undefined })
        .where('id', '=', activeFlight.flight_id)
        .execute();
          controllerStatus = undefined;
        }
      }

      if (typeof activeFlight.callsign === 'undefined') {
        debug(`[Flight Tracker] activeFlight.callsign is undefined`, 'error');
        return;
      }
      await this.detectFlightState(
        { ...activeFlight, callsign: activeFlight.callsign as string },
        currentData,
        controllerStatus
      );

      const phase = previousData
        ? this.detectHybridPhase(
            currentData,
            previousData,
            controllerStatus,
            arrivalIcao ?? null,
            flightStatus
          )
        : 'unknown';

      const lastTelemetry = this.lastTelemetryTime.get(plane.roblox_username);
      const shouldStoreTelemetry = !lastTelemetry ||
        (currentData.timestamp.getTime() - lastTelemetry) >= 5000;

      if (shouldStoreTelemetry) {
        const verticalSpeed = previousData
          ? this.calculateVerticalSpeed(currentData, previousData)
          : 0;

        await storeTelemetryPoint(activeFlight.flight_id, {
          x: currentData.x,
          y: currentData.y,
          altitude: currentData.altitude,
          speed: currentData.speed,
          heading: currentData.heading,
          timestamp: currentData.timestamp,
          phase: phase,
          verticalSpeed: verticalSpeed
        });

        if (plane.model) {
          await mainDb
            .updateTable('logbook_flights')
            .set({ aircraft_model: plane.model, livery: plane.livery })
            .where('id', '=', activeFlight.flight_id)
            .execute();
        }

        this.lastTelemetryTime.set(plane.roblox_username, currentData.timestamp.getTime());
      }

      await updateActiveFlightState(plane.roblox_username, {
        altitude: currentData.altitude,
        speed: currentData.speed,
        heading: currentData.heading,
        x: currentData.x,
        y: currentData.y,
        phase: phase
      });

      if (phase === 'approach' || phase === 'landing') {
        await addApproachAltitude(
          plane.roblox_username,
          currentData.altitude,
          currentData.timestamp
        );
      }

      if (await this.detectLanding(currentData, previousData, arrivalIcao)) {
        if (!activeFlight.landing_detected) {
          debug(`[Flight Tracker] Landing detected: ${activeFlight.callsign}`);

          await mainDb
        .updateTable('logbook_active_flights')
        .set({
          landing_detected: true
        })
        .where('roblox_username', '=', plane.roblox_username)
        .execute();

          const proxyUrl = this.proxies.length > 0 ? this.proxies[this.currentProxyIndex % this.proxies.length] : null;
          await startLandingDataCollection(plane.roblox_username, proxyUrl);
        }
      }

      this.flightData.set(plane.roblox_username, currentData);

    } catch (err) {
      debug(`[Flight Tracker] Error processing plane for ${plane.roblox_username}: ${err}`, 'error');
    }
  }

  detectHybridPhase(
    current: {
      altitude: number;
      speed: number;
      timestamp: Date;
    },
    previous: {
      altitude: number;
      speed: number;
      timestamp: Date;
    } | undefined,
    controllerStatus: string | undefined,
    arrivalIcao: string | null = null,
    flightStatus: string | null = null
  ): string {
    const alt = current.altitude;
    const speed = current.speed;

    let vs = 0;
    if (previous && previous.timestamp) {
      const altChange = current.altitude - previous.altitude;
      const timeChange = (current.timestamp.getTime() - previous.timestamp.getTime()) / 1000;
      if (timeChange > 0) {
        vs = Math.round((altChange / timeChange) * 60);
      }
    }

    const status = controllerStatus?.toLowerCase();

    // === PENDING FLIGHT - AWAITING CLEARANCE ===
    if (flightStatus === 'pending' && isAtGroundLevel(alt, arrivalIcao ?? '') && speed <= 12) {
      return 'awaiting_clearance';
    }

    // === GROUND PHASES ===

    if (status === 'push' || status === 'stup') {
      return 'push';
    }

    if (status === 'origin_taxi') {
      return 'origin_taxi';
    }
    if (status === 'destination_taxi') {
      return 'destination_taxi';
    }
    if (status === 'taxi' || (isAtGroundLevel(alt, arrivalIcao ?? '') && speed > 12)) {
      return 'taxi';
    }

    if (status === 'origin_runway') {
      return 'origin_runway';
    }
    if (status === 'destination_runway') {
      return 'destination_runway';
    }
    if (status === 'rwy') {
      return 'rwy';
    }

    if (status === 'gate') {
      return 'parked';
    }

    // === AIRBORNE PHASES ===

    if ((status === 'depa' || status === 'departure') && alt < 10000) {
      return 'climb';
    }

    if (status === 'appr' || status === 'approach') {
      return 'approach';
    }

    // === TELEMETRY-BASED DETECTION (when no controller status) ===

    if (isAtGroundLevel(alt, arrivalIcao ?? '')) {
      if (speed > 12) {
        return 'taxi';
      }
      if (flightStatus === 'active' && arrivalIcao && isAtGroundLevel(alt, arrivalIcao)) {
        return 'taxi';
      }
      return 'unknown';
    }

    if (speed > 80 && vs > 0) {
      return 'climb';
    }

    if (vs > 300) {
      return 'climb';
    }

    if (Math.abs(vs) < 300 && alt > 1000) {
      return 'cruise';
    }

    if (vs < -300 && alt > PHASE_THRESHOLDS.APPROACH_ALT) {
      return 'descent';
    }

    if (alt <= PHASE_THRESHOLDS.APPROACH_ALT && vs < 0) {
      return 'approach';
    }

    if (alt < 100 && vs < 0) {
      return 'landing';
    }

    return 'unknown';
  }

  async detectFlightState(
    activeFlight: { flight_id?: number; roblox_username: string; callsign: string; initial_position_x?: number; initial_position_y?: number; landing_detected?: boolean; stationary_since?: string | Date | null; stationary_notification_sent?: boolean; },
    currentData: { x: number; y: number; altitude: number; speed: number; heading: number; },
    controllerStatus: string | undefined
  ) {
    try {
      if (typeof activeFlight.flight_id === 'undefined' || typeof activeFlight.callsign === 'undefined') {
        debug(`[Flight Tracker] activeFlight.flight_id or callsign is undefined`, 'error');
        return;
      }
      const flightResult = await mainDb
        .selectFrom('logbook_flights')
        .select(['flight_status', 'controller_managed', 'arrival_icao'])
        .where('id', '=', activeFlight.flight_id)
        .executeTakeFirst();

      if (!flightResult) return;

      const arrivalIcao = flightResult.arrival_icao;
      const currentStatus = flightResult.flight_status;
      const controllerManaged = flightResult.controller_managed;

      if (controllerManaged && controllerStatus?.toLowerCase() !== 'gate') {
        return;
      }

      // === PENDING -> ACTIVE Detection ===
      if (currentStatus === 'pending') {
        if (!activeFlight.initial_position_x) {
          await mainDb
            .updateTable('logbook_active_flights')
            .set({
              initial_position_x: currentData.x,
              initial_position_y: currentData.y,
              initial_position_time: sql`NOW()`
            })
            .where('roblox_username', '=', activeFlight.roblox_username)
            .execute();

          await mainDb
            .updateTable('logbook_flights')
            .set({
              departure_position_x: currentData.x,
              departure_position_y: currentData.y
            })
            .where('id', '=', activeFlight.flight_id)
            .execute();

          return;
        }
        }

        const distance = this.calculateDistance(
          activeFlight.initial_position_x ?? 0,
          activeFlight.initial_position_y ?? 0,
          currentData.x,
          currentData.y
        );

        const hasSpeed = currentData.speed > STATE_THRESHOLDS.MOVEMENT_SPEED;
        const hasMovedDistance = distance > STATE_THRESHOLDS.MOVEMENT_DISTANCE;
        const isAirborne = !isAtGroundLevel(currentData.altitude, arrivalIcao ?? '');

        if ((hasSpeed && hasMovedDistance) || isAirborne) {
          await mainDb
            .updateTable('logbook_flights')
            .set({
              flight_status: 'active',
              flight_start: sql`NOW()`,
              activated_at: sql`NOW()`
            })
            .where('id', '=', activeFlight.flight_id)
            .execute();

          await mainDb
            .updateTable('logbook_active_flights')
            .set({
              movement_started: true,
              movement_start_time: sql`NOW()`
            })
            .where('roblox_username', '=', activeFlight.roblox_username)
            .execute();

          debug(`[Flight Tracker] Flight ${activeFlight.callsign} is now ACTIVE`);
        }

      // === ACTIVE -> COMPLETED Detection (after landing) ===
      else if (currentStatus === 'active' && activeFlight.landing_detected) {
        const isStationary = currentData.speed < STATE_THRESHOLDS.STATIONARY_SPEED;
        const onGround = isAtGroundLevel(currentData.altitude, arrivalIcao ?? '');
        if (isStationary && onGround) {
          if (!activeFlight.stationary_since) {
            await mainDb
              .updateTable('logbook_active_flights')
              .set({
          stationary_since: sql`NOW()`,
          stationary_position_x: currentData.x,
          stationary_position_y: currentData.y,
          stationary_notification_sent: false
              })
              .where('roblox_username', '=', activeFlight.roblox_username)
              .execute();
          } else {
            const stationaryDuration = (new Date().getTime() - new Date(activeFlight.stationary_since as string).getTime()) / 1000;

            if (stationaryDuration >= 60 && !activeFlight.stationary_notification_sent) {
              const userResult = await mainDb
          .selectFrom('logbook_flights')
          .select(['user_id'])
          .where('id', '=', activeFlight.flight_id)
          .executeTakeFirst();

              if (userResult && userResult.user_id) {
          await mainDb
            .insertInto('user_notifications')
            .values({
              id: sql`DEFAULT`,
              user_id: userResult.user_id,
              type: 'info',
              title: 'Flight Ready to Complete',
              message: `Your flight ${activeFlight.callsign} has arrived at the gate. You can end your flight from the logbook page, or it will automatically complete if you disconnect.`,
              created_at: sql`NOW()`
            })
            .execute();

          await mainDb
            .updateTable('logbook_active_flights')
            .set({ stationary_notification_sent: true })
            .where('roblox_username', '=', activeFlight.roblox_username)
            .execute();
              }
            }
          }
        } else if (currentData.speed > STATE_THRESHOLDS.STATIONARY_SPEED) {
          if (activeFlight.stationary_since) {
            await mainDb
              .updateTable('logbook_active_flights')
              .set({
          stationary_since: undefined,
          stationary_position_x: undefined,
          stationary_position_y: undefined,
          stationary_notification_sent: false
              })
              .where('roblox_username', '=', activeFlight.roblox_username)
              .execute();
          }
        }
      debug(`[Flight Tracker] Error detecting flight state`, 'error');
    }
    } catch (err) {
      debug(`[Flight Tracker] Error detecting flight state for ${activeFlight.roblox_username}: ${err}`, 'error');
    }
  }

  calculateVerticalSpeed(
    current: { altitude: number; timestamp: number | Date },
    previous: { altitude: number; timestamp: number | Date }
  ): number {
    const altChange = current.altitude - previous.altitude;
    const timeChange =
      (typeof current.timestamp === 'number'
        ? current.timestamp
        : new Date(current.timestamp).getTime()) -
      (typeof previous.timestamp === 'number'
        ? previous.timestamp
        : new Date(previous.timestamp).getTime());
    const timeChangeSeconds = timeChange / 1000;

    if (timeChangeSeconds === 0) return 0;

    const feetPerSecond = altChange / timeChangeSeconds;
    return Math.round(feetPerSecond * 60);
  }

  async detectLanding(
    current: { altitude: number; speed: number },
    previous: { altitude: number } | undefined,
    arrivalIcao: string | null | undefined = null
  ): Promise<boolean> {
    if (!previous) return false;

    const isOnGround = isAtGroundLevel(current.altitude, arrivalIcao ?? '');
    const lowSpeed = current.speed < PHASE_THRESHOLDS.LANDING_SPEED;
    const wasInAir = previous.altitude > 100;

    return isOnGround && lowSpeed && wasInAir;
  }

  async handleFlightCompletion(
    activeFlight: {
      flight_id: number;
      roblox_username: string;
      callsign: string;
      landing_detected?: boolean;
      stationary_since?: string | Date | null;
      stationary_notification_sent?: boolean;
      [key: string]: unknown;
    },
    robloxUsername: string
  ) {
    try {
      await stopLandingDataCollection(robloxUsername);

      const telemetry = await mainDb
        .selectFrom('logbook_telemetry')
        .selectAll()
        .where('flight_id', '=', activeFlight.flight_id)
        .orderBy('timestamp', 'asc')
        .execute();

      if (telemetry.length < 2) {
        await mainDb
          .updateTable('logbook_flights')
          .set({ flight_status: 'aborted' })
          .where('id', '=', activeFlight.flight_id)
          .execute();
        await removeActiveFlightTracking(robloxUsername);
        this.flightData.delete(robloxUsername);
        this.lastTelemetryTime.delete(robloxUsername);
        return;
      }

      const filteredTelemetry = telemetry.filter(
        (t) =>
          typeof t.x === 'number' &&
          typeof t.y === 'number' &&
          typeof t.altitude_ft === 'number' &&
          typeof t.speed_kts === 'number' &&
          t.timestamp !== undefined && t.timestamp !== null
      ).map(t => ({
        x: t.x as number,
        y: t.y as number,
        altitude_ft: t.altitude_ft as number,
        speed_kts: t.speed_kts as number,
        timestamp: t.timestamp
      }));

      const stats = await this.calculateFlightStats(filteredTelemetry, activeFlight);

      if (stats.landingScore === null || stats.landingScore === undefined) {
        stats.landingScore = 0;
      }

      await finalizeFlight(activeFlight.flight_id, { ...stats, landingScore: stats.landingScore ?? 0 });

      const flightResult = await mainDb
        .selectFrom('logbook_flights')
        .select(['user_id'])
        .where('id', '=', activeFlight.flight_id)
        .execute();

      if (flightResult[0]) {
        await updateUserStatsCache(flightResult[0].user_id);
      }

      await removeActiveFlightTracking(robloxUsername);
      this.flightData.delete(robloxUsername);
      this.lastTelemetryTime.delete(robloxUsername);

    } catch (err) {
      debug(`[Flight Tracker] Error completing flight: ${err}`, 'error');
    }
  }

  async calculateFlightStats(
    telemetry: Array<{
      x: number;
      y: number;
      altitude_ft: number;
      speed_kts: number;
      timestamp: string | number | Date;
    }>,
    activeFlight: {
      roblox_username: string;
      flight_id: number;
    }
  ) {
    const firstPoint = telemetry[0];
    const lastPoint = telemetry[telemetry.length - 1];
    const firstTimestamp = typeof firstPoint.timestamp === 'number'
      ? firstPoint.timestamp
      : new Date(firstPoint.timestamp).getTime();
    const lastTimestamp = typeof lastPoint.timestamp === 'number'
      ? lastPoint.timestamp
      : new Date(lastPoint.timestamp).getTime();
    const durationMs = lastTimestamp - firstTimestamp;
    const durationMinutes = Math.round(durationMs / 60000);

    const maxAltitude = Math.max(...telemetry.map((t) => t.altitude_ft || 0));
    const maxSpeed = Math.max(...telemetry.map((t) => t.speed_kts || 0));

    const airbornePoints = telemetry.filter((t) => t.altitude_ft > 100);
    const averageSpeed =
      airbornePoints.length > 0
        ? Math.round(
            airbornePoints.reduce((sum: number, t) => sum + (t.speed_kts || 0), 0) /
              airbornePoints.length
          )
        : 0;

    let totalDistance = 0;
    for (let i = 1; i < telemetry.length; i++) {
      const prev = telemetry[i - 1];
      const curr = telemetry[i];
      const distance = this.calculateDistance(prev.x, prev.y, curr.x, curr.y);
      totalDistance += distance;
    }
    totalDistance = Math.round(totalDistance * 0.000539957);

    const landingRate = await calculateLandingRate(activeFlight.roblox_username);

    const smoothnessScore = this.calculateSmoothnessScore(telemetry);

    const landingScore = landingRate ? this.calculateLandingScore(landingRate) : null;

    return {
      durationMinutes,
      totalDistance,
      maxAltitude,
      maxSpeed,
      averageSpeed,
      landingRate,
      smoothnessScore,
      landingScore
    };
  }

  calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  calculateSmoothnessScore(telemetry: Array<{ speed_kts?: number; altitude_ft?: number }>) {
    let score = 100;

    for (let i = 1; i < telemetry.length; i++) {
      const speedDelta = Math.abs((telemetry[i].speed_kts || 0) - (telemetry[i - 1].speed_kts || 0));
      const altDelta = Math.abs((telemetry[i].altitude_ft || 0) - (telemetry[i - 1].altitude_ft || 0));

      if (speedDelta > 20) score -= 2;

      if (altDelta > 500) score -= 3;
    }

    return Math.max(0, Math.min(100, score));
  }

  calculateLandingScore(landingRate: number) {
    const rate = Math.abs(landingRate);

    if (rate < 100) return 100;
    if (rate < 300) return 100 - ((rate - 100) / 2);
    if (rate < 600) return 80 - ((rate - 300) / 15);
    if (rate < 1000) return 60 - ((rate - 600) / 10);
    return Math.max(0, 20 - ((rate - 1000) / 50));
  }

  startFlightMonitoring() {
    setInterval(async () => {
      await this.checkForMissingFlights();
    }, 15000);
  }

  async checkForMissingFlights() {
    try {
      const activeFlights = await mainDb
        .selectFrom('logbook_active_flights as laf')
        .innerJoin('logbook_flights as lf', 'laf.flight_id', 'lf.id')
        .selectAll('laf')
        .select([
          'lf.callsign',
          'lf.user_id',
          'lf.flight_status'
        ])
        .where('lf.flight_status', 'in', ['pending', 'active'])
        .execute();

      const now = Date.now();

      for (const flight of activeFlights) {
        const lastTelemetry = this.lastTelemetryTime.get(flight.roblox_username);

        if (lastTelemetry && (now - lastTelemetry) > this.flightNotFoundTimeout) {

            if (flight.landing_detected) {
            if (flight.stationary_position_x && flight.stationary_position_y) {
              await mainDb
              .updateTable('logbook_flights')
              .set({
                arrival_position_x: flight.stationary_position_x,
                arrival_position_y: flight.stationary_position_y
              })
              .where('id', '=', flight.flight_id!)
              .execute();
            }

            if (typeof flight.flight_id === 'number') {
              await this.handleFlightCompletion(
                { ...flight, flight_id: flight.flight_id as number },
                flight.roblox_username
              );
            } else {
              debug(`[Flight Tracker] Skipping flight completion for ${flight.roblox_username} due to missing flight_id`, 'error');
            }
            } else {
            await removeActiveFlightTracking(flight.roblox_username);

            await mainDb
              .deleteFrom('logbook_flights')
              .where('id', '=', flight.flight_id!)
              .execute();

            await mainDb
              .insertInto('user_notifications')
              .values({
              id: sql`DEFAULT`,
              user_id: flight.user_id,
              type: 'error',
              title: 'Flight Not Found',
              message: `We couldn't find your flight in the public ATC server. Make sure you're connected to the PFATC server. Your flight log entry for "${flight.callsign}" has been deleted.`,
              created_at: sql`NOW()`
              })
              .execute();
            }

          this.lastTelemetryTime.delete(flight.roblox_username);
          this.flightData.delete(flight.roblox_username);
        } else if (!lastTelemetry) {
          this.lastTelemetryTime.set(flight.roblox_username, now);
        }
      }
    } catch (error) {
      debug(`[Flight Tracker] Error checking for missing flights: ${error}`, 'error');
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
  }
}

const flightTracker = new FlightTracker();

export default flightTracker;