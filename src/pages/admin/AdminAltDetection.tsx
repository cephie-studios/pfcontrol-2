import { useState, useEffect } from "react";
import type { IconType } from "react-icons";
import { Link } from "react-router-dom";
import {
  MdCallMerge,
  MdFingerprint,
  MdPublic,
  MdBlock,
  MdWarning,
  MdShield,
  MdExpandMore,
  MdChevronRight,
  MdOpenInNew,
  MdVisibility,
  MdVisibilityOff,
  MdUnfoldMore,
} from "react-icons/md";
import {
  fetchAltClusters,
  revealUserIP,
  type AltCluster,
  type AltClustersResponse,
  type ClusterMember,
} from "../../utils/fetch/admin";
import AdminRefreshButton from "../../components/admin/AdminRefreshButton";
import AdminLayout from "../../components/admin/AdminLayout";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import AdminToolbar from "../../components/admin/AdminToolbar";
import AdminSearchInput from "../../components/admin/AdminSearchInput";
import AdminStatStrip from "../../components/admin/AdminStatStrip";
import {
  adminDownsizeButtonSize,
  adminSectionClass,
  adminTableShellClass,
  ADMIN_TOOLBAR_HEIGHT,
  ADMIN_TOOLBAR_MOBILE_COL,
  ADMIN_TOOLBAR_MOBILE_PAIR,
  ADMIN_TOOLBAR_MOBILE_SEARCH,
  ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM,
} from "../../components/admin/adminConstants";
import Loader from "../../components/common/Loader";
import ErrorScreen from "../../components/common/ErrorScreen";
import Dropdown from "../../components/common/Dropdown";
import Button from "../../components/common/Button";
import type { DropdownOption } from "../../types/dropdown";

function ScoreBadge({
  score,
  label,
}: {
  score: number;
  label: AltCluster["score_label"];
}) {
  const colors: Record<AltCluster["score_label"], string> = {
    low: "bg-zinc-700 text-zinc-300 border-zinc-600",
    medium: "bg-yellow-900/40 text-yellow-400 border-yellow-700/50",
    high: "bg-orange-900/40 text-orange-400 border-orange-700/50",
    critical: "bg-red-900/40 text-red-400 border-red-600/50",
  };
  const dot: Record<AltCluster["score_label"], string> = {
    low: "bg-zinc-400",
    medium: "bg-yellow-400",
    high: "bg-orange-400",
    critical: "bg-red-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${colors[label]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot[label]}`} />
      {(score * 100).toFixed(0)}% · {label.toUpperCase()}
    </span>
  );
}

