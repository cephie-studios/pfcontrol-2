import { useState, useEffect, type ReactNode } from 'react';
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  Clock,
  Flag,
  Trash2,
} from 'lucide-react';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminModal from '../../components/admin/AdminModal';
import AdminPage from '../../components/admin/AdminPage';
import AdminSelect from '../../components/admin/AdminSelect';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import AdminToolbar from '../../components/admin/AdminToolbar';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminTable from '../../components/admin/AdminTable';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import { useAdminConfirm } from '../../components/admin/useAdminConfirm';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  fetchChatReports,
  updateChatReportStatus,
  deleteChatReport,
  type ChatReport,
} from '../../utils/fetch/admin';

const DEFAULT_AVATAR = '/assets/app/default/avatar.webp';

function reporterName(report: ChatReport) {
  return report.reporter_user_id === 'automod'
    ? 'Automod'
    : report.reporter_username || 'Unknown';
}

function reporterAlt(report: ChatReport) {
  return report.reporter_user_id === 'automod'
    ? 'Automod'
    : report.reporter_username || report.reporter_user_id;
}

function UserCell({
  src,
  alt,
  name,
  id,
}: {
  src: string;
  alt: string;
  name: string;
  id?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <img src={src} alt={alt} className="size-7 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{name}</span>
        {id ? (
          <span className="truncate font-mono text-xs text-muted-foreground">
            {id}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm break-words">{children}</dd>
    </div>
  );
}

export default function AdminChatReports() {
  const [reports, setReports] = useState<ChatReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filterReporter, setFilterReporter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<ChatReport | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const { confirm, confirmDialog } = useAdminConfirm();

  const filterOptions = [
    { value: 'all', label: 'All Reports' },
    { value: 'automod', label: 'Automod Only' },
    { value: 'user', label: 'User Reports Only' },
  ];

  useEffect(() => {
    fetchReports();
  }, [page, filterReporter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchChatReports(
        page,
        limit,
        filterReporter === 'all' ? undefined : filterReporter
      );
      setReports(data.reports);
      setTotalPages(data.pagination.pages);
      setTotal(
        typeof data.pagination.total === 'number' ? data.pagination.total : null
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch reports';
      setError(errorMessage);
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = (report: ChatReport) => {
    setSelectedReport(report);
    setShowModal(true);
  };

  const handleDismissReport = async (reportId: number) => {
    if (
      !(await confirm({
        title: 'Dismiss this report?',
        description:
          'Are you sure you want to dismiss this report? It will be permanently removed.',
        confirmText: 'Dismiss report',
        destructive: true,
      }))
    )
      return;
    try {
      await deleteChatReport(reportId);
      setToast({ message: 'Report dismissed', type: 'success' });
      fetchReports();
    } catch {
      setToast({ message: 'Failed to dismiss report', type: 'error' });
    }
  };

  const handleMarkResolved = async (reportId: number) => {
    try {
      await updateChatReportStatus(reportId, 'resolved');
      setToast({ message: 'Report marked as resolved', type: 'success' });
      fetchReports();
    } catch {
      setToast({ message: 'Failed to update report', type: 'error' });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const filteredReports = reports.filter(
    (r) =>
      !search ||
      r.message.toLowerCase().includes(search.toLowerCase()) ||
      r.reported_user_id.includes(search)
  );

  const renderStatus = (report: ChatReport, showLabel = false) => {
    const status = report.status || 'pending';
    return (
      <AdminStatusBadge
        status={status}
        icon={
          status === 'resolved'
            ? CheckCircle2
            : status === 'pending'
              ? Clock
              : undefined
        }
        showLabel={showLabel}
        className="capitalize"
      >
        {status}
      </AdminStatusBadge>
    );
  };

  const renderRowActions = (report: ChatReport) => (
    <div className="flex items-center justify-end gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="View details"
            onClick={() => handleViewReport(report)}
          >
            <Eye />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View details</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mark resolved"
            onClick={() => handleMarkResolved(report.id)}
          >
            <CheckCircle2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Mark resolved</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss report"
            className="text-destructive hover:text-destructive"
            onClick={() => handleDismissReport(report.id)}
          >
            <Trash2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Dismiss report</TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPage
        title="Chat Reports"
        icon={Flag}
        actions={
          <AdminRefreshButton onClick={fetchReports} loading={loading} />
        }
      >
        <AdminToolbar>
          <AdminSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by message or user…"
            loading={loading}
          />
          <AdminSelect
            options={filterOptions}
            value={filterReporter}
            onChange={setFilterReporter}
            placeholder="Filter by reporter…"
            aria-label="Filter by reporter"
            className="sm:ml-auto"
          />
        </AdminToolbar>

        {loading ? (
          <AdminLoading label="Loading reports…" />
        ) : error ? (
          <AdminErrorState
            title="Error loading reports"
            message={error}
            onRetry={fetchReports}
          />
        ) : (
          <>
            {filteredReports.length === 0 ? (
              <AdminEmptyState icon={Flag} title="No reports" />
            ) : (
              <>
                <div className="hidden lg:block">
                  <AdminTable minWidth="800px">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reporter</TableHead>
                        <TableHead>Reported User</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead className="w-28 text-right">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell>
                            <UserCell
                              src={report.avatar || DEFAULT_AVATAR}
                              alt={reporterAlt(report)}
                              name={reporterName(report)}
                              id={
                                report.reporter_user_id !== 'automod'
                                  ? report.reporter_user_id
                                  : undefined
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <UserCell
                              src={report.reported_avatar || DEFAULT_AVATAR}
                              alt={
                                report.reported_username ||
                                report.reported_user_id
                              }
                              name={report.reported_username || 'Unknown'}
                              id={report.reported_user_id}
                            />
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {report.message}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {report.reason}
                          </TableCell>
                          <TableCell>{renderStatus(report)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">
                            {formatTimestamp(report.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            {renderRowActions(report)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </AdminTable>
                </div>

                <div className="divide-y rounded-2xl border lg:hidden">
                  {filteredReports.map((report) => (
                    <div key={report.id} className="grid gap-3 p-4 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="grid min-w-0 gap-2">
                          <UserCell
                            src={report.avatar || DEFAULT_AVATAR}
                            alt={reporterAlt(report)}
                            name={reporterName(report)}
                            id={
                              report.reporter_user_id !== 'automod'
                                ? report.reporter_user_id
                                : undefined
                            }
                          />
                          <UserCell
                            src={report.reported_avatar || DEFAULT_AVATAR}
                            alt={
                              report.reported_username ||
                              report.reported_user_id
                            }
                            name={report.reported_username || 'Unknown'}
                            id={report.reported_user_id}
                          />
                        </div>
                        {renderRowActions(report)}
                      </div>

                      <p>
                        <span className="text-muted-foreground">Message:</span>{' '}
                        {report.message}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Reason:</span>{' '}
                        {report.reason}
                      </p>

                      <div className="flex items-center justify-between gap-2">
                        {renderStatus(report)}
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatTimestamp(report.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex flex-col items-center justify-end gap-2 sm:flex-row sm:gap-4">
              <p className="text-sm text-muted-foreground tabular-nums">
                Page {page} of {totalPages}
                {total !== null ? ` · ${total.toLocaleString()} total` : ''}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  variant="outline"
                  size="sm"
                >
                  <ChevronLeft />
                  Previous
                </Button>
                <Button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  variant="outline"
                  size="sm"
                >
                  Next
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </>
        )}
      </AdminPage>

      <AdminModal
        open={showModal && !!selectedReport}
        onClose={() => setShowModal(false)}
        title="Report Details"
        size="lg"
        footer={
          selectedReport ? (
            <>
              <Button
                onClick={() => {
                  setShowModal(false);
                  window.location.href = `/admin/bans?userId=${selectedReport.reported_user_id}&username=${encodeURIComponent(selectedReport.reported_username || '')}&reason=${encodeURIComponent(selectedReport.reason)}`;
                }}
                variant="destructive"
                className="sm:mr-auto"
              >
                <Ban />
                Ban User
              </Button>
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Close
              </Button>
              <Button onClick={() => handleMarkResolved(selectedReport.id)}>
                <CheckCircle2 />
                Mark Resolved
              </Button>
            </>
          ) : undefined
        }
      >
        {selectedReport && (
          <>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <DetailRow label="Reporter">
                <UserCell
                  src={selectedReport.avatar || DEFAULT_AVATAR}
                  alt={reporterAlt(selectedReport)}
                  name={reporterName(selectedReport)}
                  id={
                    selectedReport.reporter_user_id !== 'automod'
                      ? selectedReport.reporter_user_id
                      : undefined
                  }
                />
              </DetailRow>
              <DetailRow label="Reported user">
                <UserCell
                  src={selectedReport.reported_avatar || DEFAULT_AVATAR}
                  alt={
                    selectedReport.reported_username ||
                    selectedReport.reported_user_id
                  }
                  name={selectedReport.reported_username || 'Unknown'}
                  id={selectedReport.reported_user_id}
                />
              </DetailRow>
              <DetailRow label="Reason">{selectedReport.reason}</DetailRow>
              <DetailRow label="Status">
                {renderStatus(selectedReport, true)}
              </DetailRow>
              <DetailRow label="Session">
                <a
                  href={`/admin/sessions?search=${selectedReport.session_id}`}
                  className="inline-flex items-center gap-1 font-mono text-xs break-all underline-offset-4 hover:underline"
                >
                  {selectedReport.session_id}
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                </a>
              </DetailRow>
              <DetailRow label="Timestamp">
                <span className="tabular-nums">
                  {formatTimestamp(selectedReport.created_at)}
                </span>
              </DetailRow>
            </dl>

            <div className="grid gap-3">
              <h3 className="text-sm font-medium">Message</h3>
              <p className="text-sm break-words whitespace-pre-wrap">
                {selectedReport.message}
              </p>
            </div>
          </>
        )}
      </AdminModal>

      {confirmDialog}
    </AdminLayout>
  );
}
