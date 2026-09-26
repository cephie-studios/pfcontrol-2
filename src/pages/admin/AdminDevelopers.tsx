import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  BarChart3,
  CheckCircle2,
  Clock,
  Code,
  FileText,
  Loader2,
  Pencil,
  ScanSearch,
  Trash2,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

const REFRESH_ICON_MIN_SPIN_MS = 500;
const APPLICATIONS_FETCH_LIMIT = 100;

import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminModal from '../../components/admin/AdminModal';
import AdminPage from '../../components/admin/AdminPage';
import AdminToolbar from '../../components/admin/AdminToolbar';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminStatCards from '../../components/admin/AdminStatCards';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import AdminTable from '../../components/admin/AdminTable';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import { useAdminConfirm } from '../../components/admin/useAdminConfirm';
import AdminDeveloperEditModal from '../../components/admin/AdminDeveloperEditModal';
import AdminDeveloperUsageModal from '../../components/admin/AdminDeveloperUsageModal';
import AdminDeveloperApplicationReviewModal from '../../components/admin/AdminDeveloperApplicationReviewModal';
import DeveloperDiscordAvatar from '../../components/admin/DeveloperDiscordAvatar';
import { ADMIN_TONE_TEXT } from '../../components/admin/adminConstants';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  fetchAdminDeveloperApplications,
  fetchAdminDevelopers,
  approveDeveloperApplication,
  rejectDeveloperApplication,
  suspendDeveloperProfile,
  reactivateDeveloperProfile,
  deleteAdminDeveloperAccount,
  type AdminDeveloperApplication,
  type AdminDeveloperSummary,
} from '../../utils/fetch/adminDevelopers';

type Section = 'applications' | 'developers';

type AppFilter = 'pending' | 'approved' | 'rejected' | 'all';

const appFilterOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All statuses' },
];

const STATUS_ICON: Record<string, LucideIcon> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  active: CheckCircle2,
  suspended: Ban,
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const SCOPE_LIST_MAX = 3;

