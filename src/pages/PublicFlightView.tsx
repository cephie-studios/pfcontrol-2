import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  Camera,
  ExternalLink,
  History,
  MessageSquareText,
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

interface StatusEntry {
  id: number;
  label: React.ReactNode;
  at: string;
}

const getDisplayStatus = (status?: string) => {
  if (!status) return 'PENDING';
  if (status === 'TAXI_ORIG' || status === 'TAXI_ARRV') return 'TAXI';
  if (status === 'RWY_ORIG' || status === 'RWY_ARRV') return 'RWY';
  return status;
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
    <p className="text-sm text-gray-200 font-medium break-all">{value}</p>
  </div>
);

interface PublicFlightViewProps {
  standalone?: boolean;
  flightIdOverride?: string;
}

export default function PublicFlightView({
  standalone = true,
  flightIdOverride,
}: PublicFlightViewProps) {
  const params = useParams<{ flightId: string }>();
  const flightId = flightIdOverride ?? params.flightId;
  const { settings } = useSettings();
  const { airlines } = useData();

  const [flight, setFlight] = useState<Flight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [customLoaded, setCustomLoaded] = useState(false);
  const [isPFATC, setIsPFATC] = useState(false);
  const [isAdvancedATC, setIsAdvancedATC] = useState(false);
  const [statusTimeline, setStatusTimeline] = useState<StatusEntry[]>([]);
  const [controllers, setControllers] = useState<
    { user_id: string; username: string; avatar_url: string | null }[]
  >([]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    fetchBackgrounds()
      .then(setAvailableImages)
      .catch(() => {});
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

        fetch(`${API_BASE_URL}/api/sessions/${data.session_id}/submit`)
          .then((r) => (r.ok ? r.json() : null))
          .then((info) => {
            if (info?.isPFATC) setIsPFATC(true);
            if (info?.isAdvancedATC) setIsAdvancedATC(true);
          })
          .catch(() => {});

        fetch(`${API_BASE_URL}/api/flights/me/${flightId}/logs`, {
          credentials: 'include',
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((logsData) => {
            if (!logsData?.logs) return;
            const pilotUserId: string | undefined = logsData.pilotUserId;
            const seen = new Set<string>();
            const ctrlList: {
              user_id: string;
              username: string;
              avatar_url: string | null;
            }[] = [];
            for (const log of logsData.logs) {
              if (
                log.action === 'update' &&
                log.user_id !== pilotUserId &&
                !seen.has(log.user_id)
              ) {
                seen.add(log.user_id);
                ctrlList.push({
                  user_id: log.user_id,
                  username: log.username,
                  avatar_url: log.avatar_url,
                });
              }
            }
            setControllers(ctrlList);

            const timeline: StatusEntry[] = logsData.logs
              .map(
                (log: {
                  id: number;
                  action: string;
                  old_data: Record<string, unknown> | null;
                  new_data: Record<string, unknown> | null;
                  created_at: string;
                }) => {
                  const oldStatus =
                    (log.old_data?.status as string | undefined) ?? null;
                  const newStatus =
                    (log.new_data?.status as string | undefined) ?? null;
                  if (log.action === 'add' && newStatus) {
                    return {
                      id: log.id,
                      label: `Created as ${newStatus}`,
                      at: log.created_at,
                    };
                  }
                  if (
                    log.action === 'update' &&
                    oldStatus !== newStatus &&
                    newStatus
                  ) {
                    return {
                      id: log.id,
                      label: (
                        <span className="flex items-center gap-1.5">
                          <span>{oldStatus || 'N/A'}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                          <span className="text-blue-300">{newStatus}</span>
                        </span>
                      ),
                      at: log.created_at,
                    };
                  }
                  return null;
                }
              )
              .filter(Boolean)
              .reverse() as StatusEntry[];
            setStatusTimeline(timeline);
          })
          .catch(() => {});
      })
      .catch(() => setError('This flight is not available or does not exist.'))
      .finally(() => setLoading(false));
  }, [flightId]);

  const snaps = useMemo(() => flight?.snap_images ?? [], [flight?.snap_images]);

  const backgroundImage = useMemo(() => {
    if (snaps.length > 0) return `url(${snaps[0].url})`;
    const selectedImage = settings?.backgroundImage?.selectedImage;
    let bgImage = 'url("/assets/images/hero.webp")';
    const getImageUrl = (filename: string | null): string | null => {
      if (!filename || filename === 'random' || filename === 'favorites')
        return filename;
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
        if (url && url !== 'random' && url !== 'favorites')
          bgImage = `url(${url})`;
      }
    } else if (selectedImage) {
      const url = getImageUrl(selectedImage);
      if (url && url !== 'random' && url !== 'favorites')
        bgImage = `url(${url})`;
    }
    return bgImage;
  }, [
    settings?.backgroundImage?.selectedImage,
    settings?.backgroundImage?.favorites,
    availableImages,
    snaps,
  ]);

  useEffect(() => {
    if (backgroundImage !== 'url("/assets/images/hero.webp")')
      setCustomLoaded(true);
  }, [backgroundImage]);

  const acarsUrl =
    flight?.acars_token && flight?.session_id
      ? `${window.location.origin}/acars/${flight.session_id}/${flight.id}?acars_token=${flight.acars_token}`
      : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        {standalone && <Navbar />}
        <Loader />
      </div>
    );
  }

  if (error || !flight) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        {standalone && <Navbar />}
        <div className="max-w-4xl mx-auto px-4 pt-24">
          <div className="p-4 rounded-2xl bg-red-900/30 border border-red-700 text-red-200 text-sm">
            {error || 'Flight not found.'}
          </div>
        </div>
      </div>
    );
  }

  const formattedCallsign = parseCallsign(flight.callsign || '', airlines);
  const hasSpokenName =
    formattedCallsign !== (flight.callsign || '').toUpperCase();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {standalone && <Navbar />}

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-10000 bg-black/90 flex items-center justify-center p-4"
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
            alt="Snap"
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Hero */}
      <div className="relative w-full h-72 md:h-80 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/assets/images/hero.webp"
            alt="Banner"
            className="object-cover w-full h-full scale-110"
          />
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
          <div className="absolute inset-0 bg-linear-to-b from-gray-950/40 via-gray-950/70 to-gray-950" />
        </div>

        <div className="relative h-full flex flex-col items-center justify-center px-6 text-center gap-3">
          <div>
            {hasSpokenName ? (
              <>
                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-lg leading-tight">
                  {formattedCallsign}
                </h1>
                <p className="text-sm font-mono text-zinc-400 mt-1">
                  ({flight.callsign?.toUpperCase()})
                </p>
              </>
            ) : (
              <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight drop-shadow-lg">
                {flight.callsign || 'Unknown Callsign'}
              </h1>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            {flight.departure && flight.arrival && (
              <span className="flex items-center gap-1.5 text-gray-300 font-mono text-sm">
                <span>{flight.departure}</span>
                <ArrowRight className="h-3.5 w-3.5 text-gray-500" />
                <span>{flight.arrival}</span>
              </span>
            )}
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <span className="text-xs px-2.5 py-1 rounded-full font-mono font-semibold bg-blue-700 text-blue-100 border border-blue-600">
                {getDisplayStatus(flight.status)}
              </span>
              {isAdvancedATC ? (
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-purple-700 text-purple-100 border border-purple-600">
                  Advanced ATC
                </span>
              ) : isPFATC ? (
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-indigo-700 text-indigo-100 border border-indigo-600">
                  PFATC
                </span>
              ) : null}
            </div>
          </div>

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
      <div className="container mx-auto max-w-5xl px-4 pb-10 -mt-4 relative z-10 space-y-4">
        {/* Photos */}
        {snaps.length > 0 && (
          <div className="bg-gray-900/20 border-2 border-gray-800 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="h-5 w-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-blue-400">Photos</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {snaps.map((snap) => (
                <div
                  key={snap.cephie_id}
                  className="rounded-xl overflow-hidden aspect-video bg-gray-900/40 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setLightboxSrc(snap.url)}
                >
                  <img
                    src={snap.url}
                    alt="Snap"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Flight Details */}
        <div className="bg-gray-900/20 border-2 border-gray-800 rounded-3xl p-6 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Route className="h-4 w-4 text-gray-500 shrink-0" />
              <span className="font-mono text-lg font-bold text-white">
                {flight.departure || '----'}
              </span>
              <ArrowRight className="h-4 w-4 text-gray-600 shrink-0" />
              <span className="font-mono text-lg font-bold text-white">
                {flight.arrival || '----'}
              </span>
              {flight.route && (
                <>
                  <span className="text-gray-700">·</span>
                  <span className="text-gray-400 text-sm truncate">
                    {flight.route}
                  </span>
                </>
              )}
            </div>
            {controllers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Controllers:</span>
                <div className="flex items-center gap-1">
                  {controllers.map((c) => (
                    <div key={c.user_id} className="relative group">
                      <Link to={`/user/${c.username}`}>
                        <img
                          src={
                            c.avatar_url ??
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(c.username)}&background=3f3f46&color=fff&size=32&bold=true`
                          }
                          alt={c.username}
                          className="h-6 w-6 rounded-full bg-gray-700 ring-1 ring-gray-600 group-hover:ring-blue-500 transition-all"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(c.username)}&background=3f3f46&color=fff&size=32&bold=true`;
                          }}
                        />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
            <Field label="Aircraft" value={flight.aircraft || 'N/A'} />
            <Field label="Flight Type" value={flight.flight_type || 'N/A'} />
            <Field label="Runway" value={flight.runway || 'N/A'} />
            <Field
              label="Stand / Gate"
              value={
                [flight.stand, flight.gate].filter(Boolean).join(' / ') || 'N/A'
              }
            />
            <Field label="SID" value={flight.sid || 'N/A'} />
            <Field label="STAR" value={flight.star || 'N/A'} />
            <Field label="Cruising FL" value={flight.cruisingFL || 'N/A'} />
            <Field label="Cleared FL" value={flight.clearedFL || 'N/A'} />
            <Field label="Squawk" value={flight.squawk || 'N/A'} />
            <Field label="WTC" value={flight.wtc || 'N/A'} />
          </div>

          <div className="border-t border-gray-700/50 pt-4 flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <CalendarClock className="h-4 w-4 text-gray-600 shrink-0" />
              <span className="text-gray-500">Created:</span>
              <span>
                {flight.created_at
                  ? new Date(flight.created_at).toLocaleString()
                  : 'N/A'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <CalendarClock className="h-4 w-4 text-gray-600 shrink-0" />
              <span className="text-gray-500">Updated:</span>
              <span>
                {flight.updated_at
                  ? new Date(flight.updated_at).toLocaleString()
                  : 'N/A'}
              </span>
            </div>
          </div>

          {flight.remark && (
            <div className="flex items-start gap-3 p-4 bg-blue-600/10 border border-blue-600/20 rounded-2xl">
              <MessageSquareText className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Remarks</p>
                <p className="text-sm text-gray-200">{flight.remark}</p>
              </div>
            </div>
          )}
        </div>

        {/* Flight Notes */}
        {flight.notes && (
          <div className="bg-gray-900/20 border-2 border-gray-800 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <StickyNote className="h-5 w-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-blue-400">
                Flight Notes
              </h2>
            </div>
            <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed font-mono">
              {flight.notes}
            </p>
          </div>
        )}

        {/* Status Timeline */}
        {statusTimeline.length > 0 && (
          <div className="bg-gray-900/20 border-2 border-gray-800 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <History className="h-5 w-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-blue-400">
                Status Timeline
              </h2>
            </div>
            <div className="overflow-x-auto pb-1">
              <div className="flex items-center gap-2 min-w-max">
                {statusTimeline.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="p-3 bg-gray-900/40 border border-gray-800 rounded-2xl text-sm min-w-44">
                      <div className="text-gray-200 font-medium mb-1">
                        {item.label}
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                        <CalendarClock className="h-3 w-3 shrink-0" />
                        {new Date(item.at).toLocaleString()}
                      </div>
                    </div>
                    {index !== statusTimeline.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-gray-600 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-700 font-mono px-1">
          Shared via PFControl
        </p>
      </div>
    </div>
  );
}