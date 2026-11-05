import { redisConnection } from '../db/connection.js';
import {
  getActiveSupporters,
  getNextGrantChange,
  getWallAdmins,
  type WallAdmin,
  type WallSupporter,
} from '../db/billing.js';
import { getAdminIds } from '../middleware/admin.js';
import { prefixKey } from '../utils/cacheTtl.js';

export interface SupporterWall {
  count: number;
  wall: WallSupporter[];
  admins: WallAdmin[];
}

const WALL_LIMIT = 60;
const MAX_TTL_SEC = 10 * 60;
const DEBOUNCE_MS = 30_000;
const MAX_WAIT_MS = 2 * 60_000;

const cacheKey = () => prefixKey('billing:supporter-wall');

async function loadWall(): Promise<SupporterWall> {
  const [active, admins] = await Promise.all([
    getActiveSupporters(WALL_LIMIT),
    getWallAdmins(getAdminIds()),
  ]);
  return { ...active, admins };
}

export async function getSupporterWall(): Promise<SupporterWall> {
  try {
    const cached = await redisConnection.get(cacheKey());
    if (cached) return JSON.parse(cached) as SupporterWall;
  } catch {
    // Redis down: fall through to the database.
  }

  const [wall, nextChange] = await Promise.all([
    loadWall(),
    getNextGrantChange(),
  ]);
  const untilChange = nextChange
    ? Math.ceil((+nextChange - Date.now()) / 1000)
    : MAX_TTL_SEC;
  const ttl = Math.max(1, Math.min(MAX_TTL_SEC, untilChange));
  try {
    await redisConnection.set(cacheKey(), JSON.stringify(wall), 'EX', ttl);
  } catch {
    // Caching is best effort.
  }
  return wall;
}

let timer: NodeJS.Timeout | null = null;
let firstScheduledAt = 0;

export async function invalidateSupporterWall(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  try {
    await redisConnection.del(cacheKey());
  } catch {
    // The entry expires on its own within MAX_TTL_SEC.
  }
}

export function scheduleSupporterWallInvalidation(): void {
  const now = Date.now();
  if (timer) clearTimeout(timer);
  else firstScheduledAt = now;
  const delay = Math.min(DEBOUNCE_MS, firstScheduledAt + MAX_WAIT_MS - now);
  timer = setTimeout(() => void invalidateSupporterWall(), Math.max(0, delay));
  timer.unref();
}
