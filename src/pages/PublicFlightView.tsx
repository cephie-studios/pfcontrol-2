import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  Camera,
  ExternalLink,
  History,
  Route,
  StickyNote,
  X,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Loader from '../components/common/Loader';
import { fetchPublicFlight } from '../utils/fetch/flights';
import { fetchBackgrounds } from '../utils/fetch/data';
import { useSettings } from '../hooks/settings/useSettings';
import { useData } from '../hooks/data/useData';
import type { Flight } from '../types/flight';
import { parseCallsign } from '../utils/callsignParser';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

const getDisplayStatus = (status?: string) => {
  if (!status) return 'PENDING';
  if (status === 'TAXI_ORIG' || status === 'TAXI_ARRV') return 'TAXI';
  if (status === 'RWY_ORIG' || status === 'RWY_ARRV') return 'RWY';
  return status;
};

function SectionCard({
  icon,
  title,
  right,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
      <div className="bg-linear-to-r from-zinc-800 to-zinc-900 px-5 py-3.5 border-b border-zinc-700 flex items-center gap-2.5">
        <span className="text-blue-400">{icon}</span>
        <span className="font-semibold text-zinc-100 text-sm tracking-wide">{title}</span>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

interface StatusEntry {
  id: number;
  label: React.ReactNode;
  at: string;
}

export default function PublicFlightView() {
  const { flightId } = useParams<{ flightId: string }>();
  const { settings } = useSettings();
  const { airlines } = useData();

  const [flight, setFlight] = useState<Flight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [customLoaded, setCustomLoaded] = useState(false);
  const [isPFATC, setIsPFATC] = useState(false);
  const [statusTimeline, setStatusTimeline] = useState<StatusEntry[]>([]);
  const [controllers, setControllers] = useState<{ user_id: string; username: string; avatar_url: string | null }[]>([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    fetchBackgrounds().then(setAvailableImages).catch(() => {});
  }, []);

  useEffect(() => {
    if (!flightId) {
      setError('Invalid link.');
      setLoading(false);
      return;
    }
    fetchPublicFlight(flightId)
      .then((data) => {
        setFlight(data);

        // Fetch session info for PFATC badge
        fetch(`${API_BASE_URL}/api/sessions/${data.session_id}/submit`)
          .then((r) => (r.ok ? r.json() : null))
          .then((info) => { if (info?.isPFATC) setIsPFATC(true); })
          .catch(() => {});

        // Fetch flight logs for public timeline
        fetch(`${API_BASE_URL}/api/flights/me/${flightId}/logs`, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null))
          .then((logsData) => {
            if (!logsData?.logs) return;
            // Extract unique controllers (updaters who aren't the pilot)
            const pilotUserId: string | undefined = logsData.pilotUserId;
            const seen = new Set<string>();
            const ctrlList: { user_id: string; username: string; avatar_url: string | null }[] = [];
            for (const log of logsData.logs) {
              if (log.action === 'update' && log.user_id !== pilotUserId && !seen.has(log.user_id)) {
                seen.add(log.user_id);
                ctrlList.push({ user_id: log.user_id, username: log.username, avatar_url: log.avatar_url });
              }
            }
            setControllers(ctrlList);

            const timeline: StatusEntry[] = logsData.logs
              .map((log: { id: number; action: string; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; created_at: string }) => {
                const oldStatus = (log.old_data?.status as string | undefined) ?? null;
                const newStatus = (log.new_data?.status as string | undefined) ?? null;
                if (log.action === 'add' && newStatus) {
                  return { id: log.id, label: `Created as ${newStatus}`, at: log.created_at };
                }
                if (log.action === 'update' && oldStatus !== newStatus && newStatus) {
                  return {
                    id: log.id,
                    label: (
                      <span className="flex items-center gap-1.5">
                        <span>{oldStatus || 'N/A'}</span>
                        <ArrowRight className="h-3 w-3 text-zinc-500 shrink-0" />
                        <span className="text-blue-400">{newStatus}</span>
                      </span>
                    ),
                    at: log.created_at,
                  };
                }
                return null;
              })
              .filter(Boolean)
              .reverse() as StatusEntry[];
            setStatusTimeline(timeline);
          })
          .catch(() => {});
      })
      .catch(() => setError('This flight is not available or does not exist.'))
      .finally(() => setLoading(false));
  }, [flightId]);

  const snaps = flight?.snap_images ?? [];

  const backgroundImage = useMemo(() => {
    if (snaps.length > 0) return `url(${snaps[0].url})`;

    const selectedImage = settings?.backgroundImage?.selectedImage;
    let bgImage = 'url("/assets/images/hero.webp")';
    const getImageUrl = (filename: string | null): string | null => {
      if (!filename || filename === 'random' || filename === 'favorites') return filename;
      if (filename.startsWith('https://api.cephie.app/')) return filename;
      return `${API_BASE_URL}/assets/app/backgrounds/${filename}`;
    };
    if (selectedImage === 'random') {
      if (availableImages.length > 0) {
        const i = Math.floor(Math.random() * availableImages.length);
        bgImage = `url(${API_BASE_URL}${availableImages[i].path})`;
      }
    } else if (selectedImage === 'favorites') {
      const favorites = settings?.backgroundImage?.favorites || [];
      if (favorites.length > 0) {
        const fav = favorites[Math.floor(Math.random() * favorites.length)];
        const url = getImageUrl(fav);
        if (url && url !== 'random' && url !== 'favorites') bgImage = `url(${url})`;
      }
    } else if (selectedImage) {
      const url = getImageUrl(selectedImage);
      if (url && url !== 'random' && url !== 'favorites') bgImage = `url(${url})`;
    }
    return bgImage;
  }, [settings?.backgroundImage?.selectedImage, settings?.backgroundImage?.favorites, availableImages, snaps]);

  useEffect(() => {
    if (backgroundImage !== 'url("/assets/images/hero.webp")') setCustomLoaded(true);
  }, [backgroundImage]);

  const acarsUrl =
    flight?.acars_token && flight?.session_id
      ? `${window.location.origin}/acars/${flight.session_id}/${flight.id}?acars_token=${flight.acars_token}`
      : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Navbar /><Loader />
      </div>
    );
  }

  if (error || !flight) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 pt-24">
          <div className="p-4 rounded-2xl bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            {error || 'Flight not found.'}
          </div>
        </div>
      </div>
    );
  }

  const formattedCallsign = parseCallsign(flight.callsign || '', airlines);
  const hasSpokenName = formattedCallsign !== (flight.callsign || '').toUpperCase();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800/80 text-zinc-300 hover:text-white hover:bg-zinc-700/80 transition-colors"
            onClick={() => setLightboxSrc(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxSrc}
            alt="Cephie Snap"
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Hero */}
      <div className="relative w-full h-80 md:h-105 overflow-hidden">
        <div className="absolute inset-0">
          <img src="/assets/images/hero.webp" alt="Banner" className="object-cover w-full h-full scale-110" />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: customLoaded || snaps.length > 0 ? 1 : 0,
              transition: 'opacity 0.5s ease-in-out',
            }}
          />
          <div className="absolute inset-0 bg-linear-to-b from-gray-950/30 via-gray-950/60 to-gray-950" />
        </div>

        <div className="relative h-full flex flex-col items-center justify-end pb-8 px-6 text-center gap-3">
          {/* Callsign */}
          <div>
            {hasSpokenName ? (
              <>
                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-lg leading-tight">
                  {formattedCallsign}
                </h1>
                <p className="text-sm font-mono text-zinc-400 mt-1">({flight.callsign?.toUpperCase()})</p>
              </>
            ) : (
              <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight drop-shadow-lg">
                {flight.callsign || 'Unknown Callsign'}
              </h1>
            )}
          </div>

          {/* Route — plain text */}
          {flight.departure && flight.arrival && (
            <p className="font-mono text-zinc-400 text-sm tracking-wider flex items-center gap-2">
              <span className="text-white font-semibold">{flight.departure}</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
              <span className="text-white font-semibold">{flight.arrival}</span>
            </p>
          )}

          {/* Status + PFATC — one compact row */}
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full font-mono font-semibold bg-blue-700 text-blue-100 border border-blue-600">
              {getDisplayStatus(flight.status)}
            </span>
            {isPFATC && (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-indigo-700 text-indigo-100 border border-indigo-600">
                PFATC
              </span>
            )}
          </div>

          {/* ACARS link */}
          {acarsUrl && (
            <a
              href={acarsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border bg-indigo-700 border-indigo-600 text-indigo-100 hover:bg-indigo-600 transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              ACARS
            </a>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-4xl px-4 pb-10 -mt-4 relative z-10 space-y-4">

        {/* Photo gallery */}
        {snaps.length > 0 && (
          <SectionCard icon={<Camera className="h-4 w-4" />} title="Photos">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {snaps.map((snap) => (
                <div
                  key={snap.cephie_id}
                  className="rounded-xl overflow-hidden aspect-video bg-zinc-800 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setLightboxSrc(snap.url)}
                >
                  <img src={snap.url} alt="Cephie Snap" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Flight Details — strip layout */}
        <SectionCard
          icon={<Route className="h-4 w-4" />}
          title="Flight Details"
          right={
            controllers.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 font-medium">Controllers:</span>
                <div className="flex items-center gap-1">
                  {controllers.map((c) => (
                    <div key={c.user_id} className="relative group">
                      <Link to={`/user/${c.username}`}>
                        <img
                          src={c.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(c.username)}&background=3f3f46&color=fff&size=32&bold=true`}
                          alt={c.username}
                          className="h-6 w-6 rounded-full bg-zinc-700 ring-1 ring-zinc-600 group-hover:ring-blue-500 transition-all"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.username)}&background=3f3f46&color=fff&size=32&bold=true`;
                          }}
                        />
                      </Link>
                      <div className="absolute -bottom-0.5 -right-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        <span className="flex items-center justify-center w-3 h-3 rounded-full bg-zinc-900 ring-1 ring-zinc-600">
                          <ExternalLink className="w-2 h-2 text-zinc-300" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : undefined
          }
        >
          <div className="space-y-5">
            {/* Airport strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-green-500 mb-1">Departure</label>
                <div className="text-white font-mono text-xl font-bold">{flight.departure || '-'}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-500 mb-1">SID</label>
                <div className="text-white font-mono text-sm">{flight.sid || '-'}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-purple-500 mb-1">STAR</label>
                <div className="text-white font-mono text-sm">{flight.star || '-'}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-red-500 mb-1">Arrival</label>
                <div className="text-white font-mono text-xl font-bold">{flight.arrival || '-'}</div>
              </div>
            </div>

            {/* Aircraft / Type / Runway */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-zinc-700/50 pt-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Aircraft</label>
                <div className="text-white font-mono text-sm">{flight.aircraft || 'N/A'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Flight Type</label>
                <div className="text-white font-mono text-sm">{flight.flight_type || 'N/A'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Runway</label>
                <div className="text-white font-mono text-sm">{flight.runway || 'N/A'}</div>
              </div>
            </div>

            {/* FL / Squawk / WTC / Stand / Gate */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-zinc-700/50 pt-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Cruising FL</label>
                <div className="text-white font-mono text-sm">{flight.cruisingFL || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Cleared FL</label>
                <div className="text-white font-mono text-sm">{flight.clearedFL || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Squawk</label>
                <div className="text-white font-mono text-sm">{flight.squawk || '-'}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">WTC</label>
                <div className="text-white font-mono text-sm">{flight.wtc || '-'}</div>
              </div>
            </div>

            {(flight.stand || flight.gate) && (
              <div className="grid grid-cols-2 gap-4 border-t border-zinc-700/50 pt-4">
                {flight.stand && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Stand</label>
                    <div className="text-white font-mono text-sm">{flight.stand}</div>
                  </div>
                )}
                {flight.gate && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1">Gate</label>
                    <div className="text-white font-mono text-sm">{flight.gate}</div>
                  </div>
                )}
              </div>
            )}

            {/* Route */}
            {flight.route && (
              <div className="border-t border-zinc-700/50 pt-4">
                <label className="block text-sm font-medium text-zinc-400 mb-2">Route</label>
                <p className="text-sm text-zinc-200 font-mono break-all leading-relaxed bg-zinc-800/60 rounded-lg p-3">{flight.route}</p>
              </div>
            )}

            {/* Remarks */}
            {flight.remark && (
              <div className="border-t border-zinc-700/50 pt-4">
                <label className="block text-sm font-medium text-amber-500 mb-1">Remarks</label>
                <p className="text-sm text-zinc-200">{flight.remark}</p>
              </div>
            )}

            <div className="border-t border-zinc-700/50 pt-3 flex flex-wrap gap-x-5 gap-y-1">
              <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                <CalendarClock className="h-3 w-3 shrink-0" />
                <span>Created:</span>
                <span>{flight.created_at ? new Date(flight.created_at).toLocaleString() : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                <CalendarClock className="h-3 w-3 shrink-0" />
                <span>Updated:</span>
                <span>{flight.updated_at ? new Date(flight.updated_at).toLocaleString() : 'N/A'}</span>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Flight Notes */}
        {flight.notes && (
          <SectionCard icon={<StickyNote className="h-4 w-4" />} title="Flight Notes">
            <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{flight.notes}</p>
          </SectionCard>
        )}

        {/* Status Timeline */}
        {statusTimeline.length > 0 && (
          <SectionCard icon={<History className="h-4 w-4" />} title="Status Timeline">
            <div className="overflow-x-auto pb-1">
              <div className="flex items-start gap-0 min-w-max">
                {statusTimeline.map((item, index) => (
                  <div key={item.id} className="flex items-start">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-zinc-900 ring-2 ring-blue-500/30 mt-3.5" />
                      {index !== statusTimeline.length - 1 && (
                        <div className="w-0.5 h-full bg-zinc-700/60 flex-1 min-h-4" />
                      )}
                    </div>
                    <div className="px-3 py-2.5 mx-2 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-sm font-mono min-w-40 mb-2">
                      <div className="text-zinc-200 mb-1.5">{item.label}</div>
                      <div className="flex items-center gap-1 text-zinc-600 text-xs">
                        <CalendarClock className="h-3 w-3 shrink-0" />
                        {new Date(item.at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        )}

        <p className="flex items-center gap-2 text-xs text-zinc-700 font-mono px-1">
          Shared via PFControl
        </p>
      </div>
    </div>
  );
}
