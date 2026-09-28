import { useCallback, useEffect, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Flag,
  Loader2,
  RotateCcw,
  UserRound,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPage from '../../components/admin/AdminPage';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import AdminTable from '../../components/admin/AdminTable';
import AdminToolbar from '../../components/admin/AdminToolbar';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import { useAdminConfirm } from '../../components/admin/useAdminConfirm';
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
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { minDuration } from '@/lib/minDuration';
import {
  fetchAdminClaimReports,
  updateAdminClaimReport,
  type AdminClaimReport,
  type ClaimReportStatus,
} from '../../utils/fetch/admin/sessionClaimReports';
import { revokeAdminDeveloperKey } from '../../utils/fetch/adminDevelopers';

const LIMIT = 25;

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All reports' },
];

const STATUS_ICON: Record<ClaimReportStatus, LucideIcon> = {
  open: Flag,
  resolved: CheckCircle2,
  dismissed: CircleDashed,
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function IconAction({
  label,
  icon: Icon,
  onClick,
  busy,
  disabled,
  destructive,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled || busy}
          onClick={onClick}
          className={
            destructive
              ? 'cursor-pointer text-destructive hover:text-destructive'
              : 'cursor-pointer'
          }
        >
          {busy ? <Loader2 className="animate-spin" /> : <Icon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="shadcn-scope">{label}</TooltipContent>
    </Tooltip>
  );
}

function ReporterCell({ r }: { r: AdminClaimReport }) {
  const name = r.reporterUsername ?? r.reporterId;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-7">
        {r.reporterAvatar ? (
          <AvatarImage
            src={`https://cdn.discordapp.com/avatars/${r.reporterId}/${r.reporterAvatar}.png`}
            alt={name}
          />
        ) : null}
        <AvatarFallback>
          <UserRound className="size-4 text-zinc-500" />
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </div>
  );
}

function AppCell({ r }: { r: AdminClaimReport }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">{r.requesterName}</p>
      <p className="truncate text-xs text-muted-foreground">
        {r.developerUsername ?? r.developerUserId}
        {r.keyName ? ` · ${r.keyName}` : ''}
        {r.keyRevoked ? (
          <span className="text-red-500"> · key revoked</span>
        ) : null}
      </p>
    </div>
  );
}

