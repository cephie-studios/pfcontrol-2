import express from "express";
import { isAdmin } from "../../middleware/admin.js";
import { mainDb } from "../../db/connection.js";
import { getUserById } from "../../db/users.js";

const router = express.Router();

// Super-admin only gate
router.use((req, res, next) => {
  if (!req.user?.userId || !isAdmin(req.user.userId)) {
    return res.status(403).json({ error: "Super admin access required" });
  }
  next();
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface BanRecord {
  active: boolean;
  reason: string | null;
  expires_at: string | null;
  banned_at: string | null;
}

interface ClusterMember {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string | null;
  created_at: string;
  discord_created_at: string;
  discord_account_age_days: number;
  last_login: string | null;
  is_vpn: boolean;
  fingerprint_id: string | null;
  ip_hash: string | null;
  ban: BanRecord | null;
}

interface ClusterSignals {
  shared_fingerprint: boolean;
  shared_ip: boolean;
  has_banned_member: boolean;
  young_account_joined_after_ban: boolean;
  vpn_overlap: boolean;
}

interface AltCluster {
  id: string;
  members: ClusterMember[];
  member_count: number;
  signals: ClusterSignals;
  score: number;
  score_label: "low" | "medium" | "high" | "critical";
  detected_at: string;
}

interface AltClustersResponse {
  clusters: AltCluster[];
  stats: {
    total_clusters: number;
    total_flagged_accounts: number;
    scan_duration_ms: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function discordCreatedAt(userId: string): Date {
  const ms = Number(BigInt(userId) >> 22n) + 1420070400000;
  return new Date(ms);
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor(
    Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function scoreLabel(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 0.8) return "critical";
  if (score >= 0.6) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

function computeScore(signals: ClusterSignals, memberCount: number): number {
  let base = 0;
  if (signals.shared_fingerprint && signals.shared_ip) base = 0.8;
  else if (signals.shared_fingerprint) base = 0.55;
  else base = 0.5; // shared IP alone is a strong signal — raised from 0.35

  if (signals.has_banned_member) base += 0.15;
  if (signals.young_account_joined_after_ban) base += 0.1;

  // More accounts sharing a signal = higher confidence
  if (memberCount >= 5) base += 0.1;
  else if (memberCount >= 3) base += 0.05;

  if (signals.vpn_overlap) {
    base -= 0.15;
    if (!signals.shared_fingerprint) base = Math.min(base, 0.35);
  }

  return Math.min(0.99, Math.max(0, base));
}

// ─── Union-Find ───────────────────────────────────────────────────────────────

class UnionFind {
  private parent = new Map<string, string>();
  private fpEdges = new Set<string>(); // root IDs of components with fp signal
  private ipEdges = new Set<string>(); // root IDs of components with ip signal

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p !== x) {
      const root = this.find(p);
      this.parent.set(x, root);
      return root;
    }
    return x;
  }

  union(a: string, b: string, signal: "fingerprint" | "ip") {
    const ra = this.find(a);
    const rb = this.find(b);
    const root = ra <= rb ? ra : rb;
    this.parent.set(ra, root);
    this.parent.set(rb, root);
    if (signal === "fingerprint") this.fpEdges.add(this.find(a));
    else this.ipEdges.add(this.find(a));
  }

  components(): Map<
    string,
    { members: string[]; hasFp: boolean; hasIp: boolean }
  > {
    const map = new Map<
      string,
      { members: string[]; hasFp: boolean; hasIp: boolean }
    >();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      if (!map.has(root))
        map.set(root, { members: [], hasFp: false, hasIp: false });
      map.get(root)!.members.push(id);
    }
    // propagate signals to final roots
    for (const [id] of this.parent) {
      const root = this.find(id);
      const comp = map.get(root)!;
      if (this.fpEdges.has(id) || this.fpEdges.has(root)) comp.hasFp = true;
      if (this.ipEdges.has(id) || this.ipEdges.has(root)) comp.hasIp = true;
    }
    return map;
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const startTime = Date.now();
  const minScoreRaw =
    typeof req.query.minScore === "string" ? parseFloat(req.query.minScore) : 0;
  if (Number.isNaN(minScoreRaw)) {
    return res.status(400).json({ error: "Invalid minScore parameter" });
  }
  const minScore = minScoreRaw;

  try {
    // 1. Fingerprint groups via SQL
    const fpRows = await mainDb
      .selectFrom("users")
      .select(["id", "fingerprint_id"])
      .where("fingerprint_id", "is not", null)
      .execute();

    const fpGroups = new Map<string, string[]>();
    for (const row of fpRows) {
      const fp = row.fingerprint_id!;
      if (!fpGroups.has(fp)) fpGroups.set(fp, []);
      fpGroups.get(fp)!.push(row.id);
    }

    // 2. IP hash groups via SQL
    const ipRows = await mainDb
      .selectFrom("users")
      .select(["id", "ip_hash"])
      .where("ip_hash", "is not", null)
      .execute();

    const ipGroups = new Map<string, string[]>();
    for (const row of ipRows) {
      const h = row.ip_hash!;
      if (!ipGroups.has(h)) ipGroups.set(h, []);
      ipGroups.get(h)!.push(row.id);
    }

    // 3. Union-Find merge
    const uf = new UnionFind();

    for (const members of fpGroups.values()) {
      if (members.length < 2) continue;
      for (let i = 1; i < members.length; i++) {
        uf.union(members[0], members[i], "fingerprint");
      }
    }

    for (const members of ipGroups.values()) {
      if (members.length < 2) continue;
      for (let i = 1; i < members.length; i++) {
        uf.union(members[0], members[i], "ip");
      }
    }

    // 4. Collect components with >= 2 members
    const components = uf.components();
    const multiComponents = [...components.values()].filter(
      (c) => c.members.length >= 2
    );

    // 5. Gather all unique member IDs across all clusters
    const allMemberIds = new Set<string>();
    for (const comp of multiComponents) {
      for (const id of comp.members) allMemberIds.add(id);
    }

    if (allMemberIds.size === 0) {
      const response: AltClustersResponse = {
        clusters: [],
        stats: {
          total_clusters: 0,
          total_flagged_accounts: 0,
          scan_duration_ms: Date.now() - startTime,
        },
      };
      return res.json(response);
    }

    // 6. Fetch user details (Redis-cached) and active bans in parallel
    const memberIdArray = [...allMemberIds];

    const [userResults, banResults] = await Promise.all([
      Promise.all(memberIdArray.map((id) => getUserById(id))),
      mainDb
        .selectFrom("bans")
        .select(["user_id", "reason", "expires_at", "banned_at", "active"])
        .where("user_id", "in", memberIdArray)
        .where("active", "=", true)
        .where((eb) =>
          eb.or([
            eb("expires_at", "is", null),
            eb("expires_at", ">", new Date()),
          ])
        )
        .execute(),
    ]);

    const userMap = new Map<
      string,
      ReturnType<typeof getUserById> extends Promise<infer T> ? T : never
    >();
    for (let i = 0; i < memberIdArray.length; i++) {
      const u = userResults[i];
      if (u) userMap.set(memberIdArray[i], u);
    }

    const banMap = new Map<string, BanRecord>();
    for (const ban of banResults) {
      if (ban.user_id) {
        banMap.set(ban.user_id, {
          active: ban.active ?? true,
          reason: ban.reason ?? null,
          expires_at: ban.expires_at
            ? new Date(ban.expires_at as unknown as string).toISOString()
            : null,
          banned_at: ban.banned_at
            ? new Date(ban.banned_at as unknown as string).toISOString()
            : null,
        });
      }
    }

    // 7. Build clusters
    const clusters: AltCluster[] = [];
    const detectedAt = new Date().toISOString();

    for (const comp of multiComponents) {
      const members: ClusterMember[] = [];

      for (const id of comp.members) {
        const u = userMap.get(id);
        if (!u) continue;

        const discordCreated = discordCreatedAt(id);
        const platformJoined = u.created_at
          ? new Date(u.created_at as unknown as string)
          : null;
        const discordAgeDays = platformJoined
          ? daysBetween(discordCreated, platformJoined)
          : 0;

        members.push({
          id,
          username: u.username,
          avatar: u.avatar ?? null,
          discriminator: u.discriminator ?? null,
          created_at: platformJoined ? platformJoined.toISOString() : "",
          discord_created_at: discordCreated.toISOString(),
          discord_account_age_days: discordAgeDays,
          last_login: u.last_login
            ? new Date(u.last_login as unknown as string).toISOString()
            : null,
          is_vpn: u.is_vpn ?? false,
          fingerprint_id: u.fingerprint_id ?? null,
          ip_hash: u.ip_hash ?? null,
          ban: banMap.get(id) ?? null,
        });
      }

      if (members.length < 2) continue;

      const hasBannedMember = members.some((m) => m.ban !== null);
      const earliestBanDate = hasBannedMember
        ? members
            .filter((m) => m.ban?.banned_at)
            .map((m) => new Date(m.ban!.banned_at!).getTime())
            .reduce((min, t) => Math.min(min, t), Infinity)
        : Infinity;

      const youngAccountJoinedAfterBan =
        hasBannedMember &&
        members.some((m) => {
          if (m.ban) return false; // skip already-banned members
          if (!m.created_at) return false; // skip members without join date
          const joinedMs = new Date(m.created_at).getTime();
          const discordMs = new Date(m.discord_created_at).getTime();
          const discordAgeDaysAtJoin =
            (joinedMs - discordMs) / (1000 * 60 * 60 * 24);
          return joinedMs > earliestBanDate && discordAgeDaysAtJoin <= 90;
        });

      const allVpn = members.every((m) => m.is_vpn);

      const signals: ClusterSignals = {
        shared_fingerprint: comp.hasFp,
        shared_ip: comp.hasIp,
        has_banned_member: hasBannedMember,
        young_account_joined_after_ban: youngAccountJoinedAfterBan,
        vpn_overlap: allVpn,
      };

      const score = computeScore(signals, members.length);
      if (score < minScore) continue;

      // Sort members: banned first, then by platform join date
      members.sort((a, b) => {
        if (a.ban && !b.ban) return -1;
        if (!a.ban && b.ban) return 1;
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });

      const clusterId = [...comp.members].sort().join(":");

      clusters.push({
        id: clusterId,
        members,
        member_count: members.length,
        signals,
        score,
        score_label: scoreLabel(score),
        detected_at: detectedAt,
      });
    }

    // Sort by score desc, then member count desc
    clusters.sort(
      (a, b) => b.score - a.score || b.member_count - a.member_count
    );

    const flaggedIds = new Set(
      clusters.flatMap((c) => c.members.map((m) => m.id))
    );

    const response: AltClustersResponse = {
      clusters,
      stats: {
        total_clusters: clusters.length,
        total_flagged_accounts: flaggedIds.size,
        scan_duration_ms: Date.now() - startTime,
      },
    };

    res.json(response);
  } catch (err) {
    console.error("[alts] Error building alt clusters:", err);
    res.status(500).json({ error: "Failed to build alt clusters" });
  }
});

export default router;
