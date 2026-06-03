import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import RouteMap from '../components/map/RouteMap';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Camera,
  Check,
  ExternalLink,
  History,
  MessageSquareText,
  Plus,
  Route,
  Share2,
  Star,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import {
  fetchMyFlightById,
  fetchMyFlightLogs,
  updateFlightNotes,
  uploadSnapImage,
  deleteSnapImage as deleteSnapImageApi,
  toggleFeaturedOnProfile,
  type FlightLogItem,
  type SnapImage,
} from '../utils/fetch/flights';
import type { Flight } from '../types/flight';
import { useSettings } from '../hooks/settings/useSettings';
import { fetchBackgrounds } from '../utils/fetch/data';
import { useData } from '../hooks/data/useData';
import { parseCallsign } from '../utils/callsignParser';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

interface SessionSubmitInfo {
  sessionId: string;
  airportIcao: string;
  activeRunway?: string;
  isPFATC: boolean;
  isAdvancedATC?: boolean;
  createdBy: string;
}

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
    <p className="text-sm text-gray-200 font-medium break-all">{value}</p>
  </div>
);

const getDisplayStatus = (status?: string) => {
  if (!status) return 'PENDING';
  if (status === 'TAXI_ORIG' || status === 'TAXI_ARRV') return 'TAXI';
  if (status === 'RWY_ORIG' || status === 'RWY_ARRV') return 'RWY';
  return status;
};

