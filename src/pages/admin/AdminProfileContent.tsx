import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { MdArticle, MdWarning } from 'react-icons/md';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminToolbar from '../../components/admin/AdminToolbar';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import DeveloperDiscordAvatar from '../../components/admin/DeveloperDiscordAvatar';
import Loader from '../../components/common/Loader';
import ErrorScreen from '../../components/common/ErrorScreen';
import Button from '../../components/common/Button';
import { useToast } from '../../hooks/useToast';
import {
  fetchAdminProfileContent,
  adminClearUserBio,
  type AdminProfileContentUser,
} from '../../utils/fetch/adminProfileContent';

const REFRESH_ICON_MIN_SPIN_MS = 500;

export default function AdminProfileContent() {
  const { showToast, showError } = useToast();
  const [users, setUsers] = useState<AdminProfileContentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [refreshIconBusy, setRefreshIconBusy] = useState(false);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());

  const load = useCallback(async (opts?: { headerRefresh?: boolean }) => {
    const showHeaderRefresh = opts?.headerRefresh === true;
    const spinStartedAt = Date.now();
    if (showHeaderRefresh) setRefreshIconBusy(true);
    else setLoading(true);
    setError(null);
    try {
      const { users } = await fetchAdminProfileContent();
      setUsers(users);
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

  const withBusy = useCallback(
    async (key: string, fn: () => Promise<void>) => {
      setBusyKeys((prev) => new Set(prev).add(key));
      try {
        await fn();
      } catch (e) {
        showError(e instanceof Error ? e.message : 'Action failed');
      } finally {
        setBusyKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [showError]
  );

  const handleClearBio = useCallback(
    (userId: string) => {
      if (
        !confirm(
          "Clear this user's bio? This removes it from their public profile immediately."
        )
      )
        return;
      void withBusy(`bio:${userId}`, async () => {
        await adminClearUserBio(userId);
        setUsers((prev) => prev.filter((u) => u.userId !== userId));
        showToast('Bio cleared', 'success');
      });
    },
    [withBusy, showToast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q) ||
        u.bio.toLowerCase().includes(q)
    );
  }, [users, search]);

  const flaggedCount = useMemo(
    () => users.filter((u) => u.bioAutomodFlagged).length,
    [users]
  );

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Profile Content"
        icon={MdArticle}
        accent="blue"
        actions={
          <AdminRefreshButton
            onClick={() => void load({ headerRefresh: true })}
            loading={refreshIconBusy}
          />
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader />
        </div>
      ) : error ? (
        <ErrorScreen
          title="Error loading profile content"
          message={error}
          onRetry={() => void load()}
        />
      ) : (
        <>
          <p className="text-xs text-zinc-500 mb-4">
            {users.length} user{users.length === 1 ? '' : 's'} with a bio ·{' '}
            {flaggedCount} flagged by automod.
          </p>

          <AdminToolbar>
            <AdminSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by username or bio text…"
              grow
            />
          </AdminToolbar>

          {filteredUsers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-12 text-center">
              <p className="text-sm text-zinc-500">
                {users.length === 0
                  ? 'No users have a bio yet.'
                  : 'No users match your search.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {filteredUsers.map((u) => (
                <li
                  key={u.userId}
                  className={`rounded-2xl border p-4 ${
                    u.bioAutomodFlagged
                      ? 'border-red-800/60 bg-red-950/10'
                      : 'border-zinc-800 bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <Link
                      to={`/user/${u.username}`}
                      className="flex items-center gap-3 group/link w-fit"
                    >
                      <DeveloperDiscordAvatar
                        userId={u.userId}
                        username={u.username}
                        avatar={u.avatar}
                        className="h-9 w-9"
                      />
                      <div>
                        <p className="font-medium text-zinc-100 group-hover/link:text-blue-400 transition-colors">
                          {u.username}
                        </p>
                        <p className="text-[11px] text-zinc-500 font-mono">
                          {u.userId}
                        </p>
                      </div>
                    </Link>
                    {u.bioAutomodFlagged && (
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-1 text-[11px] font-medium text-red-300">
                        <MdWarning className="w-3.5 h-3.5" />
                        Flagged
                        {u.bioAutomodReason ? `: ${u.bioAutomodReason}` : ''}
                      </span>
                    )}
                  </div>

                  <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3">
                    <p className="text-sm text-zinc-300 whitespace-pre-wrap mb-2">
                      {u.bio}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyKeys.has(`bio:${u.userId}`)}
                      onClick={() => handleClearBio(u.userId)}
                    >
                      Clear bio
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AdminLayout>
  );
}
