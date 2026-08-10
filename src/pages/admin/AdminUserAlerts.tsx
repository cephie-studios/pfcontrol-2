import { useCallback, useEffect, useState } from 'react';
import { MdNotificationsActive } from 'react-icons/md';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminTable from '../../components/admin/AdminTable';
import DeveloperDiscordAvatar from '../../components/admin/DeveloperDiscordAvatar';
import {
  ADMIN_TABLE_HEAD,
  ADMIN_TH,
  ADMIN_TD,
} from '../../components/admin/adminConstants';
import Loader from '../../components/common/Loader';
import Button from '../../components/common/Button';
import ErrorScreen from '../../components/common/ErrorScreen';
import { useToast } from '../../hooks/useToast';
import {
  fetchAdminUserAlerts,
  sendAdminUserAlert,
  type AdminUserAlert,
} from '../../utils/fetch/adminUserAlerts';

const REFRESH_ICON_MIN_SPIN_MS = 500;

export default function AdminUserAlerts() {
  const { showToast, showError } = useToast();
  const [alerts, setAlerts] = useState<AdminUserAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIconBusy, setRefreshIconBusy] = useState(false);

  const [recipient, setRecipient] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const isDiscordId = (s: string) => /^\d{15,20}$/.test(s);

  const load = useCallback(async (opts?: { headerRefresh?: boolean }) => {
    const showHeaderRefresh = opts?.headerRefresh === true;
    const spinStartedAt = Date.now();
    if (showHeaderRefresh) setRefreshIconBusy(true);
    else setLoading(true);
    setError(null);
    try {
      const { alerts } = await fetchAdminUserAlerts();
      setAlerts(alerts);
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      await load();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to send alert');
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        title="User Alerts"
        icon={MdNotificationsActive}
        accent="cyan"
        actions={
          <AdminRefreshButton
            onClick={() => void load({ headerRefresh: true })}
            loading={refreshIconBusy}
          />
        }
      />

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 mb-6 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-200">
          Send a new alert
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Username or User ID"
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600/40"
          />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600/40"
          />
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message the user will see"
          rows={3}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-600/40 resize-none"
        />
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={sending}
          onClick={() => void handleSend()}
        >
          Send alert
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader />
        </div>
      ) : error ? (
        <ErrorScreen
          title="Error loading alerts"
          message={error}
          onRetry={() => void load()}
        />
      ) : (
        <AdminTable minWidth="700px">
          <thead className={ADMIN_TABLE_HEAD}>
            <tr>
              <th className={ADMIN_TH}>User</th>
              <th className={ADMIN_TH}>Alert</th>
              <th className={ADMIN_TH}>Status</th>
              <th className={ADMIN_TH}>Sent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {alerts.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className={`${ADMIN_TD} text-center text-zinc-500 py-12`}
                >
                  No alerts sent yet.
                </td>
              </tr>
            ) : (
              alerts.map((a) => (
                <tr key={a.id} className="hover:bg-zinc-800/30">
                  <td className={ADMIN_TD}>
                    <div className="flex items-center gap-2">
                      <DeveloperDiscordAvatar
                        userId={a.user_id}
                        username={a.username}
                        avatar={a.avatar}
                        className="h-7 w-7"
                      />
                      <span className="text-sm text-zinc-200">
                        {a.username}
                      </span>
                    </div>
                  </td>
                  <td className={`${ADMIN_TD} max-w-sm`}>
                    <p className="text-sm text-zinc-200 truncate">
                      {a.title}
                    </p>
                    <p className="text-xs text-zinc-500 line-clamp-1">
                      {a.message}
                    </p>
                  </td>
                  <td className={ADMIN_TD}>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                        a.read
                          ? 'bg-zinc-800 text-zinc-400'
                          : 'bg-amber-950/50 text-amber-200 ring-1 ring-amber-800/35'
                      }`}
                    >
                      {a.read ? 'Read' : 'Unread'}
                    </span>
                  </td>
                  <td
                    className={`${ADMIN_TD} text-xs text-zinc-500 whitespace-nowrap`}
                  >
                    {new Date(a.created_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>
      )}
    </AdminLayout>
  );
}