function ScopeList({ scopes }: { scopes: string[] }) {
  if (scopes.length === 0) {
    return <span className="text-xs text-muted-foreground">N/A</span>;
  }
  const shown = scopes.slice(0, SCOPE_LIST_MAX);
  const rest = scopes.length - shown.length;
  const list = (
    <ul className="grid gap-0.5 font-mono text-xs text-muted-foreground">
      {shown.map((s) => (
        <li key={s} className="truncate">
          {s}
        </li>
      ))}
      {rest > 0 ? <li className="font-sans">+{rest} more</li> : null}
    </ul>
  );
  if (rest <= 0) return list;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div tabIndex={0} className="w-fit max-w-full cursor-default">
          {list}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <ul className="grid gap-0.5 font-mono">
          {scopes.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function RowIconAction({
  label,
  icon: Icon,
  onClick,
  disabled,
  destructive,
  busy,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  busy?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={
            destructive ? 'text-destructive hover:text-destructive' : undefined
          }
        >
          {busy ? <Loader2 className="animate-spin" /> : <Icon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function AdminDevelopers() {
  const [section, setSection] = useState<Section>('applications');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<AdminDeveloperApplication[]>(
    []
  );
  const [appFilter, setAppFilter] = useState<AppFilter>('pending');
  const [appSearch, setAppSearch] = useState('');
  const [devSearch, setDevSearch] = useState('');
  const [developers, setDevelopers] = useState<AdminDeveloperSummary[]>([]);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | string | null>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [usageUserId, setUsageUserId] = useState<string | null>(null);
  const [reviewApp, setReviewApp] = useState<AdminDeveloperApplication | null>(
    null
  );
  const [refreshIconBusy, setRefreshIconBusy] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const loadSeqRef = useRef(0);
  const refreshIconClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const { confirm, confirmDialog } = useAdminConfirm();

  const load = useCallback(
    async (opts?: { headerRefresh?: boolean; initial?: boolean }) => {
      const showPageLoader = opts?.initial === true;
      const showHeaderRefresh = opts?.headerRefresh === true;
      let seq = 0;
      let spinStartedAt = 0;

      if (showHeaderRefresh) {
        if (refreshIconClearTimerRef.current) {
          clearTimeout(refreshIconClearTimerRef.current);
          refreshIconClearTimerRef.current = null;
        }
        seq = ++loadSeqRef.current;
        spinStartedAt = Date.now();
        setRefreshIconBusy(true);
      }
      if (showPageLoader) {
        setLoading(true);
      }
      setError(null);

      try {
        const [appRes, devRes] = await Promise.all([
          fetchAdminDeveloperApplications({
            page: 1,
            limit: APPLICATIONS_FETCH_LIMIT,
          }),
          fetchAdminDevelopers(),
        ]);
        setApplications(appRes.applications);
        setDevelopers(devRes.developers);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load';
        setError(message);
        setToast({ message, type: 'error' });
      } finally {
        if (showPageLoader) {
          setLoading(false);
        }
        if (showHeaderRefresh) {
          const wait = Math.max(
            0,
            REFRESH_ICON_MIN_SPIN_MS - (Date.now() - spinStartedAt)
          );
          refreshIconClearTimerRef.current = setTimeout(() => {
            refreshIconClearTimerRef.current = null;
            if (loadSeqRef.current === seq) {
              setRefreshIconBusy(false);
            }
          }, wait);
        }
      }
    },
    []
  );

  useEffect(() => {
    void load({ initial: true });
  }, [load]);

  useEffect(
    () => () => {
      if (refreshIconClearTimerRef.current) {
        clearTimeout(refreshIconClearTimerRef.current);
        refreshIconClearTimerRef.current = null;
      }
    },
    []
  );

  const appCounts = useMemo(
    () => ({
      pending: applications.filter((a) => a.status === 'pending').length,
    }),
    [applications]
  );

  const filteredApplications = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    return applications.filter((a) => {
      if (appFilter !== 'all' && a.status !== appFilter) return false;
      if (!q) return true;
      return (
        a.username.toLowerCase().includes(q) ||
        a.userId.toLowerCase().includes(q) ||
        a.whoText.toLowerCase().includes(q) ||
        (a.whyText?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [applications, appFilter, appSearch]);

  const filteredDevelopers = useMemo(() => {
    const q = devSearch.trim().toLowerCase();
    if (!q) return developers;
    return developers.filter(
      (d) =>
        d.username.toLowerCase().includes(q) ||
        d.userId.toLowerCase().includes(q)
    );
  }, [developers, devSearch]);

  const editDeveloper = useMemo(
    () => developers.find((d) => d.userId === editUserId) ?? null,
    [developers, editUserId]
  );

  const usageDeveloper = useMemo(
    () => developers.find((d) => d.userId === usageUserId) ?? null,
    [developers, usageUserId]
  );

  const handleApproveFromReview = async (
    appId: number,
    body: {
      approvedScopes: string[];
      rateLimitPerMinute?: number | null;
      note?: string;
    }
  ) => {
    setBusyId(appId);
    try {
      await approveDeveloperApplication(appId, body);
      setReviewApp(null);
      setToast({ message: 'Application approved', type: 'success' });
      await load();
    } catch (e) {
      throw e instanceof Error ? e : new Error('Approve failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async () => {
    if (rejectId == null) return;
    setBusyId(rejectId);
    try {
      await rejectDeveloperApplication(rejectId, rejectNote);
      setRejectId(null);
      setRejectNote('');
      setToast({ message: 'Application rejected', type: 'success' });
      await load();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : 'Reject failed',
        type: 'error',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleSuspend = async (userId: string) => {
    if (
      !(await confirm({
        title: 'Suspend this developer?',
        description: 'Their API keys will stop working.',
        confirmText: 'Suspend',
        destructive: true,
      }))
    )
      return;
    setBusyId(userId);
    try {
      await suspendDeveloperProfile(userId);
      setToast({ message: 'Developer suspended', type: 'success' });
      await load();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : 'Suspend failed',
        type: 'error',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleReactivate = async (userId: string) => {
    setBusyId(userId);
    try {
      await reactivateDeveloperProfile(userId);
      setToast({ message: 'Developer reactivated', type: 'success' });
      await load();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : 'Reactivate failed',
        type: 'error',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteDeveloper = async (userId: string) => {
    if (
      !(await confirm({
        title: 'Permanently delete this developer?',
        description:
          'This removes their developer profile, all API keys, application history, and developer API usage logs. The user account itself is not deleted.',
        confirmText: 'Delete developer',
        destructive: true,
      }))
    )
      return;
    setBusyId(userId);
    try {
      await deleteAdminDeveloperAccount(userId);
      setEditUserId((cur) => (cur === userId ? null : cur));
      setToast({ message: 'Developer deleted', type: 'success' });
      await load();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : 'Delete failed',
        type: 'error',
      });
    } finally {
      setBusyId(null);
    }
  };

  const closeReject = () => {
    setRejectId(null);
    setRejectNote('');
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPage
        title="Developers"
        icon={Code}
        actions={
          <AdminRefreshButton
            onClick={() => void load({ headerRefresh: true })}
            loading={refreshIconBusy}
          />
        }
      >
        {loading ? (
          <AdminLoading label="Loading developers…" />
        ) : error ? (
          <AdminErrorState
            title="Error loading developers"
            message={error}
            onRetry={() => void load({ initial: true })}
          />
        ) : (
          <>
            <AdminStatCards
              columns={3}
              items={[
                {
                  label: 'Active developers',
                  value: developers.filter((d) => d.status === 'active').length,
                },
                {
                  label: 'Active keys',
                  value: developers.reduce((sum, d) => sum + d.keysActive, 0),
                },
                {
                  label: 'API requests',
                  value: developers.reduce(
                    (sum, d) => sum + d.requestsTotal,
                    0
                  ),
                },
              ]}
            />

            <Tabs
              value={section}
              onValueChange={(v) => setSection(v as Section)}
              className="gap-4"
            >
              <TabsList>
                <TabsTrigger value="applications">
                  Applications
                  {appCounts.pending > 0 ? (
                    <span className="text-muted-foreground tabular-nums">
                      {appCounts.pending}
                    </span>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="developers">
                  Developers
                  <span className="text-muted-foreground tabular-nums">
                    {developers.length}
                  </span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="applications" className="flex flex-col gap-4">
                <AdminToolbar>
                  <AdminSearchInput
                    value={appSearch}
                    onChange={setAppSearch}
                    placeholder="Search applications…"
                    grow
                  />
                  <AdminSelect
                    options={appFilterOptions}
                    value={appFilter}
                    onChange={(v) => setAppFilter(v as AppFilter)}
                    aria-label="Filter applications by status"
                    className="sm:w-40"
                  />
                </AdminToolbar>

                {filteredApplications.length === 0 ? (
                  <AdminEmptyState icon={FileText} title="No applications" />
                ) : (
                  <AdminTable minWidth="960px">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Applicant</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Who / why</TableHead>
                        <TableHead>Requested scopes</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredApplications.map((a) => (
                        <TableRow key={a.id} className="align-top">
                          <TableCell>
                            <p className="truncate font-medium">{a.username}</p>
                            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                              {a.userId}
                            </p>
                          </TableCell>
                          <TableCell>
                            <AdminStatusBadge
                              status={a.status}
                              icon={STATUS_ICON[a.status]}
                            >
                              {capitalize(a.status)}
                            </AdminStatusBadge>
                          </TableCell>
                          <TableCell className="max-w-xs whitespace-normal">
                            <p className="line-clamp-2 text-sm">{a.whoText}</p>
                            {a.whyText?.trim() && (
                              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                                {a.whyText}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[240px] whitespace-normal">
                            <ScopeList scopes={a.requestedScopes} />
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
                            {formatDate(a.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            {a.status === 'pending' ? (
                              <div className="flex justify-end gap-1">
                                <RowIconAction
                                  label="Review application"
                                  icon={ScanSearch}
                                  disabled={busyId === a.id}
                                  onClick={() => setReviewApp(a)}
                                />
                                <RowIconAction
                                  label="Reject application"
                                  icon={X}
                                  destructive
                                  disabled={busyId === a.id}
                                  onClick={() => setRejectId(a.id)}
                                />
                              </div>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </AdminTable>
                )}
              </TabsContent>

              <TabsContent value="developers" className="flex flex-col gap-4">
                <AdminToolbar>
                  <AdminSearchInput
                    value={devSearch}
                    onChange={setDevSearch}
                    placeholder="Search developers…"
                    grow
                  />
                </AdminToolbar>

                {filteredDevelopers.length === 0 ? (
                  <AdminEmptyState icon={Users} title="No developers" />
                ) : (
                  <AdminTable minWidth="760px">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Developer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Keys</TableHead>
                        <TableHead>Requests</TableHead>
                        <TableHead>Last activity</TableHead>
                        <TableHead className="text-right">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDevelopers.map((d) => (
                        <TableRow key={d.userId}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <DeveloperDiscordAvatar
                                userId={d.userId}
                                username={d.username}
                                avatar={d.avatar}
                              />
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {d.username}
                                </p>
                                <p className="truncate font-mono text-xs text-muted-foreground">
                                  {d.userId}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <AdminStatusBadge
                              status={d.status}
                              icon={STATUS_ICON[d.status]}
                            >
                              {capitalize(d.status)}
                            </AdminStatusBadge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-medium tabular-nums">
                                {d.keysActive}
                              </span>
                              {d.keysPending > 0 && (
                                <span
                                  className={`tabular-nums ${ADMIN_TONE_TEXT.warning}`}
                                >
                                  {d.keysPending} pending
                                </span>
                              )}
                              <span className="text-muted-foreground tabular-nums">
                                ({d.keysTotal} total)
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {d.requestsTotal.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {d.lastApiActivity
                                ? new Date(
                                    d.lastApiActivity
                                  ).toLocaleDateString()
                                : 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <RowIconAction
                                label="Edit scopes & keys"
                                icon={Pencil}
                                onClick={() => setEditUserId(d.userId)}
                              />
                              <RowIconAction
                                label="View usage"
                                icon={BarChart3}
                                onClick={() => setUsageUserId(d.userId)}
                              />
                              <RowIconAction
                                label="Delete developer"
                                icon={Trash2}
                                destructive
                                busy={busyId === d.userId}
                                disabled={busyId === d.userId}
                                onClick={() =>
                                  void handleDeleteDeveloper(d.userId)
                                }
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </AdminTable>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </AdminPage>

      {reviewApp && (
        <AdminDeveloperApplicationReviewModal
          open
          application={reviewApp}
          busy={busyId === reviewApp.id}
          onClose={() => setReviewApp(null)}
          onApprove={(body) => handleApproveFromReview(reviewApp.id, body)}
          onRequestReject={() => {
            setRejectId(reviewApp.id);
            setReviewApp(null);
          }}
        />
      )}

      <AdminModal
        open={rejectId != null}
        onClose={closeReject}
        title="Reject application"
        size="sm"
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeReject}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectId != null && busyId === rejectId}
              onClick={() => void handleReject()}
            >
              {rejectId != null && busyId === rejectId ? (
                <Loader2 className="animate-spin" />
              ) : null}
              Reject
            </Button>
          </>
        }
      >
        <div className="grid gap-2">
          <Label htmlFor="admin-dev-reject-note">Note</Label>
          <Textarea
            id="admin-dev-reject-note"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Optional note to the applicant"
            rows={3}
            className="resize-none"
          />
        </div>
      </AdminModal>

      {editUserId && editDeveloper && (
        <AdminDeveloperEditModal
          developer={editDeveloper}
          onReload={load}
          onClose={() => setEditUserId(null)}
          onProfileSuspend={() => void handleSuspend(editDeveloper.userId)}
          onProfileReactivate={() =>
            void handleReactivate(editDeveloper.userId)
          }
          profileActionBusy={busyId === editDeveloper.userId}
          onDeleteDeveloper={() =>
            void handleDeleteDeveloper(editDeveloper.userId)
          }
          deleteDeveloperBusy={busyId === editDeveloper.userId}
        />
      )}

      {usageUserId && usageDeveloper && (
        <AdminDeveloperUsageModal
          developer={usageDeveloper}
          onClose={() => setUsageUserId(null)}
        />
      )}

      {confirmDialog}
    </AdminLayout>
  );
}
