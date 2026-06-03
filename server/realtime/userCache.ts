import { mainDb } from "../db/connection.js";
import { redisConnection } from "../db/connection.js";
import { getUserRoles } from "../db/roles.js";
import { keys, TTL } from "./keys.js";

function hasPermission(
  roles: Awaited<ReturnType<typeof getUserRoles>>,
  permKey: string
): boolean {
  return roles.some((role) => {
    let perms = role.permissions;
    if (typeof perms === "string") {
      try {
        perms = JSON.parse(perms);
      } catch {
        return false;
      }
    }
    return (
      perms &&
      typeof perms === "object" &&
      (perms as Record<string, boolean>)[permKey] === true
    );
  });
}
import { perfAsync } from "./perf.js";

export type UserBadgeDto = {
  username: string | null;
  avatar: string | null;
  hasVatsimRating: boolean;
  isPFATCSectorController: boolean;
  isAATCSectorController: boolean;
  isEventController: boolean;
};

async function loadBadge(userId: string): Promise<UserBadgeDto> {
  const user = await mainDb
    .selectFrom("users")
    .select(["username", "avatar", "vatsim_rating_id"])
    .where("id", "=", userId)
    .executeTakeFirst();

  let isPFATCSector = false;
  let isAATCSector = false;
  try {
    const roles = await getUserRoles(userId);
    isPFATCSector = hasPermission(roles, "pfatc_sector");
    isAATCSector = hasPermission(roles, "aatc_sector");
  } catch {
    // ignore
  }

  const avatar = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png`
    : null;

  return {
    username: user?.username ?? null,
    avatar,
    hasVatsimRating: Boolean(
      user?.vatsim_rating_id && user.vatsim_rating_id > 1
    ),
    isPFATCSectorController: isPFATCSector,
    isAATCSectorController: isAATCSector,
    isEventController: isPFATCSector || isAATCSector,
  };
}

export async function getUserBadge(userId: string): Promise<UserBadgeDto> {
  const cacheKey = keys.userBadge(userId);
  try {
    const cached = await redisConnection.get(cacheKey);
    if (cached) return JSON.parse(cached) as UserBadgeDto;
  } catch {
    // ignore
  }

  const badge = await loadBadge(userId);
  try {
    await redisConnection.setex(
      cacheKey,
      TTL.USER_BADGE_SEC,
      JSON.stringify(badge)
    );
  } catch {
    // ignore
  }
  return badge;
}

export async function getUserBadgesByIds(
  userIds: string[]
): Promise<Map<string, UserBadgeDto>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const result = new Map<string, UserBadgeDto>();
  if (unique.length === 0) return result;

  return perfAsync(
    "getUserBadgesByIds",
    async () => {
      const cacheKeys = unique.map((id) => keys.userBadge(id));
      let cachedValues: (string | null)[] = [];
      try {
        cachedValues = await redisConnection.mget(...cacheKeys);
      } catch {
        cachedValues = [];
      }

      const misses: string[] = [];
      unique.forEach((id, i) => {
        const raw = cachedValues[i];
        if (raw) {
          try {
            result.set(id, JSON.parse(raw) as UserBadgeDto);
          } catch {
            misses.push(id);
          }
        } else {
          misses.push(id);
        }
      });

      if (misses.length > 0) {
        await Promise.all(
          misses.map(async (id) => {
            const badge = await loadBadge(id);
            result.set(id, badge);
            try {
              await redisConnection.setex(
                keys.userBadge(id),
                TTL.USER_BADGE_SEC,
                JSON.stringify(badge)
              );
            } catch {
              // ignore
            }
          })
        );
      }

      return result;
    },
    { count: unique.length }
  );
}

export async function invalidateUserBadge(userId: string): Promise<void> {
  try {
    await redisConnection.del(keys.userBadge(userId));
  } catch {
    // ignore
  }
}
