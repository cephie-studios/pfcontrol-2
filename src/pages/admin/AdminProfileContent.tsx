import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Eraser, FileText, TriangleAlert } from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPage from '../../components/admin/AdminPage';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminStatCards from '../../components/admin/AdminStatCards';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import AdminToolbar from '../../components/admin/AdminToolbar';
import AdminSearchInput from '../../components/admin/AdminSearchInput';
import DeveloperDiscordAvatar from '../../components/admin/DeveloperDiscordAvatar';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import { useAdminConfirm } from '../../components/admin/useAdminConfirm';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '../../hooks/useToast';
import {
  fetchAdminProfileContent,
  adminClearUserBio,
  type AdminProfileContentUser,
} from '../../utils/fetch/adminProfileContent';

const REFRESH_ICON_MIN_SPIN_MS = 500;

export default function AdminProfileContent() {
  const { showToast, showError } = useToast();
  const { confirm, confirmDialog } = useAdminConfirm();
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
    async (userId: string) => {
      if (
        !(await confirm({
          title: "Clear this user's bio?",
          description: 'This removes it from their public profile immediately.',
          confirmText: 'Clear bio',
          destructive: true,
        }))
      )
        return;
      void withBusy(`bio:${userId}`, async () => {
        await adminClearUserBio(userId);
        setUsers((prev) => prev.filter((u) => u.userId !== userId));
        showToast('Bio cleared', 'success');
      });
    },
    [confirm, withBusy, showToast]
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
      <AdminPage
        title="Profile Content"
        icon={FileText}
        actions={
          <AdminRefreshButton
            onClick={() => void load({ headerRefresh: true })}
            loading={refreshIconBusy}
          />
        }
      >
        {loading ? (
          <AdminLoading label="Loading profile content…" />
        ) : error ? (
          <AdminErrorState
            title="Error loading profile content"
            message={error}
            onRetry={() => void load()}
          />
        ) : (
          <>
            <AdminStatCards
              columns={2}
              items={[
                {
                  label: 'Users with a bio',
                  value: users.length,
                },
                {
                  label: 'Flagged by automod',
                  value: flaggedCount,
                },
              ]}
            />

            <AdminToolbar>
              <AdminSearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by username or bio text…"
                grow
              />
            </AdminToolbar>

            {filteredUsers.length === 0 ? (
              <AdminEmptyState
                icon={FileText}
                title={
                  users.length === 0
                    ? 'No users have a bio yet.'
                    : 'No users match your search.'
                }
              />
            ) : (
              <ul className="divide-y overflow-hidden rounded-2xl border">
                {filteredUsers.map((u) => (
                  <li
                    key={u.userId}
                    className={cn(
                      'flex flex-col gap-2 px-4 py-3',
                      u.bioAutomodFlagged && 'bg-destructive/5'
                    )}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Link
                        to={`/user/${u.username}`}
                        className="flex w-fit min-w-0 items-center gap-3 hover:underline"
                      >
                        <DeveloperDiscordAvatar
                          userId={u.userId}
                          username={u.username}
                          avatar={u.avatar}
                          className="size-8"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {u.username}
                          </span>
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            {u.userId}
                          </span>
                        </span>
                      </Link>
                      <div className="flex flex-wrap items-center gap-2">
                        {u.bioAutomodFlagged && (
                          <AdminStatusBadge
                            tone="danger"
                            icon={TriangleAlert}
                            showLabel
                            className="max-w-full whitespace-normal"
                          >
                            {u.bioAutomodReason
                              ? `Flagged: ${u.bioAutomodReason}`
                              : 'Flagged'}
                          </AdminStatusBadge>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyKeys.has(`bio:${u.userId}`)}
                          onClick={() => void handleClearBio(u.userId)}
                        >
                          <Eraser />
                          Clear bio
                        </Button>
                      </div>
                    </div>

                    <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">
                      {u.bio}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </AdminPage>
      {confirmDialog}
    </AdminLayout>
  );
}