export default function MyFlightDetail() {
  const { id } = useParams<{ id: string }>();
  const { settings } = useSettings();
  const { airlines } = useData();
  const [flight, setFlight] = useState<Flight | null>(null);
  const [logs, setLogs] = useState<FlightLogItem[]>([]);
  const [logsDiscardedDueToAge, setLogsDiscardedDueToAge] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [customLoaded, setCustomLoaded] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionSubmitInfo | null>(
    null
  );
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [featuredToast, setFeaturedToast] = useState('');
  const [snaps, setSnaps] = useState<SnapImage[]>([]);
  const [snapUploading, setSnapUploading] = useState(false);
  const [snapError, setSnapError] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const snapInputRef = useRef<HTMLInputElement>(null);
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesInitialized = useRef(false);

  useEffect(() => {
    fetchBackgrounds()
      .then(setAvailableImages)
      .catch((err) => console.error('Error loading images:', err));
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchMyFlightById(id), fetchMyFlightLogs(id)])
      .then(([flightData, logsData]) => {
        setFlight(flightData);
        setNotes(flightData.notes ?? '');
        setFeatured(flightData.featured_on_profile ?? false);
        setSnaps(flightData.snap_images ?? []);
        notesInitialized.current = true;
        setLogs(logsData.logs);
        setLogsDiscardedDueToAge(logsData.logsDiscardedDueToAge);
        fetch(`${API_BASE_URL}/api/sessions/${flightData.session_id}/submit`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data) setSessionInfo(data);
          })
          .catch(() => {});
      })
      .catch(() => setError('Failed to load flight details.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!notesInitialized.current || !id) return;
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(async () => {
      try {
        await updateFlightNotes(id, notes);
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
      } catch {
        /* silent */
      }
    }, 800);
    return () => {
      if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    };
  }, [notes, id]);

  const statusTimeline = useMemo(() => {
    return logs
      .map((log) => {
        const oldStatus = (log.old_data?.status as string | undefined) ?? null;
        const newStatus = (log.new_data?.status as string | undefined) ?? null;
        if (log.action === 'add' && newStatus) {
          return {
            id: log.id,
            label: `Created as ${newStatus}`,
            at: log.created_at,
          };
        }
        if (log.action === 'update' && oldStatus !== newStatus && newStatus) {
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
      })
      .filter((item): item is NonNullable<typeof item> => !!item)
      .reverse();
  }, [logs]);

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

  const acarsUrl = flight?.acars_token
    ? `${window.location.origin}/acars/${flight.session_id}/${flight.id}?acars_token=${flight.acars_token}`
    : null;

  const publicFlightUrl = flight?.acars_token
    ? `${window.location.origin}/flight/${flight.id}`
    : null;

  const handleShare = async () => {
    if (!publicFlightUrl) return;
    await navigator.clipboard.writeText(publicFlightUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleFeatured = async () => {
    if (!id || featuredLoading) return;
    setFeaturedLoading(true);
    try {
      const { featured: newFeatured } = await toggleFeaturedOnProfile(id);
      setFeatured(newFeatured);
      setFeaturedToast(
        newFeatured ? 'Added to profile' : 'Removed from profile'
      );
      setTimeout(() => setFeaturedToast(''), 2500);
    } catch (err) {
      setFeaturedToast(
        err instanceof Error && err.message === 'CAP_REACHED'
          ? 'Max 3 featured flights'
          : 'Failed to update'
      );
      setTimeout(() => setFeaturedToast(''), 2500);
    } finally {
      setFeaturedLoading(false);
    }
  };

  const handleSnapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setSnapUploading(true);
    setSnapError('');
    try {
      const result = await uploadSnapImage(id, file);
      setSnaps(result.snap_images);
    } catch {
      setSnapError('Upload failed. Please try again.');
    } finally {
      setSnapUploading(false);
      if (snapInputRef.current) snapInputRef.current.value = '';
    }
  };

  const handleSnapDelete = async (cephieId: string) => {
    if (!id) return;
    try {
      await deleteSnapImageApi(id, cephieId);
      setSnaps((prev) => prev.filter((s) => s.cephie_id !== cephieId));
    } catch {
      setSnapError('Failed to delete photo.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <Navbar />
        {/* Hero — use user's banner while flight loads */}
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
                opacity: customLoaded ? 1 : 0,
                transition: 'opacity 0.5s ease-in-out',
              }}
            />
            <div className="absolute inset-0 bg-linear-to-b from-gray-950/40 via-gray-950/70 to-gray-950" />
          </div>
          <div className="relative h-full flex flex-col items-center justify-center px-6 text-center gap-3 animate-pulse">
            <div className="h-10 w-56 rounded-full bg-gray-700/60" />
            <div className="h-5 w-32 rounded-full bg-gray-700/60" />
            <div className="flex items-center gap-2">
              <div className="h-7 w-20 rounded-full bg-gray-700/60" />
              <div className="h-7 w-20 rounded-full bg-gray-700/60" />
            </div>
          </div>
        </div>

        <div className="container mx-auto max-w-5xl px-4 pb-10 -mt-4 relative z-10 space-y-4">
          {/* Back button skeleton */}
          <div className="h-9 w-40 rounded-full bg-gray-800 animate-pulse" />

          {/* Photos card skeleton */}
          <div className="bg-gray-900/20 border-2 border-gray-800 rounded-3xl p-6 animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-gray-700" />
                <div className="h-5 w-16 rounded-full bg-gray-700" />
              </div>
              <div className="h-7 w-24 rounded-full bg-gray-700" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl aspect-video bg-gray-800" />
              ))}
            </div>
          </div>

          {/* Flight details card skeleton */}
          <div className="bg-gray-900/20 border-2 border-gray-800 rounded-3xl p-6 space-y-5 animate-pulse">
            {/* Route row */}
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded bg-gray-700 shrink-0" />
              <div className="h-5 w-12 rounded-full bg-gray-700" />
              <div className="h-4 w-4 rounded bg-gray-700 shrink-0" />
              <div className="h-5 w-12 rounded-full bg-gray-700" />
            </div>
            {/* Fields grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-14 rounded-full bg-gray-700" />
                  <div className="h-4 w-20 rounded-full bg-gray-700" />
                </div>
              ))}
            </div>
            {/* Timestamps row */}
            <div className="border-t border-gray-700/50 pt-4 flex flex-wrap gap-x-6 gap-y-2">
              <div className="h-4 w-48 rounded-full bg-gray-700" />
              <div className="h-4 w-48 rounded-full bg-gray-700" />
            </div>
          </div>

          {/* Notes card skeleton */}
          <div className="bg-gray-900/20 border-2 border-gray-800 rounded-3xl p-6 animate-pulse">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-5 w-5 rounded bg-gray-700" />
              <div className="h-5 w-24 rounded-full bg-gray-700" />
            </div>
            <div className="h-28 rounded-2xl bg-gray-800" />
          </div>

          {/* Timeline card skeleton */}
          <div className="bg-gray-900/20 border-2 border-gray-800 rounded-3xl p-6 animate-pulse">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-5 w-5 rounded bg-gray-700" />
              <div className="h-5 w-28 rounded-full bg-gray-700" />
            </div>
            <div className="flex items-center gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-16 w-44 rounded-2xl bg-gray-800" />
                  {i < 2 && (
                    <div className="h-4 w-4 rounded bg-gray-700 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !flight) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 pt-24">
          <div className="p-4 rounded-2xl bg-red-900/30 border border-red-700 text-red-200 text-sm">
            {error || 'Flight not found'}
          </div>
        </div>
      </div>
    );
  }

  const isPFATC = sessionInfo?.isPFATC ?? false;
  const isAdvancedATC = sessionInfo?.isAdvancedATC ?? false;
  const formattedCallsign = parseCallsign(flight.callsign || '', airlines);
  const hasSpokenName =
    formattedCallsign !== (flight.callsign || '').toUpperCase();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />

      {featuredToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-zinc-800 border border-zinc-600 text-sm text-zinc-200 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          {featuredToast}
        </div>
      )}

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

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFeatured}
              disabled={featuredLoading}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                featured
                  ? 'bg-amber-600 border-amber-500 text-amber-50 hover:bg-amber-500'
                  : 'bg-zinc-700 border-zinc-600 text-zinc-200 hover:bg-zinc-600'
              }`}
            >
              <Star
                className={`h-3.5 w-3.5 ${featured ? 'fill-amber-300' : ''}`}
              />
              {featured ? 'Featured' : 'Feature'}
            </button>
            {acarsUrl && (
              <>
                <button
                  onClick={handleShare}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    copied
                      ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-zinc-700 border-zinc-600 text-zinc-200 hover:bg-zinc-600'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </>
                  )}
                </button>
                <a
                  href={acarsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border bg-indigo-700 border-indigo-600 text-indigo-100 hover:bg-indigo-600 transition-all"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  ACARS
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-5xl px-4 pb-10 -mt-4 relative z-10 space-y-4">
        <Link
          to="/my-flights"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-gray-900/20 border-2 border-gray-800 text-blue-400 hover:text-blue-300 hover:border-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Flights
        </Link>

        {/* Photos */}
        <div className="bg-gray-900/20 border-2 border-gray-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-blue-400">Photos</h2>
            </div>
            <button
              onClick={() => snapInputRef.current?.click()}
              disabled={snapUploading || snaps.length >= 12}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-purple-500 bg-purple-600 text-white hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-3.5 w-3.5" />
              {snapUploading ? 'Uploading…' : 'Add Photo'}
            </button>
          </div>
          <input
            ref={snapInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleSnapUpload}
          />
          {snapError && (
            <p className="text-red-400 text-xs mb-3 font-mono">{snapError}</p>
          )}
          {snaps.length === 0 && !snapUploading ? (
            <button
              onClick={() => snapInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed border-gray-800 text-gray-600 hover:border-purple-500/40 hover:text-gray-400 transition-colors"
            >
              <Camera className="h-8 w-8" />
              <span className="text-sm">Upload flight photos</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {snaps.map((snap) => (
                <div
                  key={snap.cephie_id}
                  className="relative group rounded-xl overflow-hidden aspect-video bg-gray-900/40"
                >
                  <img
                    src={snap.url}
                    alt="Snap"
                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setLightboxSrc(snap.url)}
                  />
                  <button
                    onClick={() => handleSnapDelete(snap.cephie_id)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-gray-950/80 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {snapUploading && (
                <div className="rounded-xl aspect-video bg-gray-900/40 border border-gray-800 flex items-center justify-center">
                  <div className="h-5 w-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                </div>
              )}
            </div>
          )}
          {snaps.length >= 12 && (
            <p className="text-xs text-gray-600 mt-2 text-right font-mono">
              12/12 photos
            </p>
          )}
        </div>

        {/* Flight Details */}
        <div className="bg-gray-900/20 border-2 border-gray-800 rounded-3xl p-6 space-y-5">
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

          {flight.route && (
            <div
              className="rounded-2xl overflow-hidden border border-gray-700/60"
              style={{ height: '280px' }}
            >
              <RouteMap
                route={flight.route}
                departure={flight.departure}
                arrival={flight.arrival}
                sid={flight.sid}
                star={flight.star}
              />
            </div>
          )}

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
        <div className="bg-gray-900/20 border-2 border-gray-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-blue-400">
                Flight Notes
              </h2>
            </div>
            <span
              className={`text-xs font-mono text-emerald-400 transition-opacity duration-300 ${notesSaved ? 'opacity-100' : 'opacity-0'}`}
            >
              ✓ saved
            </span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this flight..."
            rows={5}
            maxLength={2000}
            className="w-full bg-gray-900/40 border border-gray-800 rounded-2xl p-4 text-sm text-gray-200 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 placeholder-gray-600 transition-all"
          />
          <p className="text-right text-xs font-mono text-gray-700 mt-1.5">
            {notes.length}/2000
          </p>
        </div>

        {/* Status Timeline */}
        <div className="bg-gray-900/20 border-2 border-gray-800 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-blue-400">
              Status Timeline
            </h2>
          </div>

          {statusTimeline.length === 0 ? (
            logsDiscardedDueToAge ? (
              <p className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3">
                This flight is older than 90 days. Status/action logs were
                discarded by retention policy.
              </p>
            ) : (
              <p className="text-gray-500 text-sm">
                No status-change logs available for this flight.
              </p>
            )
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
