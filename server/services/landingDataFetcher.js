import WebSocket from 'ws';
import protobuf from 'protobufjs';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { storeWaypoint, finalizeLandingFromWaypoints } from '../db/logbook.js';

// Active username WebSocket connections
const activeConnections = new Map(); // roblox_username -> { socket, timeout }

// Setup protobuf schema for waypoint data
function createProtobufSchema() {
    const root = new protobuf.Root();
    const data = root.define("data");

    // Timestamp message
    data.add(new protobuf.Type("Timestamp")
        .add(new protobuf.Field("timestamp", 1, "uint64"))
    );

    // Waypoint message
    data.add(new protobuf.Type("Waypoint")
        .add(new protobuf.Field("x", 1, "double"))
        .add(new protobuf.Field("y", 2, "double"))
        .add(new protobuf.Field("airport_code", 3, "string"))
        .add(new protobuf.Field("runway", 4, "string"))
        .add(new protobuf.Field("distance_or_bearing", 5, "double"))  // This is the landing speed/rate
        .add(new protobuf.Field("time", 6, "Timestamp"))
    );

    // Plane message
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

    // Planes message - waypoints are at the TOP LEVEL, not nested in each plane!
    data.add(new protobuf.Type("planes")
        .add(new protobuf.Field("planes", 1, "Plane", "repeated"))
        .add(new protobuf.Field("waypoints", 2, "Waypoint", "repeated"))
    );

    return root.lookupType("data.planes");
}

/**
 * Start collecting landing waypoint data for a user
 * @param {string} robloxUsername - Roblox username to track
 * @param {string} proxyUrl - Optional proxy URL
 */
export async function startLandingDataCollection(robloxUsername, proxyUrl = null) {
    // Check if already collecting
    if (activeConnections.has(robloxUsername)) {
        return;
    }

    const planesType = createProtobufSchema();

    const wsOptions = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://project-flight.com'
        }
    };

    // Use proxy if provided
    if (proxyUrl) {
        wsOptions.agent = new HttpsProxyAgent(proxyUrl);
    }

    const socket = new WebSocket(
        `wss://api.project-flight.com/v2/traffic/ws/${robloxUsername}`,
        wsOptions
    );

    socket.on('open', () => {
        // Connected
    });

    socket.on('message', async (data) => {
        try {
            const buffer = data instanceof Buffer ? new Uint8Array(data) : new Uint8Array(await data.arrayBuffer());
            const decoded = planesType.decode(buffer);
            const object = planesType.toObject(decoded, { defaults: true, longs: String });

            // Waypoints are at the top level of the message, not nested in planes
            if (object.waypoints && object.waypoints.length > 0) {
                // Store each waypoint
                for (const waypoint of object.waypoints) {
                    await storeWaypoint(robloxUsername, {
                        airport: waypoint.airport_code,
                        runway: waypoint.runway,
                        position_x: waypoint.x,
                        position_y: waypoint.y,
                        landing_speed: waypoint.distance_or_bearing,  // This is the landing rate in fpm
                        timestamp: waypoint.time?.timestamp || Date.now() / 1000
                    });
                }
            }
        } catch (err) {
            console.error(`[Landing Data] Failed to decode message for ${robloxUsername}:`, err);
        }
    });

    socket.on('close', () => {
        activeConnections.delete(robloxUsername);
    });

    socket.on('error', (err) => {
        console.error(`[Landing Data] WebSocket error for ${robloxUsername}:`, err.message);
    });

    // Set timeout to close connection after 60 seconds
    const timeout = setTimeout(async () => {
        await stopLandingDataCollection(robloxUsername);
    }, 60000);

    // Store active connection
    activeConnections.set(robloxUsername, { socket, timeout });
}

/**
 * Stop collecting landing waypoint data and finalize
 * @param {string} robloxUsername - Roblox username
 * @returns {Promise<Object|null>} Selected waypoint data or null
 */
export async function stopLandingDataCollection(robloxUsername) {
    const connection = activeConnections.get(robloxUsername);
    if (!connection) {
        return null;
    }

    // Clear timeout and close socket
    clearTimeout(connection.timeout);
    if (connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.close();
    }
    activeConnections.delete(robloxUsername);

    // Finalize and select best waypoint
    const selectedWaypoint = await finalizeLandingFromWaypoints(robloxUsername);

    if (selectedWaypoint) {
        console.log(`✅ [Landing] ${robloxUsername}: ${selectedWaypoint.runway} @ ${selectedWaypoint.landing_speed} fpm`);
    }

    return selectedWaypoint;
}

/**
 * Clean up - close all active connections
 */
export function closeAllConnections() {
    for (const [username, connection] of activeConnections) {
        clearTimeout(connection.timeout);
        if (connection.socket.readyState === WebSocket.OPEN) {
            connection.socket.close();
        }
    }
    activeConnections.clear();
}