function SignalPills({ signals }: { signals: AltCluster["signals"] }) {
  const pills = [
    signals.shared_fingerprint && {
      label: "Fingerprint",
      icon: MdFingerprint,
      color: "text-purple-400 bg-purple-900/30 border-purple-700/50",
    },
    signals.shared_ip && {
      label: "IP Match",
      icon: MdPublic,
      color: "text-blue-400 bg-blue-900/30 border-blue-700/50",
    },
    signals.has_banned_member && {
      label: "Banned Member",
      icon: MdBlock,
      color: "text-red-400 bg-red-900/30 border-red-700/50",
    },
    signals.young_account_joined_after_ban && {
      label: "New Acct Post-Ban",
      icon: MdWarning,
      color: "text-amber-400 bg-amber-900/30 border-amber-700/50",
    },
    signals.vpn_overlap && {
      label: "All VPN",
      icon: MdShield,
      color: "text-zinc-400 bg-zinc-800 border-zinc-600",
    },
  ].filter(Boolean) as { label: string; icon: IconType; color: string }[];

  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map((p) => {
        const Icon = p.icon;
        return (
          <span
            key={p.label}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border rounded-full ${p.color}`}
          >
            <Icon size={12} />
            {p.label}
          </span>
        );
      })}
    </div>
  );
}

function MemberRow({
  member,
  revealedIp,
  isRevealing,
  onReveal,
}: {
  member: ClusterMember;
  revealedIp: string | null;
  isRevealing: boolean;
  onReveal: (userId: string) => void;
}) {
  const avatarUrl = member.avatar
    ? `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.webp?size=64`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  const platformJoined = member.created_at
    ? new Date(member.created_at).toLocaleDateString()
    : "—";
  const lastSeen = member.last_login
    ? new Date(member.last_login).toLocaleDateString()
    : "—";

  const ipDisplay = revealedIp ?? "***.***.***.**";
  const isRevealed = revealedIp !== null;
  const btnSize = adminDownsizeButtonSize("sm");

  return (
    <div className="flex items-start gap-3 py-3 border-b border-zinc-800/60 last:border-b-0">
      <img
        src={avatarUrl}
        alt={member.username}
        className="w-9 h-9 rounded-full shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-white text-sm">
            {member.username}
            {member.discriminator && member.discriminator !== "0" && (
              <span className="text-zinc-500">#{member.discriminator}</span>
            )}
          </span>
          {member.ban && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-900/40 text-red-400 border border-red-600/50 rounded-full">
              <MdBlock size={12} />
              BANNED
            </span>
          )}
          {member.is_vpn && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-zinc-700 text-zinc-400 border border-zinc-600 rounded-full">
              VPN
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-500">
          <span>Discord age at join: {member.discord_account_age_days}d</span>
          <span>Joined: {platformJoined}</span>
          <span>Last seen: {lastSeen}</span>
        </div>

        <div className="mt-1.5 flex items-center gap-2">
          <MdPublic size={12} className="text-zinc-600 shrink-0" />
          <span
            className={`text-xs font-mono ${isRevealed ? "text-cyan-400" : "text-zinc-400 filter blur-sm select-none"}`}
          >
            {ipDisplay}
          </span>
          <Button
            size={btnSize}
            variant="ghost"
            onClick={() => onReveal(member.id)}
            disabled={isRevealing}
            className="p-1"
          >
            {isRevealing ? (
              <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
            ) : isRevealed ? (
              <MdVisibilityOff size={16} />
            ) : (
              <MdVisibility size={16} />
            )}
          </Button>
        </div>

        {member.fingerprint_id && (
          <div className="mt-1 flex items-center gap-2">
            <MdFingerprint size={12} className="text-zinc-600 shrink-0" />
            <span
              className="text-xs font-mono text-zinc-500"
              title={member.fingerprint_id}
            >
              {member.fingerprint_id.slice(0, 16)}…
            </span>
          </div>
        )}

        {member.ban?.reason && (
          <p className="mt-1 text-xs text-red-400/80">
            Ban reason: {member.ban.reason}
          </p>
        )}
      </div>

      <Link
        to={`/admin/users?search=${member.id}`}
        className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-400 hover:text-white border border-zinc-700 rounded-lg transition-colors"
      >
        View <MdOpenInNew size={12} />
      </Link>
    </div>
  );
}

function ClusterCard({
  cluster,
  expanded,
  onToggle,
  revealedIPs,
  revealingId,
  onReveal,
}: {
  cluster: AltCluster;
  expanded: boolean;
  onToggle: () => void;
  revealedIPs: Map<string, string>;
  revealingId: string | null;
  onReveal: (userId: string) => void;
}) {
  const displayMembers = cluster.members.slice(0, 10);
  const overflow = cluster.members.length - displayMembers.length;
  const btnSize = adminDownsizeButtonSize("xs");

  return (
    <div className={adminTableShellClass("overflow-hidden")}>
      <button
        onClick={onToggle}
        className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/30 transition-colors"
      >
        <ScoreBadge score={cluster.score} label={cluster.score_label} />
        <span className="text-sm text-zinc-400">
          {cluster.member_count} accounts
        </span>
        <SignalPills signals={cluster.signals} />
        <span className="ml-auto text-zinc-500">
          {expanded ? <MdExpandMore size={20} /> : <MdChevronRight size={20} />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800/60 px-4 pb-3">
          {displayMembers.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              revealedIp={revealedIPs.get(m.id) ?? null}
              isRevealing={revealingId === m.id}
              onReveal={onReveal}
            />
          ))}
          {overflow > 0 && (
            <p className="text-xs text-zinc-500 text-center pt-2">
              + {overflow} more account{overflow !== 1 ? "s" : ""}
            </p>
          )}
          <div className="pt-2">
            <Link to="/admin/bans">
              <Button variant="danger" size={btnSize}>
                <MdBlock size={14} className="mr-1.5" />
                Go to Bans to action these accounts
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminAltDetection() {
  const [clusters, setClusters] = useState<AltCluster[]>([]);
  const [stats, setStats] = useState<AltClustersResponse["stats"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const [minScoreFilter, setMinScoreFilter] = useState<
    "all" | "medium" | "high" | "critical"
  >("all");
  const [showBannedOnly, setShowBannedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"score" | "size">("score");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [revealedIPs, setRevealedIPs] = useState<Map<string, string>>(
    new Map()
  );
  const [revealingId, setRevealingId] = useState<string | null>(null);

  const toolbarBtnClass = `flex items-center shrink-0 ${ADMIN_TOOLBAR_HEIGHT} py-0`;

  const handleRevealIP = async (userId: string) => {
    if (revealedIPs.has(userId)) {
      setRevealedIPs((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
      return;
    }
    try {
      setRevealingId(userId);
      const { ip_address } = await revealUserIP(userId);
      setRevealedIPs((prev) => new Map(prev).set(userId, ip_address));
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to reveal IP",
        type: "error",
      });
    } finally {
      setRevealingId(null);
    }
  };

  const loadClusters = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAltClusters();
      setClusters(data.clusters);
      setStats(data.stats);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load alt clusters"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClusters();
  }, []);

  const scoreFilterOptions: DropdownOption[] = [
    { value: "all", label: "All scores" },
    { value: "medium", label: "Medium+ (40%+)" },
    { value: "high", label: "High+ (60%+)" },
    { value: "critical", label: "Critical only (80%+)" },
  ];
  const sortOptions: DropdownOption[] = [
    { value: "score", label: "Sort: Score" },
    { value: "size", label: "Sort: Cluster size" },
  ];

  const minScoreMap: Record<typeof minScoreFilter, number> = {
    all: 0,
    medium: 0.4,
    high: 0.6,
    critical: 0.8,
  };

  const searchTerm = searchQuery.trim().toLowerCase();

  const filtered = clusters
    .filter((c) => c.score >= minScoreMap[minScoreFilter])
    .filter((c) => !showBannedOnly || c.signals.has_banned_member)
    .filter(
      (c) =>
        !searchTerm ||
        c.members.some((m) => m.username.toLowerCase().includes(searchTerm))
    )
    .sort((a, b) =>
      sortBy === "score"
        ? b.score - a.score || b.member_count - a.member_count
        : b.member_count - a.member_count || b.score - a.score
    );

  const allExpanded =
    filtered.length > 0 && filtered.every((c) => expandedIds.has(c.id));

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPageHeader
        title="Alt Detection"
        icon={MdCallMerge}
        accent="amber"
        actions={
          <AdminRefreshButton
            onClick={loadClusters}
            loading={loading}
            label="Rescan"
          />
        }
      />
      <p className="text-zinc-500 text-sm -mt-3 mb-5">
        Groups of accounts likely controlled by the same person, scored by
        confidence
      </p>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader />
        </div>
      ) : error ? (
        <ErrorScreen
          title="Scan failed"
          message={error}
          onRetry={loadClusters}
        />
      ) : (
        <>
          {stats && (
            <AdminStatStrip
              columns={3}
              items={[
                { label: "Clusters found", value: stats.total_clusters },
                {
                  label: "Flagged accounts",
                  value: stats.total_flagged_accounts,
                },
                { label: "Scan time", value: `${stats.scan_duration_ms}ms` },
              ]}
            />
          )}

          <AdminToolbar className={ADMIN_TOOLBAR_MOBILE_COL}>
            <AdminSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search username…"
              className={ADMIN_TOOLBAR_MOBILE_SEARCH}
            />
            <div className={ADMIN_TOOLBAR_MOBILE_PAIR}>
              <Dropdown
                size="sm"
                value={minScoreFilter}
                onChange={(v) => setMinScoreFilter(v as typeof minScoreFilter)}
                options={scoreFilterOptions}
                className={`w-44 ${ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM}`}
              />
              <Dropdown
                size="sm"
                value={sortBy}
                onChange={(v) => setSortBy(v as typeof sortBy)}
                options={sortOptions}
                className={`w-40 ${ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM}`}
              />
            </div>
            <div className={`${ADMIN_TOOLBAR_MOBILE_PAIR} max-md:[&>*]:flex-1`}>
              <Button
                variant={showBannedOnly ? "danger" : "outline"}
                size="sm"
                onClick={() => setShowBannedOnly((v) => !v)}
                className={`max-md:flex-1 max-md:justify-center ${toolbarBtnClass}`}
              >
                <MdShield size={18} className="mr-1.5 shrink-0" />
                <span className="truncate">
                  {showBannedOnly ? "With bans only" : "All clusters"}
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (allExpanded) {
                    setExpandedIds(new Set());
                  } else {
                    setExpandedIds(new Set(filtered.map((c) => c.id)));
                  }
                }}
                disabled={filtered.length === 0}
                className={`md:ml-auto max-md:flex-1 max-md:justify-center ${toolbarBtnClass}`}
              >
                <MdUnfoldMore size={18} className="mr-1.5 shrink-0" />
                <span className="truncate">
                  {allExpanded ? "Collapse all" : "Expand all"}
                </span>
              </Button>
            </div>
          </AdminToolbar>

          <div
            className={`space-y-3 ${adminSectionClass("!mt-0 !pt-0 !border-t-0")}`}
          >
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                <MdCallMerge size={40} className="mb-3 opacity-30" />
                <p className="text-base font-medium">No clusters found</p>
                <p className="text-sm mt-1 text-center max-w-md">
                  {clusters.length > 0
                    ? "Try adjusting the filters above"
                    : "No accounts share signals yet — run the backfill script to populate ip_hash for existing users"}
                </p>
              </div>
            ) : (
              filtered.map((cluster) => (
                <ClusterCard
                  key={cluster.id}
                  cluster={cluster}
                  expanded={expandedIds.has(cluster.id)}
                  onToggle={() =>
                    setExpandedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(cluster.id)) next.delete(cluster.id);
                      else next.add(cluster.id);
                      return next;
                    })
                  }
                  revealedIPs={revealedIPs}
                  revealingId={revealingId}
                  onReveal={handleRevealIP}
                />
              ))
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}