import axios from 'axios';
import { getUserById, updateVatsimAccount } from '../db/users.js';
import { redisConnection } from '../db/connection.js';
import { invalidateUserBadge } from '../realtime/userCache.js';

export const VATSIM_RATINGS: Record<number, { short: string; long: string }> = {
  [-1]: { short: 'INA', long: 'Inactive' },
  0: { short: 'SUS', long: 'Suspended' },
  1: { short: 'OBS', long: 'Observer' },
  2: { short: 'S1', long: 'Tower Trainee' },
  3: { short: 'S2', long: 'Tower Controller' },
  4: { short: 'S3', long: 'Senior Student' },
  5: { short: 'C1', long: 'Enroute Controller' },
  6: { short: 'C2', long: 'Controller 2' },
  7: { short: 'C3', long: 'Senior Controller' },
  8: { short: 'I1', long: 'Instructor' },
  9: { short: 'I2', long: 'Instructor 2' },
  10: { short: 'I3', long: 'Senior Instructor' },
  11: { short: 'SUP', long: 'Supervisor' },
  12: { short: 'ADM', long: 'Administrator' },
};

const AUTO_REFRESH_INTERVAL_SEC = 6 * 60 * 60;
const MANUAL_REFRESH_COOLDOWN_SEC = 30;

export type VatsimRefreshResult =
  | {
      ok: true;
      changed: boolean;
      cid: string;
      ratingId: number;
      ratingShort: string | null;
      ratingLong: string | null;
    }
  | { ok: false; reason: 'not_linked' | 'cooldown' | 'lookup_failed' };

export async function refreshVatsimRating(
  userId: string
): Promise<VatsimRefreshResult> {
  const user = await getUserById(userId);
  const cid = user?.vatsim_cid;
  if (!cid) return { ok: false, reason: 'not_linked' };

  let ratingId: number;
  try {
    const { data } = await axios.get(
      `https://api.vatsim.net/v2/members/${encodeURIComponent(cid)}`,
      { timeout: 5000 }
    );
    ratingId = Number(data?.rating);
    if (!Number.isInteger(ratingId)) {
      return { ok: false, reason: 'lookup_failed' };
    }
  } catch {
    return { ok: false, reason: 'lookup_failed' };
  }

  const known = VATSIM_RATINGS[ratingId];
  const ratingShort = known?.short ?? null;
  const ratingLong = known?.long ?? null;
  const changed =
    user.vatsim_rating_id !== ratingId ||
    user.vatsim_rating_short !== ratingShort ||
    user.vatsim_rating_long !== ratingLong;

  if (changed) {
    await updateVatsimAccount(userId, {
      vatsimCid: cid,
      ratingId,
      ratingShort: ratingShort ?? undefined,
      ratingLong: ratingLong ?? undefined,
    });
    await invalidateUserBadge(userId);
  }

  return { ok: true, changed, cid, ratingId, ratingShort, ratingLong };
}

export async function refreshVatsimRatingManually(
  userId: string
): Promise<VatsimRefreshResult> {
  const acquired = await redisConnection
    .set(
      `vatsim:refresh:manual:${userId}`,
      '1',
      'EX',
      MANUAL_REFRESH_COOLDOWN_SEC,
      'NX'
    )
    .catch(() => 'OK');
  if (!acquired) return { ok: false, reason: 'cooldown' };
  const result = await refreshVatsimRating(userId);
  if (result.ok) {
    await redisConnection
      .setex(`vatsim:refresh:auto:${userId}`, AUTO_REFRESH_INTERVAL_SEC, '1')
      .catch(() => {});
  }
  return result;
}

export async function refreshVatsimRatingIfStale(userId: string) {
  const acquired = await redisConnection
    .set(
      `vatsim:refresh:auto:${userId}`,
      '1',
      'EX',
      AUTO_REFRESH_INTERVAL_SEC,
      'NX'
    )
    .catch(() => null);
  if (!acquired) return;
  await refreshVatsimRating(userId).catch((err) =>
    console.error('VATSIM auto refresh failed:', err)
  );
}
