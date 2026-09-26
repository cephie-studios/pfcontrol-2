import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  BellRing,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  MailOpen,
  Send,
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPage from '../../components/admin/AdminPage';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import AdminSection from '../../components/admin/AdminSection';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import AdminTable from '../../components/admin/AdminTable';
import AdminToolbar from '../../components/admin/AdminToolbar';
import DeveloperDiscordAvatar from '../../components/admin/DeveloperDiscordAvatar';
import {
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { useToast } from '../../hooks/useToast';
import {
  fetchAdminUserAlerts,
  sendAdminUserAlert,
  type AdminUserAlert,
} from '../../utils/fetch/adminUserAlerts';

const REFRESH_ICON_MIN_SPIN_MS = 500;
const PAGE_SIZE = 50;

export default function AdminUserAlerts() {
  const { showToast, showError } = useToast();
  const [alerts, setAlerts] = useState<AdminUserAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIconBusy, setRefreshIconBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const [recipient, setRecipient] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const isDiscordId = (s: string) => /^\d{15,20}$/.test(s);

  const load = useCallback(
    async (opts?: { headerRefresh?: boolean; page?: number }) => {
      const showHeaderRefresh = opts?.headerRefresh === true;
      const targetPage = opts?.page ?? page;
      const spinStartedAt = Date.now();
      if (showHeaderRefresh) setRefreshIconBusy(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchAdminUserAlerts(
          targetPage,
          PAGE_SIZE,
          debouncedSearch
        );
        setAlerts(data.alerts);
        setTotalPages(data.pagination.pages);
        setTotal(data.pagination.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (showHeaderRefresh) {
          const wait = Math.max(
            0,
            REFRESH_ICON_MIN_SPIN_MS - (Date.now() - spinStartedAt)
          );
          setTimeout(() => setRefreshIconBusy(false), wait);
        } else {
          setLoading(false);
        }
      }
    },
    [page, debouncedSearch]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    const target = recipient.trim();
    if (!target || !title.trim() || !message.trim()) {
      showError('Username or user ID, title, and message are all required.');
      return;
    }
    setSending(true);
    try {
      await sendAdminUserAlert(
        isDiscordId(target)
          ? { userId: target, title: title.trim(), message: message.trim() }
          : { username: target, title: title.trim(), message: message.trim() }
      );
      showToast(`Alert sent to ${target}`, 'success');
      setRecipient('');
      setTitle('');
      setMessage('');
      setPage(1);
      await load({ page: 1 });
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to send alert');
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout>
      <AdminPage
        title="User Alerts"
        icon={BellRing}
        actions={
          <AdminRefreshButton
            onClick={() => void load({ headerRefresh: true })}
            loading={refreshIconBusy}
          />
        }
      >
        <AdminSection title="Send a new alert">
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="user-alert-recipient">Recipient</Label>
                <Input
                  id="user-alert-recipient"
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Username or User ID"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="user-alert-title">Title</Label>
                <Input
                  id="user-alert-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-alert-message">Message</Label>
              <div className="relative">
                <Textarea
                  id="user-alert-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="min-h-24 resize-none pb-12"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={sending}
                  onClick={() => void handleSend()}
                  className="absolute right-2 bottom-2"
                >
                  {sending ? <Loader2 className="animate-spin" /> : <Send />}
                  {sending ? 'Sending…' : 'Send alert'}
                </Button>
              </div>
            </div>
          </div>
        </AdminSection>

        <AdminSection
          title="Sent alerts"
          contentClassName="flex flex-col gap-4"
        >
          <AdminToolbar>
            <AdminSearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Search by user, title, or message…"
              loading={loading && search !== debouncedSearch}
            />
          </AdminToolbar>

          {loading ? (
            <AdminLoading label="Loading alerts…" />
          ) : error ? (
            <AdminErrorState
              title="Error loading alerts"
              message={error}
              onRetry={() => void load()}
            />
          ) : (
            <>
              <AdminTable minWidth="700px">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">User</TableHead>
                    <TableHead>Alert</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead className="w-12 px-4">
                      <span className="sr-only">Details</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={5}
                        className="py-12 text-center text-muted-foreground"
                      >
                        {debouncedSearch
                          ? 'No alerts match your search.'
                          : 'No alerts sent yet.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    alerts.map((a) => {
                      const isExpanded = expandedIds.has(a.id);
                      const toggleLabel = isExpanded ? 'Collapse' : 'Expand';
                      return (
                        <Fragment key={a.id}>
                          <TableRow>
                            <TableCell className="px-4">
                              <div className="flex items-center gap-2">
                                <DeveloperDiscordAvatar
                                  userId={a.user_id}
                                  username={a.username}
                                  avatar={a.avatar}
                                  className="size-7"
                                />
                                <span className="font-medium">
                                  {a.username}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-sm whitespace-normal">
                              <p className="truncate">{a.title}</p>
                              <p className="line-clamp-1 text-xs text-muted-foreground">
                                {a.message}
                              </p>
                            </TableCell>
                            <TableCell>
                              <AdminStatusBadge
                                tone={a.read ? 'neutral' : 'warning'}
                                icon={a.read ? MailOpen : Mail}
                              >
                                {a.read ? 'Read' : 'Unread'}
                              </AdminStatusBadge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground tabular-nums">
                              {new Date(a.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="px-4 text-right">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => toggleExpanded(a.id)}
                                    aria-label={toggleLabel}
                                    aria-expanded={isExpanded}
                                  >
                                    <ChevronDown
                                      className={cn(
                                        'transition-transform',
                                        isExpanded && 'rotate-180'
                                      )}
                                    />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{toggleLabel}</TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell
                                colSpan={5}
                                className="px-4 py-3 whitespace-normal"
                              >
                                <div className="grid gap-2">
                                  <p className="text-xs text-muted-foreground">
                                    Issued by:{' '}
                                    <span className="text-foreground">
                                      {a.issued_by_admin_username ?? 'System'}
                                    </span>
                                  </p>
                                  <p className="text-sm break-words whitespace-pre-wrap">
                                    {a.message}
                                  </p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </TableBody>
              </AdminTable>

              <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-end">
                <p className="text-sm text-muted-foreground tabular-nums">
                  Page {page} of {totalPages} · {total.toLocaleString()} total
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronLeft />
                    Previous
                  </Button>
                  <Button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
        </AdminSection>
      </AdminPage>
    </AdminLayout>
  );
}
