import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { MdStar, MdImage, MdClose, MdVisibilityOff } from 'react-icons/md';
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
    (userId: string, flightId: string) => {
      if (
        !confirm(
          'Unfeature this flight? It will disappear from the user’s public profile immediately.'
        )
      )
        return;
      void withBusy(`unfeature:${flightId}`, async () => {
        await adminUnfeatureFlight(userId, flightId);
        setFlights((prev) => prev.filter((f) => f.id !== flightId));
        showToast('Flight unfeatured', 'success');
      });
    },
    [withBusy, showToast]
  );

  const handleDeleteImage = useCallback(
    (userId: string, flightId: string, cephieId: string) => {
      if (!confirm('Delete this image? This cannot be undone.')) return;
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
    [withBusy, showToast]
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
      <AdminPageHeader
        title="Featured Flights"
        icon={MdStar}
        accent="yellow"
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
          title="Error loading featured flights"
          message={error}
          onRetry={() => void load()}
        />
      ) : (
        <>
          <p className="text-xs text-zinc-500 mb-4">
            {groups.length} user{groups.length === 1 ? '' : 's'} with a featured
            flight · {flights.length} flight
            {flights.length === 1 ? '' : 's'} · {totalImages} image
            {totalImages === 1 ? '' : 's'} shown on public profiles right now.
          </p>

          <AdminToolbar>
            <AdminSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by username or callsign…"
              grow
            />
          </AdminToolbar>

          {filteredGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-12 text-center">
              <p className="text-sm text-zinc-500">
                {groups.length === 0
                  ? 'No one has a featured flight right now.'
                  : 'No users match your search.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {filteredGroups.map((g) => (
                <li
                  key={g.userId}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
                >
                  <Link
                    to={`/user/${g.username}`}
                    className="flex items-center gap-3 mb-4 group/link w-fit"
                  >
                    <DeveloperDiscordAvatar
                      userId={g.userId}
                      username={g.username}
                      avatar={g.avatar}
                      className="h-9 w-9"
                    />
                    <div>
                      <p className="font-medium text-zinc-100 group-hover/link:text-blue-400 transition-colors">
                        {g.username}
                      </p>
                      <p className="text-[11px] text-zinc-500 font-mono">
                        {g.userId}
                      </p>
                    </div>
                  </Link>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {g.flights.map((f) => (
                      <div
                        key={f.id}
                        className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="font-mono text-sm text-zinc-200 truncate">
                            {f.callsign ?? '—'}
                          </p>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-500">
                            {f.status ?? ''}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mb-3">
                          {f.departure ?? '?'} → {f.arrival ?? '?'}
                          {f.aircraft ? ` · ${f.aircraft}` : ''}
                        </p>
                        {f.snapImages.length === 0 ? (
                          <p className="flex items-center gap-1.5 text-xs text-zinc-600 italic mb-3">
                            <MdImage className="w-3.5 h-3.5" /> No images
                          </p>
                        ) : (
                          <div className="grid grid-cols-3 gap-1.5 mb-3">
                            {f.snapImages.map((snap) => (
                              <div
                                key={snap.cephie_id}
                                className="group/img relative aspect-video overflow-hidden rounded-lg bg-zinc-800/60"
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
                                    className="h-full w-full object-cover hover:opacity-90 transition-opacity"
                                    loading="lazy"
                                  />
                                </a>
                                <button
                                  type="button"
                                  disabled={busyKeys.has(
                                    `image:${snap.cephie_id}`
                                  )}
                                  onClick={() =>
                                    handleDeleteImage(
                                      g.userId,
                                      f.id,
                                      snap.cephie_id
                                    )
                                  }
                                  aria-label="Delete image"
                                  className="absolute top-1 right-1 rounded-full bg-zinc-950/80 p-1 text-zinc-300 opacity-0 transition-all hover:text-red-400 group-hover/img:opacity-100 disabled:opacity-50"
                                >
                                  <MdClose className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyKeys.has(`unfeature:${f.id}`)}
                          onClick={() => handleUnfeature(g.userId, f.id)}
                          className="w-full"
                        >
                          <MdVisibilityOff className="w-3.5 h-3.5 inline mr-1" />
                          Unfeature
                        </Button>
                      </div>
                    ))}
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
