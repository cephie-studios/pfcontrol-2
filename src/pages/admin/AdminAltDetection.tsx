import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GitMerge,
  Fingerprint,
  Globe,
  Ban,
  AlertTriangle,
  ShieldOff,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Menu,
  Shield,
  Eye,
  EyeOff,
  Search,
  ChevronsUpDown,
} from 'lucide-react';
import {
  fetchAltClusters,
  revealUserIP,
  type AltCluster,
  type AltClustersResponse,
  type ClusterMember,
} from '../../utils/fetch/admin';
import Navbar from '../../components/Navbar';
import AdminSidebar from '../../components/admin/AdminSidebar';
import Loader from '../../components/common/Loader';
import Toast from '../../components/common/Toast';
import ErrorScreen from '../../components/common/ErrorScreen';
import Dropdown from '../../components/common/Dropdown';
import Button from '../../components/common/Button';
import type { DropdownOption } from '../../types/dropdown';

// ─── Score Badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score, label }: { score: number; label: AltCluster['score_label'] }) {
  const colors: Record<AltCluster['score_label'], string> = {
    low: 'bg-zinc-700 text-zinc-300 border-zinc-600',
    medium: 'bg-yellow-900/40 text-yellow-400 border-yellow-700/50',
    high: 'bg-orange-900/40 text-orange-400 border-orange-700/50',
    critical: 'bg-red-900/40 text-red-400 border-red-600/50',
  };
  const dot: Record<AltCluster['score_label'], string> = {
    low: 'bg-zinc-400',
    medium: 'bg-yellow-400',
    high: 'bg-orange-400',
    critical: 'bg-red-400',
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

// ─── Signal Pills ─────────────────────────────────────────────────────────────

function SignalPills({ signals }: { signals: AltCluster['signals'] }) {
  const pills = [
    signals.shared_fingerprint && {
      label: 'Fingerprint',
      icon: Fingerprint,
      color: 'text-purple-400 bg-purple-900/30 border-purple-700/50',
    },
    signals.shared_ip && {
      label: 'IP Match',
      icon: Globe,
      color: 'text-blue-400 bg-blue-900/30 border-blue-700/50',
    },
    signals.has_banned_member && {
      label: 'Banned Member',
      icon: Ban,
      color: 'text-red-400 bg-red-900/30 border-red-700/50',
    },
    signals.young_account_joined_after_ban && {
      label: 'New Acct Post-Ban',
      icon: AlertTriangle,
      color: 'text-amber-400 bg-amber-900/30 border-amber-700/50',
    },
    signals.vpn_overlap && {
      label: 'All VPN',
      icon: ShieldOff,
      color: 'text-zinc-400 bg-zinc-800 border-zinc-600',
    },
  ].filter(Boolean) as { label: string; icon: React.ElementType; color: string }[];

  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map((p) => (
        <span
          key={p.label}
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border rounded-full ${p.color}`}
        >
          <p.icon className="w-3 h-3" />
          {p.label}
        </span>
      ))}
    </div>
  );
}

// ─── Member Row ───────────────────────────────────────────────────────────────

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
    : '—';
  const lastSeen = member.last_login
    ? new Date(member.last_login).toLocaleDateString()
    : '—';

  const ipDisplay = revealedIp ?? '***.***.***.**';
  const isRevealed = revealedIp !== null;

  return (
    <div className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/40">
      <img
        src={avatarUrl}
        alt={member.username}
        className="w-10 h-10 rounded-full shrink-0"
      />
      <div className="flex-1 min-w-0">
        {/* Name + badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-white text-sm">
            {member.username}
            {member.discriminator && member.discriminator !== '0' && (
              <span className="text-zinc-500">#{member.discriminator}</span>
            )}
          </span>
          {member.ban && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-900/40 text-red-400 border border-red-600/50 rounded-full">
              <Ban className="w-3 h-3" />
              BANNED
            </span>
          )}
          {member.is_vpn && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-zinc-700 text-zinc-400 border border-zinc-600 rounded-full">
              VPN
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-500">
          <span>Discord age at join: {member.discord_account_age_days}d</span>
          <span>Joined: {platformJoined}</span>
          <span>Last seen: {lastSeen}</span>
        </div>

        {/* IP row */}
        <div className="mt-1.5 flex items-center gap-2">
          <Globe className="w-3 h-3 text-zinc-600 shrink-0" />
          <span
            className={`text-xs font-mono ${isRevealed ? 'text-cyan-400' : 'text-zinc-400 filter blur-sm select-none'}`}
          >
            {ipDisplay}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onReveal(member.id)}
            disabled={isRevealing}
            className="p-1"
          >
            {isRevealing ? (
              <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
            ) : isRevealed ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Fingerprint row */}
        {member.fingerprint_id && (
          <div className="mt-1 flex items-center gap-2">
            <Fingerprint className="w-3 h-3 text-zinc-600 shrink-0" />
            <span className="text-xs font-mono text-zinc-500" title={member.fingerprint_id}>
              {member.fingerprint_id.slice(0, 16)}…
            </span>
          </div>
        )}

        {member.ban?.reason && (
          <p className="mt-1 text-xs text-red-400/80">Ban reason: {member.ban.reason}</p>
        )}
      </div>

      {/* View link */}
      <Link
        to={`/admin/users?search=${member.id}`}
        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white border border-zinc-600 rounded-lg transition-colors"
      >
        View <ExternalLink className="w-3 h-3" />
      </Link>
    </div>
  );
}

// ─── Cluster Card ─────────────────────────────────────────────────────────────

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

  return (
    <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex flex-wrap items-center gap-3 p-4 text-left hover:bg-zinc-800/30 transition-colors"
      >
        <ScoreBadge score={cluster.score} label={cluster.score_label} />
        <span className="text-sm text-zinc-400">{cluster.member_count} accounts</span>
        <SignalPills signals={cluster.signals} />
        <span className="ml-auto text-zinc-500">
          {expanded ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-zinc-700/50 p-4 space-y-2">
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
            <p className="text-xs text-zinc-500 text-center pt-1">
              + {overflow} more account{overflow !== 1 ? 's' : ''}
            </p>
          )}
          <div className="pt-2">
            <Link to="/admin/bans">
              <Button variant="danger" size="xs">
                <Ban className="w-3.5 h-3.5 mr-1.5" />
                Go to Bans to action these accounts
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAltDetection() {
  const [clusters, setClusters] = useState<AltCluster[]>([]);
  const [stats, setStats] = useState<AltClustersResponse['stats'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Filters (client-side)
  const [minScoreFilter, setMinScoreFilter] = useState<
    'all' | 'medium' | 'high' | 'critical'
  >('all');
  const [showBannedOnly, setShowBannedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'size'>('score');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedIPs, setRevealedIPs] = useState<Map<string, string>>(new Map());
  const [revealingId, setRevealingId] = useState<string | null>(null);

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
        message: err instanceof Error ? err.message : 'Failed to reveal IP',
        type: 'error',
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
      setError(err instanceof Error ? err.message : 'Failed to load alt clusters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClusters();
  }, []);

  // Dropdown option arrays
  const scoreFilterOptions: DropdownOption[] = [
    { value: 'all', label: 'All scores' },
    { value: 'medium', label: 'Medium+ (40%+)' },
    { value: 'high', label: 'High+ (60%+)' },
    { value: 'critical', label: 'Critical only (80%+)' },
  ];
  const sortOptions: DropdownOption[] = [
    { value: 'score', label: 'Sort: Score' },
    { value: 'size', label: 'Sort: Cluster size' },
  ];

  // Apply client-side filters
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
      sortBy === 'score'
        ? b.score - a.score || b.member_count - a.member_count
        : b.member_count - a.member_count || b.score - a.score
    );

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="flex pt-16">
        {/* Mobile overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <AdminSidebar />
        </div>

        {/* Mobile sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:hidden ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <AdminSidebar />
        </div>

        {/* Main content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <GitMerge className="h-8 w-8 sm:h-10 sm:w-10 text-amber-400 shrink-0" />
            <div>
              <h1 className="text-3xl sm:text-4xl text-transparent bg-clip-text bg-linear-to-r from-amber-400 to-orange-500 font-extrabold">
                Alt Detection
              </h1>
              <p className="text-zinc-400 text-sm mt-0.5">
                Groups of accounts likely controlled by the same person, scored by confidence
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader />
            </div>
          ) : error ? (
            <ErrorScreen title="Scan failed" message={error} onRetry={loadClusters} />
          ) : (
            <>
              {/* Stats bar */}
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <StatCard label="Clusters Found" value={stats.total_clusters} />
                  <StatCard label="Flagged Accounts" value={stats.total_flagged_accounts} />
                  <StatCard
                    label="Scan Time"
                    value={`${stats.scan_duration_ms}ms`}
                  />
                </div>
              )}

              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative group flex-1 min-w-48 max-w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-amber-400 transition-colors pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search username…"
                    className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all duration-200 hover:border-zinc-600"
                  />
                </div>

                <Dropdown
                  size="sm"
                  value={minScoreFilter}
                  onChange={(v) => setMinScoreFilter(v as typeof minScoreFilter)}
                  options={scoreFilterOptions}
                  className="w-44"
                />
                <Dropdown
                  size="sm"
                  value={sortBy}
                  onChange={(v) => setSortBy(v as typeof sortBy)}
                  options={sortOptions}
                  className="w-40"
                />

                <Button
                  variant={showBannedOnly ? 'danger' : 'outline'}
                  size="sm"
                  onClick={() => setShowBannedOnly((v) => !v)}
                >
                  <Shield className="w-4 h-4 mr-1.5" />
                  {showBannedOnly ? 'With Bans Only' : 'All Clusters'}
                </Button>

                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allExpanded = filtered.every((c) => expandedIds.has(c.id));
                      if (allExpanded) {
                        setExpandedIds(new Set());
                      } else {
                        setExpandedIds(new Set(filtered.map((c) => c.id)));
                      }
                    }}
                    disabled={filtered.length === 0}
                  >
                    <ChevronsUpDown className="w-4 h-4 mr-1.5" />
                    {filtered.every((c) => expandedIds.has(c.id)) && filtered.length > 0
                      ? 'Collapse All'
                      : 'Expand All'}
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={loadClusters}
                    disabled={loading}
                  >
                    <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                    Rescan
                  </Button>
                </div>
              </div>

              {/* Cluster list */}
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                  <GitMerge className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-lg font-medium">No clusters found</p>
                  <p className="text-sm mt-1">
                    {clusters.length > 0
                      ? 'Try adjusting the filters above'
                      : 'No accounts share signals yet — run the backfill script to populate ip_hash for existing users'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((cluster) => (
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
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile sidebar FAB */}
      <div className="lg:hidden fixed bottom-6 right-6 z-30">
        <Button variant="primary" size="icon" onClick={() => setMobileSidebarOpen(true)}>
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
