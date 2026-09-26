import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Fingerprint,
  Gauge,
  GitMerge,
  Globe,
  History,
  Loader2,
  Search,
  Shield,
  type LucideIcon,
} from 'lucide-react';
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
import AdminPage from '../../components/admin/AdminPage';
import AdminToolbar from '../../components/admin/AdminToolbar';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminStatCards from '../../components/admin/AdminStatCards';
import AdminTable from '../../components/admin/AdminTable';
import AdminSelect, {
  type AdminSelectOption,
} from '../../components/admin/AdminSelect';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import type { AdminTone } from '../../components/admin/adminConstants';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const MEMBER_DISPLAY_CAP = 50;

function avatarUrlFor(member: Pick<ClusterMember, 'id' | 'avatar'>) {
  return member.avatar
    ? `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.webp?size=64`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;
}

function MemberAvatar({
  member,
  className,
}: {
  member: ClusterMember;
  className?: string;
}) {
  return (
    <Avatar className={className}>
      <AvatarImage src={avatarUrlFor(member)} alt={member.username} />
      <AvatarFallback className="text-xs">
        {member.username.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

const SCORE_TONE: Record<AltCluster['score_label'], AdminTone> = {
  low: 'neutral',
  medium: 'warning',
  high: 'orange',
  critical: 'danger',
};

function ScoreBadge({
  score,
  label,
}: {
  score: number;
  label: AltCluster['score_label'];
}) {
  return (
    <AdminStatusBadge
      tone={SCORE_TONE[label]}
      icon={Gauge}
      showLabel
      className="font-semibold whitespace-nowrap tabular-nums"
    >
      {(score * 100).toFixed(0)}% · {label.toUpperCase()}
    </AdminStatusBadge>
  );
}

function SignalIcons({ signals }: { signals: AltCluster['signals'] }) {
  const items = [
    signals.shared_fingerprint && {
      label: 'Fingerprint',
      icon: Fingerprint,
      tone: 'purple',
    },
    signals.shared_ip && {
      label: 'IP Match',
      icon: Globe,
      tone: 'info',
    },
    signals.has_banned_member && {
      label: 'Banned Member',
      icon: Ban,
      tone: 'danger',
    },
    signals.young_account_joined_after_ban && {
      label: 'New Acct Post-Ban',
      icon: AlertTriangle,
      tone: 'warning',
    },
    signals.vpn_overlap && {
      label: 'All VPN',
      icon: Shield,
      tone: 'neutral',
    },
  ].filter(Boolean) as { label: string; icon: LucideIcon; tone: AdminTone }[];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((p) => (
        <AdminStatusBadge key={p.label} tone={p.tone} icon={p.icon}>
          {p.label}
        </AdminStatusBadge>
      ))}
    </div>
  );
}

function AvatarStack({ members }: { members: ClusterMember[] }) {
  const shown = members.slice(0, 5);
  const overflow = members.length - shown.length;
  return (
    <div className="flex items-center">
      <div className="flex gap-1">
        {shown.map((m) => (
          <Tooltip key={m.id}>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <MemberAvatar member={m} className="size-7" />
              </span>
            </TooltipTrigger>
            <TooltipContent>{m.username}</TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <span className="flex h-7 items-center pl-0.5 text-xs text-muted-foreground tabular-nums">
            +{overflow}
          </span>
        )}
      </div>
      <span className="ml-2.5 text-sm whitespace-nowrap text-muted-foreground">
        {members.length} account{members.length === 1 ? '' : 's'}
      </span>
    </div>
  );
}

function formatDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString() : 'N/A';
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
    <span className="ml-auto shrink-0 whitespace-nowrap text-muted-foreground tabular-nums">
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
      <Globe className="size-3 shrink-0 text-muted-foreground" />
      <span
        className={cn(
          'font-mono',
          isRevealed
            ? 'text-foreground'
            : 'text-muted-foreground blur-sm select-none'
        )}
      >
        {revealedIp ?? '***.***.***.**'}
      </span>
      {entry.is_vpn && (
        <AdminStatusBadge tone="neutral" icon={Shield}>
          VPN
        </AdminStatusBadge>
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
      <Fingerprint className="size-3 shrink-0 text-muted-foreground" />
      <span
        className="font-mono text-muted-foreground"
        title={entry.fingerprint_id}
      >
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
    <p className="text-xs text-muted-foreground">
      Also seen on {parts.join(' and ')}, too common to use for clustering.
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
    : 'N/A';
  const lastSeen = member.last_login
    ? new Date(member.last_login).toLocaleDateString()
    : 'N/A';

  const ipCount = member.ip_history.length;
  const fpCount = member.fingerprint_history.length;

  return (
    <div className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
      <MemberAvatar member={member} className="size-9" />
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {member.username}
            {member.discriminator && member.discriminator !== '0' && (
              <span className="text-muted-foreground">
                #{member.discriminator}
              </span>
            )}
          </span>
          {member.ban && (
            <AdminStatusBadge tone="danger" icon={Ban}>
              Banned
            </AdminStatusBadge>
          )}
          {member.is_vpn && (
            <AdminStatusBadge tone="neutral" icon={Shield}>
              VPN
            </AdminStatusBadge>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Discord age at join: {member.discord_account_age_days}d</span>
          <span>Joined: {platformJoined}</span>
          <span>Last seen: {lastSeen}</span>
        </div>

        <CommonSignalNote member={member} />

        <Button
          variant="ghost"
          size="xs"
          onClick={() => onToggleHistory(member.id)}
          aria-expanded={historyExpanded}
          className="-ml-1.5 justify-self-start text-muted-foreground hover:text-foreground"
        >
          <History />
          {ipCount} IP{ipCount === 1 ? '' : 's'} · {fpCount} fingerprint
          {fpCount === 1 ? '' : 's'}
          {historyExpanded ? <ChevronDown /> : <ChevronRight />}
        </Button>

        {historyExpanded && (
          <div className="grid">
            {ipCount > 0 && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onRevealHistory(member.id)}
                disabled={isRevealingHistory}
                className="-ml-1.5 justify-self-start text-muted-foreground hover:text-foreground"
              >
                {isRevealingHistory ? (
                  <Loader2 className="animate-spin" />
                ) : revealedIps ? (
                  <EyeOff />
                ) : (
                  <Eye />
                )}
                {revealedIps ? 'Hide' : 'Reveal'} IP history
              </Button>
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
          <p className="text-xs text-destructive">
            Ban reason: {member.ban.reason}
          </p>
        )}
      </div>

      <Button asChild variant="outline" size="xs" className="shrink-0">
        <Link to={`/admin/users?search=${member.id}`}>
          View
          <ExternalLink />
        </Link>
      </Button>
    </div>
  );
}

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
  const displayMembers = cluster?.members.slice(0, MEMBER_DISPLAY_CAP) ?? [];
  const overflow = (cluster?.members.length ?? 0) - displayMembers.length;

  return (
    <AdminModal
      open={cluster !== null}
      onClose={onClose}
      title={
        cluster
          ? `Alt cluster: ${cluster.member_count} account${cluster.member_count === 1 ? '' : 's'}`
          : 'Alt cluster'
      }
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button asChild variant="destructive">
            <Link to="/admin/bans">
              <Ban />
              Go to Bans
            </Link>
          </Button>
        </>
      }
    >
      {cluster && (
        <>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div className="grid gap-1">
              <dt className="text-xs text-muted-foreground">Score</dt>
              <dd className="text-sm">
                <ScoreBadge score={cluster.score} label={cluster.score_label} />
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-xs text-muted-foreground">Signals</dt>
              <dd className="text-sm">
                <SignalIcons signals={cluster.signals} />
              </dd>
            </div>
          </dl>
          <div className="grid gap-3">
            <h3 className="text-sm font-medium">Accounts</h3>
            <div className="divide-y">
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
            </div>
            {overflow > 0 && (
              <p className="text-xs text-muted-foreground">
                + {overflow} more account{overflow !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </>
      )}
    </AdminModal>
  );
}

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

  const scoreFilterOptions: AdminSelectOption[] = [
    { value: 'all', label: 'All scores' },
    { value: 'medium', label: 'Medium+ (40%+)' },
    { value: 'high', label: 'High+ (60%+)' },
    { value: 'critical', label: 'Critical only (80%+)' },
  ];
  const sortOptions: AdminSelectOption[] = [
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
      <AdminPage
        title="Alt Detection"
        icon={GitMerge}
        actions={
          <AdminRefreshButton
            onClick={loadClusters}
            loading={loading}
            label="Rescan"
          />
        }
      >
        {loading ? (
          <AdminLoading label="Scanning for alt accounts…" />
        ) : error ? (
          <AdminErrorState
            title="Scan failed"
            message={error}
            onRetry={loadClusters}
          />
        ) : (
          <>
            {stats && (
              <AdminStatCards
                columns={2}
                items={[
                  { label: 'Clusters found', value: stats.total_clusters },
                  {
                    label: 'Flagged accounts',
                    value: stats.total_flagged_accounts,
                  },
                ]}
              />
            )}

            <AdminToolbar>
              <AdminSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search username…"
              />
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <AdminSelect
                  value={minScoreFilter}
                  onChange={(v) =>
                    setMinScoreFilter(v as typeof minScoreFilter)
                  }
                  options={scoreFilterOptions}
                  aria-label="Minimum score"
                  className="sm:w-48"
                />
                <AdminSelect
                  value={sortBy}
                  onChange={(v) => setSortBy(v as typeof sortBy)}
                  options={sortOptions}
                  aria-label="Sort by"
                  className="sm:w-44"
                />
              </div>
              <Button
                variant={showBannedOnly ? 'destructive' : 'outline'}
                onClick={() => setShowBannedOnly((v) => !v)}
                aria-pressed={showBannedOnly}
              >
                <Shield />
                <span className="truncate">
                  {showBannedOnly ? 'With bans only' : 'All clusters'}
                </span>
              </Button>
            </AdminToolbar>

            {filtered.length === 0 ? (
              <AdminEmptyState
                icon={GitMerge}
                title="No clusters found"
                description={
                  clusters.length > 0 ? undefined : (
                    <>
                      No accounts share signals yet. Run{' '}
                      <code className="font-mono text-xs">
                        scripts/backfillIpHistory.ts
                      </code>{' '}
                      and{' '}
                      <code className="font-mono text-xs">
                        scripts/backfillFingerprintHistory.ts
                      </code>{' '}
                      to seed history for existing users
                    </>
                  )
                }
              />
            ) : (
              <AdminTable minWidth="820px">
                <TableHeader>
                  <TableRow>
                    <TableHead>Score</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Signals
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Recent Activity
                    </TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((cluster) => {
                    const recent = mostRecentActivity(cluster);
                    return (
                      <TableRow key={cluster.id}>
                        <TableCell>
                          <ScoreBadge
                            score={cluster.score}
                            label={cluster.score_label}
                          />
                        </TableCell>
                        <TableCell>
                          <AvatarStack members={cluster.members} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <SignalIcons signals={cluster.signals} />
                        </TableCell>
                        <TableCell className="hidden text-xs whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">
                          {recent ? recent.toLocaleDateString() : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => setSelectedClusterId(cluster.id)}
                                aria-label="Review cluster"
                              >
                                <Search />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Review cluster</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </AdminTable>
            )}
          </>
        )}
      </AdminPage>

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
