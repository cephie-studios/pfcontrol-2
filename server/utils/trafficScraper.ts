import WebSocket from 'ws';
import protobuf from 'protobufjs';
import { HttpsProxyAgent } from 'https-proxy-agent';
import dotenv from 'dotenv';
import type { Agent } from 'http';

dotenv.config();

const root = new protobuf.Root();
const data = root.define('data');

data.add(
  new protobuf.Type('Timestamp').add(
    new protobuf.Field('timestamp', 1, 'uint64')
  )
);

data.add(
  new protobuf.Type('Waypoint')
    .add(new protobuf.Field('x', 1, 'double'))
    .add(new protobuf.Field('y', 2, 'double'))
    .add(new protobuf.Field('airport_code', 3, 'string'))
    .add(new protobuf.Field('runway', 4, 'string'))
    .add(new protobuf.Field('distance_or_bearing', 5, 'double'))
    .add(new protobuf.Field('time', 6, 'Timestamp'))
);

data.add(
  new protobuf.Type('Plane')
    .add(new protobuf.Field('server_id', 1, 'string'))
    .add(new protobuf.Field('callsign', 2, 'string'))
    .add(new protobuf.Field('roblox_username', 3, 'string'))
    .add(new protobuf.Field('x', 4, 'double'))
    .add(new protobuf.Field('y', 5, 'double'))
    .add(new protobuf.Field('heading', 6, 'double'))
    .add(new protobuf.Field('altitude', 7, 'double'))
    .add(new protobuf.Field('speed', 8, 'double'))
    .add(new protobuf.Field('model', 9, 'string'))
    .add(new protobuf.Field('livery', 10, 'string'))
);

data.add(
  new protobuf.Type('planes')
    .add(new protobuf.Field('planes', 1, 'Plane', 'repeated'))
    .add(new protobuf.Field('waypoints', 2, 'Waypoint', 'repeated'))
);

const planesType = root.lookupType('data.planes');

interface PlaneData {
  callsign: string;
  robloxUsername: string;
  model: string;
}

class TrafficScraper {
  private static instance: TrafficScraper;
  private ws: WebSocket | null = null;
  private traffic: Map<string, PlaneData> = new Map();
  private reconnectInterval: NodeJS.Timeout | null = null;
  private currentProxyIndex: number = 0;

  private constructor() {
    this.connect();
  }

  public static getInstance(): TrafficScraper {
    if (!TrafficScraper.instance) {
      TrafficScraper.instance = new TrafficScraper();
    }
    return TrafficScraper.instance;
  }

  private getProxyList(): string[] {
    const envProxies = process.env.PFATC_PROXIES;
    if (envProxies) {
      return envProxies.split(',').map((p) => p.trim()).filter(Boolean);
    }
    const singleProxy = process.env.PFATC_PROXY_URL;
    return singleProxy ? [singleProxy] : [];
  }

  private connect() {
    const proxies = this.getProxyList();
    const proxyUrl = proxies[this.currentProxyIndex % proxies.length];
    const SERVER_ID = process.env.PFATC_SERVER_ID || '2ykygVZiX5';
    const WS_URL = `wss://v3api.project-flight.com/v3/traffic/server/ws/${SERVER_ID}`;

    const wsOptions: WebSocket.ClientOptions = {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Origin: 'https://scope.project-flight.com',
      },
    };

    if (proxyUrl) {
      wsOptions.agent = new HttpsProxyAgent(proxyUrl) as unknown as Agent;
    }

    this.ws = new WebSocket(WS_URL, wsOptions);

    this.ws.on('open', () => {
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }
    });

    this.ws.on('message', async (messageData: WebSocket.Data) => {
      try {
        let buffer: Uint8Array;
        if (messageData instanceof Buffer) {
          buffer = new Uint8Array(messageData);
        } else if (Array.isArray(messageData)) {
          buffer = new Uint8Array(Buffer.concat(messageData));
        } else if (messageData instanceof ArrayBuffer) {
          buffer = new Uint8Array(messageData);
        } else {
          buffer = new TextEncoder().encode(messageData.toString());
        }

        const decoded = planesType.decode(buffer);
        const object = planesType.toObject(decoded, {
          defaults: true,
          longs: String,
          enums: String,
          bytes: String,
        }) as { planes?: Array<{ roblox_username?: string; callsign?: string; model?: string }> };

        if (object.planes && Array.isArray(object.planes)) {
          object.planes.forEach((plane) => {
            if (plane.roblox_username) {
              this.traffic.set(plane.roblox_username.toLowerCase(), {
                callsign: plane.callsign || '',
                robloxUsername: plane.roblox_username,
                model: plane.model || '',
              });
            }
          });
        }
      } catch (err) {
        console.error('[TrafficScraper] Failed to decode protobuf message:', err);
      }
    });

    this.ws.on('close', () => {
      this.currentProxyIndex++;
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error(`[TrafficScraper] WebSocket error with proxy index ${this.currentProxyIndex % proxies.length}:`, err.message);
      this.ws?.terminate();
    });
  }

  private scheduleReconnect() {
    if (!this.reconnectInterval) {
      this.reconnectInterval = setInterval(() => this.connect(), 10000);
    }
  }

  public getCallsignForUser(robloxUsername: string): PlaneData | null {
    return this.traffic.get(robloxUsername.toLowerCase()) || null;
  }
}

export const trafficScraper = TrafficScraper.getInstance();