export default function AdminClaimReports() {
  const [reports, setReports] = useState<AdminClaimReport[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [status, setStatus] = useState<ClaimReportStatus | 'all'>('open');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { confirm, confirmDialog } = useAdminConfirm();

  useEffect(() => {
    if (search === debouncedSearch) return;
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search, debouncedSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminClaimReports({
        status,
        page,
        limit: LIMIT,
        search: debouncedSearch || undefined,
      });
      setReports(data.reports);
      setOpenCount(data.openCount);
      setPages(data.pagination.pages);
      setTotal(data.pagination.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [status, page, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const setReportStatus = async (
    r: AdminClaimReport,
    next: ClaimReportStatus
  ) => {
    setBusy(`${r.id}:${next}`);
    try {
      await minDuration(updateAdminClaimReport(r.id, next));
      toast.success(next === 'open' ? 'Report reopened' : `Report ${next}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update report');
    } finally {
      setBusy(null);
    }
  };

  const revokeKey = async (r: AdminClaimReport) => {
    await confirm({
      title: `Revoke ${r.requesterName}'s key?`,
      description: `The key${r.keyName ? ` "${r.keyName}"` : ''} stops working immediately, including every session claim it holds. Open reports for it are marked resolved.`,
      confirmText: 'Revoke key',
      destructive: true,
      action: async () => {
        try {
          await minDuration(
            revokeAdminDeveloperKey(r.developerUserId, r.keyId)
          );
          toast.success('Key revoked');
          await load();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Failed to revoke key');
          throw e;
        }
      },
    });
  };

  const renderActions = (r: AdminClaimReport) => (
    <div className="flex items-center justify-end gap-1">
      {r.status === 'open' ? (
        <>
          <IconAction
            label="Mark resolved"
            icon={CheckCircle2}
            busy={busy === `${r.id}:resolved`}
            disabled={busy !== null}
            onClick={() => void setReportStatus(r, 'resolved')}
          />
          <IconAction
            label="Dismiss"
            icon={XCircle}
            busy={busy === `${r.id}:dismissed`}
            disabled={busy !== null}
            onClick={() => void setReportStatus(r, 'dismissed')}
          />
        </>
      ) : (
        <IconAction
          label="Reopen"
          icon={RotateCcw}
          busy={busy === `${r.id}:open`}
          disabled={busy !== null}
          onClick={() => void setReportStatus(r, 'open')}
        />
      )}
      {!r.keyRevoked ? (
        <IconAction
          label="Revoke key"
          icon={Ban}
          destructive
          disabled={busy !== null}
          onClick={() => void revokeKey(r)}
        />
      ) : null}
    </div>
  );

  const statusBadge = (r: AdminClaimReport) => (
    <AdminStatusBadge
      tone={
        r.status === 'open'
          ? 'warning'
          : r.status === 'resolved'
            ? 'success'
            : 'neutral'
      }
      icon={STATUS_ICON[r.status]}
      showLabel
    >
      {capitalize(r.status)}
    </AdminStatusBadge>
  );

  return (
    <AdminLayout>
      <TooltipProvider>
        <AdminPage
          title="Claim Reports"
          icon={Flag}
          description={`Controllers report apps that keep asking to take over their session's ACARS. ${openCount.toLocaleString()} open.`}
          actions={
            <AdminRefreshButton onClick={() => void load()} loading={loading} />
          }
        >
          <AdminToolbar>
            <AdminSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search app, developer, reporter or session…"
              loading={search !== debouncedSearch || loading}
            />
            <AdminSelect
              options={STATUS_OPTIONS}
              value={status}
              onChange={(v) => {
                setStatus(v as ClaimReportStatus | 'all');
                setPage(1);
              }}
              aria-label="Status"
              className="sm:w-44"
            />
          </AdminToolbar>

          {!loaded ? (
            <AdminLoading label="Loading reports…" />
          ) : error ? (
            <AdminErrorState
              title="Error loading reports"
              message={error}
              onRetry={() => void load()}
            />
          ) : reports.length === 0 ? (
            <AdminEmptyState
              icon={Flag}
              title={
                debouncedSearch
                  ? 'No reports match your search'
                  : status === 'open'
                    ? 'No open reports'
                    : 'No reports yet'
              }
            />
          ) : (
            <>
              <AdminTable className="hidden md:block" minWidth="900px">
                <TableHeader>
                  <TableRow>
                    <TableHead>App</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Reported by</TableHead>
                    <TableHead className="text-right">Requests (24h)</TableHead>
                    <TableHead className="text-right">Reports on key</TableHead>
                    <TableHead>Reported</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-56">
                        <AppCell r={r} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.sessionId}
                      </TableCell>
                      <TableCell className="max-w-48">
                        <ReporterCell r={r} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.attempts24h}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.keyReportCount}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {new Date(r.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{statusBadge(r)}</TableCell>
                      <TableCell className="text-right">
                        {renderActions(r)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </AdminTable>

              <div className="divide-y rounded-2xl border md:hidden">
                {reports.map((r) => (
                  <div key={r.id} className="grid gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <AppCell r={r} />
                      {renderActions(r)}
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
                      <dt className="text-muted-foreground">Session</dt>
                      <dd className="font-mono text-xs">{r.sessionId}</dd>
                      <dt className="text-muted-foreground">Reported by</dt>
                      <dd className="min-w-0">
                        <ReporterCell r={r} />
                      </dd>
                      <dt className="text-muted-foreground">Requests (24h)</dt>
                      <dd className="tabular-nums">{r.attempts24h}</dd>
                      <dt className="text-muted-foreground">Reports on key</dt>
                      <dd className="tabular-nums">{r.keyReportCount}</dd>
                      <dt className="text-muted-foreground">Reported</dt>
                      <dd className="tabular-nums">
                        {new Date(r.createdAt).toLocaleString()}
                      </dd>
                      <dt className="text-muted-foreground">Status</dt>
                      <dd>{statusBadge(r)}</dd>
                    </dl>
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-center justify-end gap-3 sm:flex-row">
                <p className="text-sm text-muted-foreground tabular-nums">
                  Page {page} of {Math.max(1, pages)} · {total.toLocaleString()}{' '}
                  total
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => setPage(Math.min(pages, page + 1))}
                    disabled={page >= pages}
                  >
                    Next
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </>
          )}
        </AdminPage>
      </TooltipProvider>
      {confirmDialog}
    </AdminLayout>
  );
}
