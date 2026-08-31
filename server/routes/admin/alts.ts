import express from 'express';
import { sql } from 'kysely';
import { isAdmin } from '../../middleware/admin.js';
import { mainDb } from '../../db/connection.js';
import { getUserById } from '../../db/users.js';

const COMMON_SIGNAL_THRESHOLD = 5;

const router = express.Router();

// Super-admin only gate
router.use((req, res, next) => {
  if (!req.user?.userId || !isAdmin(req.user.userId)) {
    return res.status(403).json({ error: 'Super admin access required' });
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

interface IpHistoryEntry {
  hash: string;
  is_vpn: boolean;
  first_seen: string;
  last_seen: string;
  seen_count: number;
}

interface FingerprintHistoryEntry {
  fingerprint_id: string;
  first_seen: string;
  last_seen: string;
  seen_count: number;
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
  ip_history: IpHistoryEntry[];
  fingerprint_history: FingerprintHistoryEntry[];
  common_ip_count: number;
  common_fingerprint_count: number;
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
  score_label: 'low' | 'medium' | 'high' | 'critical';
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

function scoreLabel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

const FINGERPRINT_WEIGHT = 1.0;
const IP_WEIGHT = 0.7;
const VPN_IP_DISCOUNT = 0.25;
const PERSISTENCE_FACTOR = 0.15;
const SIZE_WEIGHT = 0.25;
const BAN_BONUS = 0.5;
const EVASION_BONUS = 0.35;

interface SignalContribution {
  otherCount: number;
  seenTotal: number;
  allVpn: boolean;
}

function clusterSignalContributions(
  members: ClusterMember[],
  groups: Map<string, Set<string>>,
  extractEntries: (
    m: ClusterMember
  ) => { hash: string; seen_count: number; is_vpn?: boolean }[]
): SignalContribution[] {
  const perHash = new Map<
    string,
    {
      memberIds: Set<string>;
      seenTotal: number;
      entryCount: number;
      vpnCount: number;
    }
  >();

  for (const m of members) {
    for (const entry of extractEntries(m)) {
      if (!perHash.has(entry.hash)) {
        perHash.set(entry.hash, {
          memberIds: new Set(),
          seenTotal: 0,
          entryCount: 0,
          vpnCount: 0,
        });
      }
      const stat = perHash.get(entry.hash)!;
      stat.memberIds.add(m.id);
      stat.seenTotal += entry.seen_count;
      stat.entryCount += 1;
      if (entry.is_vpn) stat.vpnCount += 1;
    }
  }

  const contributions: SignalContribution[] = [];
  for (const [hash, stat] of perHash) {
    if (stat.memberIds.size < 2) continue; // doesn't actually connect this cluster
    const globalSize = groups.get(hash)?.size ?? stat.memberIds.size;
    contributions.push({
      otherCount: Math.max(1, globalSize - 1),
      seenTotal: stat.seenTotal,
      allVpn: stat.entryCount > 0 && stat.vpnCount === stat.entryCount,
    });
  }
  return contributions;
}

function computeClusterScore(
  members: ClusterMember[],
  fpGroups: Map<string, Set<string>>,
  ipGroups: Map<string, Set<string>>,
  hasBannedMember: boolean,
  youngAccountJoinedAfterBan: boolean
): number {
  const fpContribs = clusterSignalContributions(members, fpGroups, (m) =>
    m.fingerprint_history.map((e) => ({
      hash: e.fingerprint_id,
      seen_count: e.seen_count,
    }))
  );
  const ipContribs = clusterSignalContributions(members, ipGroups, (m) =>
    m.ip_history.map((e) => ({
      hash: e.hash,
      seen_count: e.seen_count,
      is_vpn: e.is_vpn,
    }))
  );

  let raw = 0;
  for (const c of fpContribs) {
    const rarity = 1 / c.otherCount;
    const persistence = Math.log2(1 + c.seenTotal);
    raw += FINGERPRINT_WEIGHT * rarity * (1 + PERSISTENCE_FACTOR * persistence);
  }
  for (const c of ipContribs) {
    const rarity = 1 / c.otherCount;
    const persistence = Math.log2(1 + c.seenTotal);
    const vpnFactor = c.allVpn ? VPN_IP_DISCOUNT : 1;
    raw +=
      IP_WEIGHT * rarity * vpnFactor * (1 + PERSISTENCE_FACTOR * persistence);
  }

  raw += SIZE_WEIGHT * Math.log2(members.length);
  if (hasBannedMember) raw += BAN_BONUS;
  if (youngAccountJoinedAfterBan) raw += EVASION_BONUS;

  return Math.min(0.99, 1 - Math.exp(-raw));
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

  union(a: string, b: string, signal: 'fingerprint' | 'ip') {
    const ra = this.find(a);
    const rb = this.find(b);
    const root = ra <= rb ? ra : rb;
    this.parent.set(ra, root);
    this.parent.set(rb, root);
    if (signal === 'fingerprint') this.fpEdges.add(this.find(a));
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

router.get('/', async (req, res) => {
  const startTime = Date.now();
  const minScoreRaw =
    typeof req.query.minScore === 'string' ? parseFloat(req.query.minScore) : 0;
  if (Number.isNaN(minScoreRaw)) {
    return res.status(400).json({ error: 'Invalid minScore parameter' });
  }
  const minScore = minScoreRaw;

  try {
    const fpRows = await sql<{ id: string; fingerprint_id: string }>`
      SELECT u.id, e->>'fingerprint_id' AS fingerprint_id
      FROM users u, jsonb_array_elements(u.fingerprint_history) e
    `.execute(mainDb);

    const fpGroups = new Map<string, Set<string>>();
    for (const row of fpRows.rows) {
      if (!row.fingerprint_id) continue;
      if (!fpGroups.has(row.fingerprint_id))
        fpGroups.set(row.fingerprint_id, new Set());
      fpGroups.get(row.fingerprint_id)!.add(row.id);
    }

    const ipRows = await sql<{ id: string; hash: string }>`
      SELECT u.id, e->>'hash' AS hash
      FROM users u, jsonb_array_elements(u.ip_history) e
    `.execute(mainDb);

    const ipGroups = new Map<string, Set<string>>();
    for (const row of ipRows.rows) {
      if (!row.hash) continue;
      if (!ipGroups.has(row.hash)) ipGroups.set(row.hash, new Set());
      ipGroups.get(row.hash)!.add(row.id);
    }

    const commonFingerprints = new Set<string>();
    for (const [fp, members] of fpGroups) {
      if (members.size > COMMON_SIGNAL_THRESHOLD) commonFingerprints.add(fp);
    }
    const commonIpHashes = new Set<string>();
    for (const [hash, members] of ipGroups) {
      if (members.size > COMMON_SIGNAL_THRESHOLD) commonIpHashes.add(hash);
    }

    function maxSharedCount(
      hashes: (string | null | undefined)[],
      commonSet: Set<string>,
      groups: Map<string, Set<string>>
    ): number {
      let max = 0;
      for (const h of hashes) {
        if (!h || !commonSet.has(h)) continue;
        const size = (groups.get(h)?.size ?? 1) - 1;
        if (size > max) max = size;
      }
      return max;
    }

    const uf = new UnionFind();

    for (const [fp, members] of fpGroups) {
      if (commonFingerprints.has(fp)) continue;
      const arr = [...members];
      if (arr.length < 2) continue;
      for (let i = 1; i < arr.length; i++) {
        uf.union(arr[0], arr[i], 'fingerprint');
      }
    }

    for (const [hash, members] of ipGroups) {
      if (commonIpHashes.has(hash)) continue;
      const arr = [...members];
      if (arr.length < 2) continue;
      for (let i = 1; i < arr.length; i++) {
        uf.union(arr[0], arr[i], 'ip');
      }
    }

    const components = uf.components();
    const multiComponents = [...components.values()].filter(
      (c) => c.members.length >= 2
    );

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

    const memberIdArray = [...allMemberIds];

    const [userResults, banResults] = await Promise.all([
      Promise.all(memberIdArray.map((id) => getUserById(id))),
      mainDb
        .selectFrom('bans')
        .select(['user_id', 'reason', 'expires_at', 'banned_at', 'active'])
        .where('user_id', 'in', memberIdArray)
        .where('active', '=', true)
        .where((eb) =>
          eb.or([
            eb('expires_at', 'is', null),
            eb('expires_at', '>', new Date()),
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

        const ipHistoryRaw: Array<IpHistoryEntry & { ip?: unknown }> =
          Array.isArray(u.ip_history) ? u.ip_history : [];
        const fingerprintHistoryRaw: FingerprintHistoryEntry[] = Array.isArray(
          u.fingerprint_history
        )
          ? u.fingerprint_history
          : [];

        members.push({
          id,
          username: u.username,
          avatar: u.avatar ?? null,
          discriminator: u.discriminator ?? null,
          created_at: platformJoined ? platformJoined.toISOString() : '',
          discord_created_at: discordCreated.toISOString(),
          discord_account_age_days: discordAgeDays,
          last_login: u.last_login
            ? new Date(u.last_login as unknown as string).toISOString()
            : null,
          is_vpn: u.is_vpn ?? false,
          fingerprint_id: u.fingerprint_id ?? null,
          ip_hash: u.ip_hash ?? null,
          ip_history: ipHistoryRaw.map((e) => ({
            hash: e.hash,
            is_vpn: e.is_vpn,
            first_seen: e.first_seen,
            last_seen: e.last_seen,
            seen_count: e.seen_count,
          })),
          fingerprint_history: fingerprintHistoryRaw,
          common_ip_count: maxSharedCount(
            ipHistoryRaw.map((e) => e.hash),
            commonIpHashes,
            ipGroups
          ),
          common_fingerprint_count: maxSharedCount(
            fingerprintHistoryRaw.map((e) => e.fingerprint_id),
            commonFingerprints,
            fpGroups
          ),
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

      const score = computeClusterScore(
        members,
        fpGroups,
        ipGroups,
        hasBannedMember,
        youngAccountJoinedAfterBan
      );
      if (score < minScore) continue;

      // Sort members: banned first, then by platform join date
      members.sort((a, b) => {
        if (a.ban && !b.ban) return -1;
        if (!a.ban && b.ban) return 1;
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });

      const clusterId = [...comp.members].sort().join(':');

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
    console.error('[alts] Error building alt clusters:', err);
    res.status(500).json({ error: 'Failed to build alt clusters' });
  }
});

export default router;
