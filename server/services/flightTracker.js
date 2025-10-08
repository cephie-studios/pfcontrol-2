import WebSocket from 'ws';
import protobuf from 'protobufjs';
import { HttpsProxyAgent } from 'https-proxy-agent';
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
import pool from '../db/connections/connection.js';
import { startLandingDataCollection, stopLandingDataCollection } from './landingDataFetcher.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const debug = (message, type = 'log') => {
    if (process.env.DEBUG === 'true') {
        if (type === 'error') console.error(message);
        else if (type === 'warn') console.warn(message);
        else console.log(message);
    }
};

const airportData = JSON.parse(readFileSync(join(__dirname, '../data/airportData.json'), 'utf-8'));
const airportElevations = {};
airportData.forEach(airport => {
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

function getGroundLevel(arrivalIcao) {
    const elevation = airportElevations[arrivalIcao] || 0;
    return {
        min: elevation - PHASE_THRESHOLDS.GROUND_ALT_BUFFER,
        max: elevation + PHASE_THRESHOLDS.GROUND_ALT_BUFFER,
        elevation: elevation
    };
}

function isAtGroundLevel(altitude, arrivalIcao) {
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

class FlightTracker {
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

    loadProxies() {
        const proxies = [];

        if (process.env.PROXY_URL) {
            proxies.push(...process.env.PROXY_URL.split(',').map(p => p.trim()));
        }

        let i = 1;
        while (process.env[`PROXY_URL_${i}`]) {
            proxies.push(process.env[`PROXY_URL_${i}`]);
            i++;
        }

        return proxies;
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
            const cancelResult = await pool.query(`
                UPDATE logbook_flights
                SET flight_status = 'cancelled'
                WHERE flight_status = 'pending'
                AND created_at < NOW() - INTERVAL '${STATE_THRESHOLDS.PENDING_TIMEOUT} seconds'
                RETURNING id, callsign
            `);

            if (cancelResult.rows.length > 0) {
                for (const flight of cancelResult.rows) {
                    debug(`⏱️ [Flight Tracker] Flight ${flight.callsign} cancelled - never departed`);
                }
            }

            const abortResult = await pool.query(`
                UPDATE logbook_flights f
                SET flight_status = 'aborted'
                FROM logbook_active_flights af
                WHERE f.id = af.flight_id
                AND f.flight_status = 'active'
                AND af.landing_detected = true
                AND af.last_update < NOW() - INTERVAL '${STATE_THRESHOLDS.TRACKING_TIMEOUT} seconds'
                RETURNING f.id, f.callsign
            `);

            if (abortResult.rows.length > 0) {
                for (const flight of abortResult.rows) {
                    debug(`⚠️ [Flight Tracker] Flight ${flight.callsign} aborted - tracking lost after landing`);
                    await pool.query(`
                        DELETE FROM logbook_active_flights
                        WHERE flight_id = $1
                    `, [flight.id]);
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

        const wsOptions = {
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
            debug(`✅ [Flight Tracker] WebSocket connected to PFATC server${proxyInfo}`);
            debug('📡 [Flight Tracker] Ready to receive plane data and track active flights');
            this.isConnected = true;
            this.reconnectAttempts = 0;
        });

        this.socket.on('message', async (data) => {
            await this.handleMessage(data);
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

    async handleMessage(data) {
        try {
            const buffer = data instanceof Buffer ? new Uint8Array(data) : new Uint8Array(await data.arrayBuffer());
            const decoded = this.planesType.decode(buffer);
            const object = this.planesType.toObject(decoded, { defaults: true });

            const pfatcPlanes = object.planes.filter(plane => plane.server_id === PFATC_SERVER_ID);

            const now = Date.now();
            if (!this.lastPlaneCountLog || (now - this.lastPlaneCountLog) >= 30000) {
                debug(`📡 [Flight Tracker] Received data: ${pfatcPlanes.length} plane(s) in PFATC server`);
                this.lastPlaneCountLog = now;
            }

            for (const plane of pfatcPlanes) {
                await this.processPlane(plane);
            }
        } catch (err) {
            debug(`[Flight Tracker] Failed to decode protobuf message: ${err}`, 'error');
        }
    }

    async processPlane(plane) {
        try {
            const activeFlight = await getActiveFlightByUsername(plane.roblox_username);
            if (!activeFlight) return;

            if (!this.flightData.has(plane.roblox_username)) {
                debug(`✈️  [Flight Tracker] Now tracking ${plane.roblox_username} (${activeFlight.callsign}) - alt: ${Math.round(plane.altitude)}ft, spd: ${Math.round(plane.speed)}kts`);
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

            const flightResult = await pool.query(`
                SELECT controller_status, arrival_icao, flight_status FROM logbook_flights WHERE id = $1
            `, [activeFlight.flight_id]);
            let controllerStatus = flightResult.rows[0]?.controller_status;
            const arrivalIcao = flightResult.rows[0]?.arrival_icao;
            const flightStatus = flightResult.rows[0]?.flight_status;

            if (controllerStatus?.toLowerCase() === 'depa' && currentData.altitude > 1000 && previousData) {
                const vs = this.calculateVerticalSpeed(currentData, previousData);
                if (Math.abs(vs) < 300) {
                    await pool.query(`
                        UPDATE logbook_flights SET controller_status = NULL WHERE id = $1
                    `, [activeFlight.flight_id]);
                    controllerStatus = null;
                }
            }

            await this.detectFlightState(activeFlight, currentData, previousData, controllerStatus);

            const phase = previousData
                ? this.detectHybridPhase(currentData, previousData, controllerStatus, arrivalIcao, flightStatus)
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

                if (plane.model && !activeFlight.aircraft_model) {
                    await pool.query(`
                        UPDATE logbook_flights
                        SET aircraft_model = $1, livery = $2
                        WHERE id = $3
                    `, [plane.model, plane.livery, activeFlight.flight_id]);
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

            if (await this.detectLanding(currentData, previousData, activeFlight, arrivalIcao)) {
                if (!activeFlight.landing_detected) {
                    debug(`🛬 [Flight Tracker] Landing detected: ${activeFlight.callsign}`);

                    await pool.query(`
                        UPDATE logbook_active_flights
                        SET landing_detected = true,
                            landing_time = NOW()
                        WHERE roblox_username = $1
                    `, [plane.roblox_username]);

                    const proxyUrl = this.proxies.length > 0 ? this.proxies[this.currentProxyIndex % this.proxies.length] : null;
                    await startLandingDataCollection(plane.roblox_username, proxyUrl);
                }
            }

            this.flightData.set(plane.roblox_username, currentData);

        } catch (err) {
            debug(`[Flight Tracker] Error processing plane for ${plane.roblox_username}: ${err}`, 'error');
        }
    }

    detectHybridPhase(current, previous, controllerStatus, arrivalIcao = null, flightStatus = null) {
        const alt = current.altitude;
        const speed = current.speed;

        let vs = 0;
        if (previous && previous.timestamp) {
            const altChange = current.altitude - previous.altitude;
            const timeChange = (current.timestamp - previous.timestamp) / 1000;
            if (timeChange > 0) {
                vs = Math.round((altChange / timeChange) * 60);
            }
        }

        const status = controllerStatus?.toLowerCase();

        // === PENDING FLIGHT - AWAITING CLEARANCE ===
        if (flightStatus === 'pending' && isAtGroundLevel(alt, arrivalIcao) && speed <= 12) {
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
        if (status === 'taxi' || (isAtGroundLevel(alt, arrivalIcao) && speed > 12)) {
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

        if (isAtGroundLevel(alt, arrivalIcao)) {
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

    async detectFlightState(activeFlight, currentData, previousData, controllerStatus) {
        try {
            const flightResult = await pool.query(`
                SELECT flight_status, controller_managed, arrival_icao FROM logbook_flights WHERE id = $1
            `, [activeFlight.flight_id]);

            if (!flightResult.rows[0]) return;

            const arrivalIcao = flightResult.rows[0].arrival_icao;
            const currentStatus = flightResult.rows[0].flight_status;
            const controllerManaged = flightResult.rows[0].controller_managed;

            if (controllerManaged && controllerStatus?.toLowerCase() !== 'gate') {
                return;
            }

            // === PENDING -> ACTIVE Detection ===
            if (currentStatus === 'pending') {
                if (!activeFlight.initial_position_x) {
                    await pool.query(`
                        UPDATE logbook_active_flights
                        SET initial_position_x = $1,
                            initial_position_y = $2,
                            initial_position_time = NOW()
                        WHERE roblox_username = $3
                    `, [currentData.x, currentData.y, activeFlight.roblox_username]);

                    await pool.query(`
                        UPDATE logbook_flights
                        SET departure_position_x = $1,
                            departure_position_y = $2
                        WHERE id = $3
                    `, [currentData.x, currentData.y, activeFlight.flight_id]);

                    return;
                }

                const distance = this.calculateDistance(
                    activeFlight.initial_position_x,
                    activeFlight.initial_position_y,
                    currentData.x,
                    currentData.y
                );

                const hasSpeed = currentData.speed > STATE_THRESHOLDS.MOVEMENT_SPEED;
                const hasMovedDistance = distance > STATE_THRESHOLDS.MOVEMENT_DISTANCE;
                const isAirborne = !isAtGroundLevel(currentData.altitude, arrivalIcao);

                if ((hasSpeed && hasMovedDistance) || isAirborne) {
                    await pool.query(`
                        UPDATE logbook_flights
                        SET flight_status = 'active',
                            flight_start = NOW(),
                            activated_at = NOW()
                        WHERE id = $1
                    `, [activeFlight.flight_id]);

                    await pool.query(`
                        UPDATE logbook_active_flights
                        SET movement_started = true,
                            movement_start_time = NOW()
                        WHERE roblox_username = $1
                    `, [activeFlight.roblox_username]);

                    debug(`✈️ [Flight Tracker] Flight ${activeFlight.callsign} is now ACTIVE`);
                }
            }

            // === ACTIVE -> COMPLETED Detection (after landing) ===
            else if (currentStatus === 'active' && activeFlight.landing_detected) {
                const isStationary = currentData.speed < STATE_THRESHOLDS.STATIONARY_SPEED;
                const onGround = isAtGroundLevel(currentData.altitude, arrivalIcao);

                if (isStationary && onGround) {
                    if (!activeFlight.stationary_since) {
                        await pool.query(`
                            UPDATE logbook_active_flights
                            SET stationary_since = NOW(),
                                stationary_position_x = $1,
                                stationary_position_y = $2,
                                stationary_notification_sent = false
                            WHERE roblox_username = $3
                        `, [currentData.x, currentData.y, activeFlight.roblox_username]);
                    } else {
                        const stationaryDuration = (new Date() - new Date(activeFlight.stationary_since)) / 1000;

                        if (stationaryDuration >= 30 && !activeFlight.stationary_notification_sent) {
                            const userResult = await pool.query(`
                                SELECT user_id FROM logbook_flights WHERE id = $1
                            `, [activeFlight.flight_id]);

                            if (userResult.rows[0]) {
                                await pool.query(`
                                    INSERT INTO user_notifications (user_id, type, title, message, created_at)
                                    VALUES ($1, 'info', 'Flight Ready to Complete', $2, NOW())
                                `, [
                                    userResult.rows[0].user_id,
                                    `Your flight ${activeFlight.callsign} has arrived at the gate. You can end your flight from the logbook page, or it will automatically complete if you disconnect.`
                                ]);

                                await pool.query(`
                                    UPDATE logbook_active_flights
                                    SET stationary_notification_sent = true
                                    WHERE roblox_username = $1
                                `, [activeFlight.roblox_username]);
                            }
                        }
                    }
                } else if (currentData.speed > STATE_THRESHOLDS.STATIONARY_SPEED) {
                    if (activeFlight.stationary_since) {
                        await pool.query(`
                            UPDATE logbook_active_flights
                            SET stationary_since = NULL,
                                stationary_position_x = NULL,
                                stationary_position_y = NULL,
                                stationary_notification_sent = false
                            WHERE roblox_username = $1
                        `, [activeFlight.roblox_username]);
                    }
                }
            }

        } catch (err) {
            debug(`[Flight Tracker] Error detecting flight state: ${err}`, 'error');
        }
    }

    calculateVerticalSpeed(current, previous) {
        const altChange = current.altitude - previous.altitude;
        const timeChange = (current.timestamp - previous.timestamp) / 1000;

        if (timeChange === 0) return 0;

        const feetPerSecond = altChange / timeChange;
        return Math.round(feetPerSecond * 60);
    }

    async detectLanding(current, previous, activeFlight, arrivalIcao = null) {
        if (!previous) return false;

        const isOnGround = isAtGroundLevel(current.altitude, arrivalIcao);
        const lowSpeed = current.speed < PHASE_THRESHOLDS.LANDING_SPEED;
        const wasInAir = previous.altitude > 100;

        return isOnGround && lowSpeed && wasInAir;
    }

    async handleFlightCompletion(activeFlight, robloxUsername) {
        try {
            await stopLandingDataCollection(robloxUsername);

            const telemetryResult = await pool.query(`
                SELECT * FROM logbook_telemetry
                WHERE flight_id = $1
                ORDER BY timestamp ASC
            `, [activeFlight.flight_id]);

            const telemetry = telemetryResult.rows;

            if (telemetry.length < 2) {
                await pool.query(`
                    UPDATE logbook_flights
                    SET flight_status = 'aborted'
                    WHERE id = $1
                `, [activeFlight.flight_id]);
                await removeActiveFlightTracking(robloxUsername);
                this.flightData.delete(robloxUsername);
                this.lastTelemetryTime.delete(robloxUsername);
                return;
            }

            const stats = await this.calculateFlightStats(telemetry, activeFlight);

            await finalizeFlight(activeFlight.flight_id, stats);

            const flightResult = await pool.query(`
                SELECT user_id FROM logbook_flights WHERE id = $1
            `, [activeFlight.flight_id]);

            if (flightResult.rows[0]) {
                await updateUserStatsCache(flightResult.rows[0].user_id);
            }

            await removeActiveFlightTracking(robloxUsername);
            this.flightData.delete(robloxUsername);
            this.lastTelemetryTime.delete(robloxUsername);

        } catch (err) {
            debug(`[Flight Tracker] Error completing flight: ${err}`, 'error');
        }
    }

    async calculateFlightStats(telemetry, activeFlight) {
        const firstPoint = telemetry[0];
        const lastPoint = telemetry[telemetry.length - 1];
        const durationMs = new Date(lastPoint.timestamp) - new Date(firstPoint.timestamp);
        const durationMinutes = Math.round(durationMs / 60000);

        const maxAltitude = Math.max(...telemetry.map(t => t.altitude_ft || 0));
        const maxSpeed = Math.max(...telemetry.map(t => t.speed_kts || 0));

        const airbornePoints = telemetry.filter(t => t.altitude_ft > 100);
        const averageSpeed = airbornePoints.length > 0
            ? Math.round(airbornePoints.reduce((sum, t) => sum + (t.speed_kts || 0), 0) / airbornePoints.length)
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

    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    calculateSmoothnessScore(telemetry) {
        let score = 100;

        for (let i = 1; i < telemetry.length; i++) {
            const speedDelta = Math.abs((telemetry[i].speed_kts || 0) - (telemetry[i - 1].speed_kts || 0));
            const altDelta = Math.abs((telemetry[i].altitude_ft || 0) - (telemetry[i - 1].altitude_ft || 0));

            if (speedDelta > 20) score -= 2;

            if (altDelta > 500) score -= 3;
        }

        return Math.max(0, Math.min(100, score));
    }

    calculateLandingScore(landingRate) {
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
            const activeFlights = await pool.query(`
                SELECT laf.*, lf.callsign, lf.user_id, lf.flight_status
                FROM logbook_active_flights laf
                JOIN logbook_flights lf ON laf.flight_id = lf.id
                WHERE lf.flight_status IN ('pending', 'active')
            `);

            const now = Date.now();

            for (const flight of activeFlights.rows) {
                const lastTelemetry = this.lastTelemetryTime.get(flight.roblox_username);

                if (lastTelemetry && (now - lastTelemetry) > this.flightNotFoundTimeout) {

                    if (flight.landing_detected) {
                        if (flight.stationary_position_x && flight.stationary_position_y) {
                            await pool.query(`
                                UPDATE logbook_flights
                                SET arrival_position_x = $1,
                                    arrival_position_y = $2
                                WHERE id = $3
                            `, [flight.stationary_position_x, flight.stationary_position_y, flight.flight_id]);
                        }

                        await this.handleFlightCompletion(flight, flight.roblox_username);
                    } else {
                        await removeActiveFlightTracking(flight.roblox_username);

                        await pool.query(`DELETE FROM logbook_flights WHERE id = $1`, [flight.flight_id]);

                        await pool.query(`
                            INSERT INTO user_notifications (user_id, type, title, message, created_at)
                            VALUES ($1, 'error', 'Flight Not Found', $2, NOW())
                        `, [
                            flight.user_id,
                            `We couldn't find your flight in the public ATC server. Make sure you're connected to the PFATC server. Your flight log entry for "${flight.callsign}" has been deleted.`
                        ]);
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