import { useState, useEffect } from 'react';
import type { IconType } from 'react-icons';
import { Link } from 'react-router-dom';
import {
  MdCallMerge,
  MdFingerprint,
  MdPublic,
  MdBlock,
  MdWarning,
  MdShield,
  MdOpenInNew,
  MdVisibility,
  MdVisibilityOff,
  MdHistory,
  MdRouter,
  MdExpandMore,
  MdChevronRight,
  MdSearch,
} from 'react-icons/md';
import {
  fetchAltClusters,
  revealUserIPHistory,
  type AltCluster,
  type AltClustersResponse,
  type ClusterMember,
  type IpHistoryEntry,
  type FingerprintHistoryEntry,
} from '../../utils/fetch/admin';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminModal from '../../components/admin/AdminModal';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminToolbar from '../../components/admin/AdminToolbar';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminStatStrip from '../../components/admin/AdminStatStrip';
import AdminTable from '../../components/admin/AdminTable';
import {
  adminDownsizeButtonSize,
  statusBadgeClass,
  ADMIN_TH,
  ADMIN_TD,
  ADMIN_TABLE_HEAD,
  ADMIN_TOOLBAR_MOBILE_COL,
  ADMIN_TOOLBAR_MOBILE_PAIR,
  ADMIN_TOOLBAR_MOBILE_SEARCH,
  ADMIN_TOOLBAR_MOBILE_SPLIT_ITEM,
} from '../../components/admin/adminConstants';
import Loader from '../../components/common/Loader';
import ErrorScreen from '../../components/common/ErrorScreen';
import Dropdown from '../../components/common/Dropdown';
import Button from '../../components/common/Button';
import type { DropdownOption } from '../../types/dropdown';

const MEMBER_DISPLAY_CAP = 50;

function avatarUrlFor(member: Pick<ClusterMember, 'id' | 'avatar'>) {
  return member.avatar
    ? `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.webp?size=64`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;
}

function ScoreBadge({
  score,
  label,
}: {
  score: number;
  label: AltCluster['score_label'];
}) {
  const colors: Record<AltCluster['score_label'], string> = {
    low: 'bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700/50',
    medium: 'bg-amber-950/50 text-amber-200 ring-1 ring-amber-800/35',
    high: 'bg-orange-950/50 text-orange-300 ring-1 ring-orange-800/40',
    critical: 'bg-red-950/50 text-red-300 ring-1 ring-red-800/40',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${colors[label]}`}
    >
      {(score * 100).toFixed(0)}% · {label.toUpperCase()}
    </span>
  );
}

function SignalPills({ signals }: { signals: AltCluster['signals'] }) {
  const pills = [
    signals.shared_fingerprint && {
      label: 'Fingerprint',
      icon: MdFingerprint,
      color: 'bg-purple-950/50 text-purple-300 ring-1 ring-purple-800/40',
    },
    signals.shared_ip && {
      label: 'IP Match',
      icon: MdPublic,
      color: 'bg-blue-950/50 text-blue-300 ring-1 ring-blue-800/40',
    },
    signals.has_banned_member && {
      label: 'Banned Member',
      icon: MdBlock,
      color: 'bg-red-950/40 text-red-300 ring-1 ring-red-900/40',
    },
    signals.young_account_joined_after_ban && {
      label: 'New Acct Post-Ban',
      icon: MdWarning,
      color: 'bg-amber-950/50 text-amber-200 ring-1 ring-amber-800/35',
    },
    signals.vpn_overlap && {
      label: 'All VPN',
      icon: MdShield,
      color: 'bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700/50',
    },
  ].filter(Boolean) as { label: string; icon: IconType; color: string }[];

  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map((p) => {
        const Icon = p.icon;
        return (
          <span
            key={p.label}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${p.color}`}
          >
            <Icon size={12} />
            {p.label}
          </span>
        );
      })}
    </div>
  );
}

function AvatarStack({ members }: { members: ClusterMember[] }) {
  const shown = members.slice(0, 5);
  const overflow = members.length - shown.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((m) => (
          <img
            key={m.id}
            src={avatarUrlFor(m)}
            alt={m.username}
            title={m.username}
            className="w-7 h-7 rounded-full ring-2 ring-zinc-900"
          />
        ))}
        {overflow > 0 && (
          <span className="w-7 h-7 rounded-full ring-2 ring-zinc-900 bg-zinc-800 text-zinc-400 text-[10px] font-semibold flex items-center justify-center">
            +{overflow}
          </span>
        )}
      </div>
      <span className="ml-2.5 text-sm text-zinc-400 whitespace-nowrap">
        {members.length} account{members.length === 1 ? '' : 's'}
      </span>
    </div>
  );
}

