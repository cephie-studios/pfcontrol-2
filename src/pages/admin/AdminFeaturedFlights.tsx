import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  CircleDot,
  EyeOff,
  Image as ImageIcon,
  Plane,
  X,
} from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPage from '../../components/admin/AdminPage';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';
import AdminSection from '../../components/admin/AdminSection';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '../../hooks/useToast';
import {
  fetchAdminFeaturedFlights,
  adminUnfeatureFlight,
  adminDeleteFeaturedFlightImage,
  type AdminFeaturedFlight,
} from '../../utils/fetch/adminFeaturedFlights';

const REFRESH_ICON_MIN_SPIN_MS = 500;

type UserGroup = {
  userId: string;
  username: string;
  avatar: string | null;
  flights: AdminFeaturedFlight[];
  latestUpdatedAt: string;
};

export default function AdminFeaturedFlights() {
  const { showToast, showError } = useToast();
  const { confirm, confirmDialog } = useAdminConfirm();
  const [flights, setFlights] = useState<AdminFeaturedFlight[]>([]);
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
      const { flights } = await fetchAdminFeaturedFlights();
      setFlights(flights);
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

  const handleUnfeature = useCallback(
    async (userId: string, flightId: string) => {
      if (
        !(await confirm({
          title: 'Unfeature this flight?',
          description:
            'It will disappear from the user’s public profile immediately.',
          confirmText: 'Unfeature',
          destructive: true,
        }))
      )
        return;
      void withBusy(`unfeature:${flightId}`, async () => {
        await adminUnfeatureFlight(userId, flightId);
        setFlights((prev) => prev.filter((f) => f.id !== flightId));
        showToast('Flight unfeatured', 'success');
      });
    },
    [confirm, withBusy, showToast]
  );

  const handleDeleteImage = useCallback(
    async (userId: string, flightId: string, cephieId: string) => {
      if (
        !(await confirm({
          title: 'Delete this image?',
          description: 'This cannot be undone.',
          confirmText: 'Delete',
          destructive: true,
        }))
      )
        return;
      void withBusy(`image:${cephieId}`, async () => {
        await adminDeleteFeaturedFlightImage(userId, flightId, cephieId);
        setFlights((prev) =>
          prev.map((f) =>
            f.id !== flightId
              ? f
              : {
                  ...f,
                  snapImages: f.snapImages.filter(
                    (s) => s.cephie_id !== cephieId
                  ),
                }
          )
        );
        showToast('Image deleted', 'success');
      });
    },
    [confirm, withBusy, showToast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo<UserGroup[]>(() => {
    const byUser = new Map<string, UserGroup>();
    for (const f of flights) {
      const existing = byUser.get(f.userId);
      if (existing) {
        existing.flights.push(f);
        if (f.updatedAt > existing.latestUpdatedAt) {
          existing.latestUpdatedAt = f.updatedAt;
        }
      } else {
        byUser.set(f.userId, {
          userId: f.userId,
          username: f.username,
          avatar: f.avatar,
          flights: [f],
          latestUpdatedAt: f.updatedAt,
        });
      }
    }
    return [...byUser.values()].sort((a, b) =>
      b.latestUpdatedAt.localeCompare(a.latestUpdatedAt)
    );
  }, [flights]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.username.toLowerCase().includes(q) ||
        g.userId.toLowerCase().includes(q) ||
        g.flights.some((f) => (f.callsign ?? '').toLowerCase().includes(q))
    );
  }, [groups, search]);

  const totalImages = useMemo(
    () => flights.reduce((sum, f) => sum + f.snapImages.length, 0),
    [flights]
  );

  return (
    <AdminLayout>
      <AdminPage
        title="Featured Flights"
        icon={ImageIcon}
        actions={
          <AdminRefreshButton
            onClick={() => void load({ headerRefresh: true })}
            loading={refreshIconBusy}
          />
        }
      >
        {loading ? (
          <AdminLoading label="Loading featured flights…" />
        ) : error ? (
          <AdminErrorState
            title="Error loading featured flights"
            message={error}
            onRetry={() => void load()}
          />
        ) : (
          <>
            <AdminStatCards
              columns={3}
              items={[
                {
                  label: 'Users with a featured flight',
                  value: groups.length,
                },
                {
                  label: 'Featured flights',
                  value: flights.length,
                },
                {
                  label: 'Public images',
                  value: totalImages,
                },
              ]}
            />

            <AdminToolbar>
              <AdminSearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by username or callsign…"
                grow
              />
            </AdminToolbar>

            {filteredGroups.length === 0 ? (
              <AdminEmptyState
                icon={Plane}
                title={
                  groups.length === 0
                    ? 'No one has a featured flight right now.'
                    : 'No users match your search.'
                }
              />
            ) : (
              <>
                {filteredGroups.map((g) => (
                  <AdminSection
                    key={g.userId}
                    title={
                      <Link
                        to={`/user/${g.username}`}
                        className="flex min-w-0 items-center gap-3 hover:underline"
                      >
                        <DeveloperDiscordAvatar
                          userId={g.userId}
                          username={g.username}
                          avatar={g.avatar}
                          className="size-8"
                        />
                        <span className="min-w-0">
                          <span className="block truncate">{g.username}</span>
                          <span className="block truncate font-mono text-xs font-normal text-muted-foreground">
                            {g.userId}
                          </span>
                        </span>
                      </Link>
                    }
                  >
                    <div className="divide-y overflow-hidden rounded-2xl border">
                      {g.flights.map((f) => (
                        <div
                          key={f.id}
                          className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center"
                        >
                          <div className="flex min-w-0 items-start justify-between gap-2 md:w-56 md:shrink-0">
                            <div className="min-w-0">
                              <p className="truncate font-mono text-sm font-medium">
                                {f.callsign ?? 'N/A'}
                              </p>
                              <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                                <span className="font-mono">
                                  {f.departure ?? '?'}
                                </span>
                                <ArrowRight className="size-3" aria-hidden />
                                <span className="font-mono">
                                  {f.arrival ?? '?'}
                                </span>
                                {f.aircraft ? (
                                  <span>· {f.aircraft}</span>
                                ) : null}
                              </p>
                            </div>
                            {f.status ? (
                              <AdminStatusBadge
                                status={f.status}
                                icon={CircleDot}
                                showLabel
                                className="shrink-0 text-xs capitalize"
                              >
                                {f.status}
                              </AdminStatusBadge>
                            ) : null}
                          </div>

                          {f.snapImages.length === 0 ? (
                            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                              No images
                            </p>
                          ) : (
                            <div className="grid min-w-0 flex-1 grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                              {f.snapImages.map((snap) => (
                                <div
                                  key={snap.cephie_id}
                                  className="group/img relative aspect-video overflow-hidden rounded-md border bg-muted sm:w-32"
                                >
                                  <a
                                    href={snap.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block h-full w-full"
                                  >
                                    <img
                                      src={snap.url}
                                      alt={`${f.callsign ?? 'Flight'} snap`}
                                      className="h-full w-full object-cover transition-opacity hover:opacity-90"
                                      loading="lazy"
                                    />
                                  </a>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="icon-xs"
                                        disabled={busyKeys.has(
                                          `image:${snap.cephie_id}`
                                        )}
                                        onClick={() =>
                                          void handleDeleteImage(
                                            g.userId,
                                            f.id,
                                            snap.cephie_id
                                          )
                                        }
                                        aria-label="Delete image"
                                        className="absolute top-1 right-1 opacity-0 shadow-sm group-hover/img:opacity-100 hover:text-destructive focus-visible:opacity-100 disabled:opacity-50 [@media(hover:none)]:opacity-100"
                                      >
                                        <X />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Delete image
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              ))}
                            </div>
                          )}

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busyKeys.has(`unfeature:${f.id}`)}
                            onClick={() => void handleUnfeature(g.userId, f.id)}
                            className="w-full md:ml-auto md:w-auto md:shrink-0"
                          >
                            <EyeOff />
                            Unfeature
                          </Button>
                        </div>
                      ))}
                    </div>
                  </AdminSection>
                ))}
              </>
            )}
          </>
        )}
      </AdminPage>
      {confirmDialog}
    </AdminLayout>
  );
}
