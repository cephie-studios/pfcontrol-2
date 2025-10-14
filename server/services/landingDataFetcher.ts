import WebSocket from 'ws';
import protobuf from 'protobufjs';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { storeWaypoint, finalizeLandingFromWaypoints } from '../db/logbook.js';

const activeConnections = new Map(); // roblox_username -> { socket, timeout }

function createProtobufSchema() {
    const root = new protobuf.Root();
    const data = root.define("data");

    data.add(new protobuf.Type("Timestamp")
        .add(new protobuf.Field("timestamp", 1, "uint64"))
    );

    data.add(new protobuf.Type("Waypoint")
        .add(new protobuf.Field("x", 1, "double"))
        .add(new protobuf.Field("y", 2, "double"))
        .add(new protobuf.Field("airport_code", 3, "string"))
        .add(new protobuf.Field("runway", 4, "string"))
        .add(new protobuf.Field("distance_or_bearing", 5, "double"))  // Landing speed/rate
        .add(new protobuf.Field("time", 6, "Timestamp"))
    );

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
        .add(new protobuf.Field("waypoints", 2, "Waypoint", "repeated"))
    );

    return root.lookupType("data.planes");
}

export async function startLandingDataCollection(robloxUsername: string, proxyUrl: string | null = null) {
    if (activeConnections.has(robloxUsername)) {
        return;
    }

    const planesType = createProtobufSchema();

    const wsOptions: WebSocket.ClientOptions = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://project-flight.com'
        }
    };

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
            let buffer: Uint8Array;
            if (Array.isArray(data)) {
                buffer = new Uint8Array(Buffer.concat(data));
            } else if (data instanceof Buffer) {
                buffer = new Uint8Array(data);
            } else if (data instanceof ArrayBuffer) {
                buffer = new Uint8Array(data);
            } else {
                throw new Error("Unsupported WebSocket message data type");
            }
            const decoded = planesType.decode(buffer);
            const object = planesType.toObject(decoded, { defaults: true, longs: String });

            if (object.waypoints && object.waypoints.length > 0) {
                for (const waypoint of object.waypoints) {
                    await storeWaypoint(robloxUsername, {
                        airport: waypoint.airport_code,
                        runway: waypoint.runway,
                        position_x: waypoint.x,
                        position_y: waypoint.y,
                        landing_speed: waypoint.distance_or_bearing,
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

    const timeout = setTimeout(async () => {
        await stopLandingDataCollection(robloxUsername);
    }, 60000);

    activeConnections.set(robloxUsername, { socket, timeout });
}

export async function stopLandingDataCollection(robloxUsername: string) {
    const connection = activeConnections.get(robloxUsername);
    if (!connection) {
        return null;
    }

    clearTimeout(connection.timeout);
    if (connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.close();
    }
    activeConnections.delete(robloxUsername);

    const selectedWaypoint = await finalizeLandingFromWaypoints(robloxUsername);

    if (selectedWaypoint) {
        console.log(`✅ [Landing] ${robloxUsername}: ${selectedWaypoint.runway} @ ${selectedWaypoint.landing_speed} fpm`);
    }

    return selectedWaypoint;
}

export function closeAllConnections() {
    for (const [username, connection] of activeConnections) {
        clearTimeout(connection.timeout);
        if (connection.socket.readyState === WebSocket.OPEN) {
            connection.socket.close();
        }
    }
    activeConnections.clear();
}