// ─── Member history detail (shown inside the cluster review modal) ────────

function formatDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString() : '—';
}

function HistoryMeta({
  firstSeen,
  lastSeen,
  seenCount,
}: {
  firstSeen: string;
  lastSeen: string;
  seenCount: number;
}) {
  return (
    <span className="text-zinc-600 ml-auto shrink-0 whitespace-nowrap">
      {formatDate(firstSeen)} – {formatDate(lastSeen)}
      {seenCount > 1 ? ` · ${seenCount}×` : ''}
    </span>
  );
}

function IpHistoryRow({
  entry,
  revealedIp,
}: {
  entry: IpHistoryEntry;
  revealedIp: string | null | undefined;
}) {
  const isRevealed = revealedIp != null;
  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      <MdPublic size={12} className="text-zinc-600 shrink-0" />
      <span
        className={`font-mono ${isRevealed ? 'text-cyan-400' : 'text-zinc-400 filter blur-sm select-none'}`}
      >
        {revealedIp ?? '***.***.***.**'}
      </span>
      {entry.is_vpn && (
        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700/50 rounded-full shrink-0">
          VPN
        </span>
      )}
      <HistoryMeta
        firstSeen={entry.first_seen}
        lastSeen={entry.last_seen}
        seenCount={entry.seen_count}
      />
    </div>
  );
}

function FingerprintHistoryRow({ entry }: { entry: FingerprintHistoryEntry }) {
  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      <MdFingerprint size={12} className="text-zinc-600 shrink-0" />
      <span className="font-mono text-zinc-500" title={entry.fingerprint_id}>
        {entry.fingerprint_id.slice(0, 16)}…
      </span>
      <HistoryMeta
        firstSeen={entry.first_seen}
        lastSeen={entry.last_seen}
        seenCount={entry.seen_count}
      />
    </div>
  );
}

function CommonSignalNote({ member }: { member: ClusterMember }) {
  if (member.common_ip_count === 0 && member.common_fingerprint_count === 0) {
    return null;
  }
  const parts: string[] = [];
  if (member.common_ip_count > 0) {
    parts.push(
      `a network shared with ${member.common_ip_count} other account${member.common_ip_count === 1 ? '' : 's'}`
    );
  }
  if (member.common_fingerprint_count > 0) {
    parts.push(
      `a device shared with ${member.common_fingerprint_count} other account${member.common_fingerprint_count === 1 ? '' : 's'}`
    );
  }
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-zinc-500 italic">
      <MdRouter size={13} className="shrink-0 mt-0.5 not-italic" />
      Also seen on {parts.join(' and ')} — too common to use for clustering.
    </p>
  );
}

function MemberRow({
  member,
  historyExpanded,
  onToggleHistory,
  revealedIps,
  isRevealingHistory,
  onRevealHistory,
}: {
  member: ClusterMember;
  historyExpanded: boolean;
  onToggleHistory: (userId: string) => void;
  revealedIps: Map<string, string | null> | undefined;
  isRevealingHistory: boolean;
  onRevealHistory: (userId: string) => void;
}) {
  const platformJoined = member.created_at
    ? new Date(member.created_at).toLocaleDateString()
    : '—';
  const lastSeen = member.last_login
    ? new Date(member.last_login).toLocaleDateString()
    : '—';

  const btnSize = adminDownsizeButtonSize('sm');
  const ipCount = member.ip_history.length;
  const fpCount = member.fingerprint_history.length;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-zinc-800/60 last:border-b-0">
      <img
        src={avatarUrlFor(member)}
        alt={member.username}
        className="w-9 h-9 rounded-full shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-white text-sm">
            {member.username}
            {member.discriminator && member.discriminator !== '0' && (
              <span className="text-zinc-500">#{member.discriminator}</span>
            )}
          </span>
          {member.ban && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusBadgeClass('banned')}`}
            >
              <MdBlock size={12} />
              BANNED
            </span>
          )}
          {member.is_vpn && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700/50 rounded-full">
              VPN
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-500">
          <span>Discord age at join: {member.discord_account_age_days}d</span>
          <span>Joined: {platformJoined}</span>
          <span>Last seen: {lastSeen}</span>
        </div>

        <CommonSignalNote member={member} />

        <button
          onClick={() => onToggleHistory(member.id)}
          className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
        >
          <MdHistory size={13} className="shrink-0" />
          {ipCount} IP{ipCount === 1 ? '' : 's'} · {fpCount} fingerprint
          {fpCount === 1 ? '' : 's'}
          {historyExpanded ? (
            <MdExpandMore size={15} />
          ) : (
            <MdChevronRight size={15} />
          )}
        </button>

        {historyExpanded && (
          <div className="mt-1 ml-0.5 pl-2 border-l border-zinc-800">
            {ipCount > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  size={btnSize}
                  variant="ghost"
                  onClick={() => onRevealHistory(member.id)}
                  disabled={isRevealingHistory}
                  className="p-1 -ml-1"
                >
                  {isRevealingHistory ? (
                    <div className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                  ) : revealedIps ? (
                    <MdVisibilityOff size={14} />
                  ) : (
                    <MdVisibility size={14} />
                  )}
                </Button>
                <span className="text-xs text-zinc-500">
                  {revealedIps ? 'Hide' : 'Reveal'} IP history
                </span>
              </div>
            )}
            {member.ip_history.map((entry) => (
              <IpHistoryRow
                key={entry.hash}
                entry={entry}
                revealedIp={revealedIps?.get(entry.hash)}
              />
            ))}
            {member.fingerprint_history.map((entry) => (
              <FingerprintHistoryRow key={entry.fingerprint_id} entry={entry} />
            ))}
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

// ─── Cluster review modal ──────────────────────────────────────────────────

function ClusterReviewModal({
  cluster,
  onClose,
  expandedHistoryIds,
  onToggleHistory,
  revealedHistories,
  revealingHistoryId,
  onRevealHistory,
}: {
  cluster: AltCluster | null;
  onClose: () => void;
  expandedHistoryIds: Set<string>;
  onToggleHistory: (userId: string) => void;
  revealedHistories: Map<string, Map<string, string | null>>;
  revealingHistoryId: string | null;
  onRevealHistory: (userId: string) => void;
}) {
  const btnSize = adminDownsizeButtonSize('xs');
  const displayMembers = cluster?.members.slice(0, MEMBER_DISPLAY_CAP) ?? [];
  const overflow = (cluster?.members.length ?? 0) - displayMembers.length;

  return (
    <AdminModal
      open={cluster !== null}
      onClose={onClose}
      title={
        cluster
          ? `Alt cluster — ${cluster.member_count} account${cluster.member_count === 1 ? '' : 's'}`
          : 'Alt cluster'
      }
      size="lg"
      footer={
        <Link to="/admin/bans">
          <Button variant="danger" size={btnSize}>
            <MdBlock size={14} className="mr-1.5" />
            Go to Bans to action these accounts
          </Button>
        </Link>
      }
    >
      {cluster && (
        <>
          <div className="flex flex-wrap items-center gap-2 pb-3 mb-1 border-b border-zinc-800/60">
            <ScoreBadge score={cluster.score} label={cluster.score_label} />
            <SignalPills signals={cluster.signals} />
          </div>
          {displayMembers.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              historyExpanded={expandedHistoryIds.has(m.id)}
              onToggleHistory={onToggleHistory}
              revealedIps={revealedHistories.get(m.id)}
              isRevealingHistory={revealingHistoryId === m.id}
              onRevealHistory={onRevealHistory}
            />
          ))}
          {overflow > 0 && (
            <p className="text-xs text-zinc-500 text-center pt-3">
              + {overflow} more account{overflow !== 1 ? 's' : ''}
            </p>
          )}
        </>
      )}
    </AdminModal>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AdminAltDetection() {
  const [clusters, setClusters] = useState<AltCluster[]>([]);
  const [stats, setStats] = useState<AltClustersResponse['stats'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const [minScoreFilter, setMinScoreFilter] = useState<
    'all' | 'medium' | 'high' | 'critical'
  >('all');
  const [showBannedOnly, setShowBannedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'size'>('score');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(
    null
  );

  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(
    new Set()
  );
  const [revealedHistories, setRevealedHistories] = useState<
    Map<string, Map<string, string | null>>
  >(new Map());
  const [revealingHistoryId, setRevealingHistoryId] = useState<string | null>(
    null
  );

  const handleToggleHistory = (userId: string) => {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleRevealHistory = async (userId: string) => {
    if (revealedHistories.has(userId)) {
      setRevealedHistories((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
      return;
    }
    try {
      setRevealingHistoryId(userId);
      const { history } = await revealUserIPHistory(userId);
      const hashToIp = new Map(history.map((h) => [h.hash, h.ip_address]));
      setRevealedHistories((prev) => new Map(prev).set(userId, hashToIp));
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to reveal IP history',
        type: 'error',
      });
    } finally {
      setRevealingHistoryId(null);
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
        err instanceof Error ? err.message : 'Failed to load alt clusters'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClusters();
  }, []);

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

  const selectedCluster =
    clusters.find((c) => c.id === selectedClusterId) ?? null;

  const mostRecentActivity = (cluster: AltCluster) => {
    const timestamps = cluster.members
      .map((m) => (m.last_login ? new Date(m.last_login).getTime() : 0))
      .filter((t) => t > 0);
    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps));
  };

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
                { label: 'Clusters found', value: stats.total_clusters },
                {
                  label: 'Flagged accounts',
                  value: stats.total_flagged_accounts,
                },
                { label: 'Scan time', value: `${stats.scan_duration_ms}ms` },
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
            <Button
              variant={showBannedOnly ? 'danger' : 'outline'}
              size="sm"
              onClick={() => setShowBannedOnly((v) => !v)}
              className="shrink-0"
            >
              <MdShield size={18} className="mr-1.5 shrink-0" />
              <span className="truncate">
                {showBannedOnly ? 'With bans only' : 'All clusters'}
              </span>
            </Button>
          </AdminToolbar>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
              <MdCallMerge size={40} className="mb-3 opacity-30" />
              <p className="text-base font-medium">No clusters found</p>
              <p className="text-sm mt-1 text-center max-w-md">
                {clusters.length > 0
                  ? 'Try adjusting the filters above'
                  : 'No accounts share signals yet — run scripts/backfillIpHistory.ts and scripts/backfillFingerprintHistory.ts to seed history for existing users'}
              </p>
            </div>
          ) : (
            <AdminTable minWidth="820px">
              <thead className={ADMIN_TABLE_HEAD}>
                <tr>
                  <th className={ADMIN_TH}>Score</th>
                  <th className={ADMIN_TH}>Members</th>
                  <th className={`${ADMIN_TH} hidden md:table-cell`}>
                    Signals
                  </th>
                  <th className={`${ADMIN_TH} hidden sm:table-cell`}>
                    Recent Activity
                  </th>
                  <th className={`${ADMIN_TH} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {filtered.map((cluster) => {
                  const recent = mostRecentActivity(cluster);
                  return (
                    <tr key={cluster.id} className="hover:bg-zinc-800/30">
                      <td className={ADMIN_TD}>
                        <ScoreBadge
                          score={cluster.score}
                          label={cluster.score_label}
                        />
                      </td>
                      <td className={ADMIN_TD}>
                        <AvatarStack members={cluster.members} />
                      </td>
                      <td className={`${ADMIN_TD} hidden md:table-cell`}>
                        <SignalPills signals={cluster.signals} />
                      </td>
                      <td
                        className={`${ADMIN_TD} hidden sm:table-cell whitespace-nowrap text-xs text-zinc-400`}
                      >
                        {recent ? recent.toLocaleDateString() : '—'}
                      </td>
                      <td className={`${ADMIN_TD} text-right`}>
                        <Button
                          size={adminDownsizeButtonSize('sm')}
                          variant="outline"
                          onClick={() => setSelectedClusterId(cluster.id)}
                        >
                          <MdSearch size={14} className="mr-1.5" />
                          Review
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          )}
        </>
      )}

      <ClusterReviewModal
        cluster={selectedCluster}
        onClose={() => setSelectedClusterId(null)}
        expandedHistoryIds={expandedHistoryIds}
        onToggleHistory={handleToggleHistory}
        revealedHistories={revealedHistories}
        revealingHistoryId={revealingHistoryId}
        onRevealHistory={handleRevealHistory}
      />
    </AdminLayout>
  );
}
