import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import RouteMapOrUnavailable from '../components/map/RouteMapOrUnavailable';
import AircraftPhotoCard from '../components/flight/AircraftPhotoCard';
import FlightTimingBlock from '../components/flight/FlightTimingBlock';
import FlightTabs, { type FlightTab } from '../components/flight/FlightTabs';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Camera,
  Check,
  ExternalLink,
  Plus,
  Share2,
  Star,
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
  const [activeTab, setActiveTab] = useState<FlightTab>('overview');
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
                <ArrowRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                <span className="text-blue-400">{newStatus}</span>
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
      <div className="min-h-screen bg-zinc-950 text-white">
        <Navbar />
        <div className="relative w-full h-80 md:h-[400px] overflow-hidden animate-pulse">
          <div className="absolute inset-0 bg-zinc-800" />
        </div>
        <div className="container mx-auto max-w-4xl px-4 pb-10 relative z-10 space-y-4">
          <div className="h-20 rounded-2xl bg-zinc-800/60 -mt-4 animate-pulse" />
          <div className="h-8 w-64 rounded-full bg-zinc-800 animate-pulse" />
          <div className="h-44 rounded-2xl bg-zinc-800/60 animate-pulse" />
          <div className="h-64 rounded-2xl bg-zinc-800/40 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !flight) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 pt-24">
          <div className="p-4 rounded-2xl bg-red-900/30 border border-red-700 text-red-200 text-sm">
            {error || 'Flight not found'}
          </div>
        </div>
      </div>
    );
  }

  const isAdvancedATC = sessionInfo?.isAdvancedATC ?? false;
  const isPFATC = sessionInfo?.isPFATC ?? false;
  const formattedCallsign = parseCallsign(flight.callsign || '', airlines);
  const hasSpokenName =
    formattedCallsign !== (flight.callsign || '').toUpperCase();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
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
      <div className="relative w-full h-80 md:h-[400px] overflow-hidden flex flex-col">
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
          <div className="absolute inset-0 bg-linear-to-b from-black/55 via-black/15 to-zinc-950" />
        </div>

        <div className="relative z-20 flex items-center justify-between container mx-auto max-w-4xl px-4 pt-20">
          <Link
            to="/my-flights"
            aria-label="Back to My Flights"
            className="h-9 w-9 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-zinc-200 hover:bg-black/60 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFeatured}
              disabled={featuredLoading}
              aria-label={featured ? 'Remove from profile' : 'Feature this flight'}
              title={featured ? 'Featured' : 'Feature'}
              className={`h-9 w-9 rounded-full bg-black/40 border border-white/10 flex items-center justify-center transition-colors ${
                featured
                  ? 'text-amber-400'
                  : 'text-zinc-200 hover:bg-black/60'
              }`}
            >
              <Star className={`h-4 w-4 ${featured ? 'fill-amber-400' : ''}`} />
            </button>
            {acarsUrl && (
              <>
                <button
                  onClick={handleShare}
                  aria-label="Copy public share link"
                  title={copied ? 'Copied' : 'Share'}
                  className={`h-9 w-9 rounded-full bg-black/40 border border-white/10 flex items-center justify-center transition-colors ${
                    copied ? 'text-emerald-400' : 'text-zinc-200 hover:bg-black/60'
                  }`}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                </button>
                <a
                  href={acarsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open ACARS"
                  title="ACARS"
                  className="h-9 w-9 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-zinc-200 hover:bg-black/60 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </>
            )}
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 gap-1.5">
          {hasSpokenName ? (
            <>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-lg leading-tight">
                {formattedCallsign}
              </h1>
              <p className="text-sm font-mono text-zinc-400">
                ({flight.callsign?.toUpperCase()})
              </p>
            </>
          ) : (
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight drop-shadow-lg">
              {flight.callsign || 'Unknown Callsign'}
            </h1>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-4xl px-4 pb-10 relative z-10">
        <FlightTimingBlock flight={flight} logs={logs} />

        <div className="mt-5">
          <FlightTabs active={activeTab} onChange={setActiveTab} />
        </div>

        <div className="mt-4 pb-2">
          {activeTab === 'overview' && (
            <div>
              <AircraftPhotoCard flight={flight} />

              {flight.route && (
                <>
                  <div
                    className="rounded-2xl overflow-hidden mb-2"
                    style={{ height: '300px' }}
                  >
                    <RouteMapOrUnavailable
                      createdAt={flight.created_at}
                      route={flight.route}
                      departure={flight.departure}
                      arrival={flight.arrival}
                      sid={flight.sid}
                      star={flight.star}
                    />
                  </div>
                  <p className="text-xs font-mono text-zinc-500 mb-5 break-words">
                    {flight.route}
                  </p>
                </>
              )}

              <div className="grid grid-cols-3 items-start">
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                    SID
                  </p>
                  <p
                    className={`font-mono text-base font-bold ${flight.sid ? 'text-zinc-100' : 'text-zinc-600'}`}
                  >
                    {flight.sid || 'N/A'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                    Cruising FL
                  </p>
                  <p
                    className={`font-mono text-base font-bold ${flight.cruisingFL ? 'text-zinc-100' : 'text-zinc-600'}`}
                  >
                    {flight.cruisingFL || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                    STAR
                  </p>
                  <p
                    className={`font-mono text-base font-bold ${flight.star ? 'text-zinc-100' : 'text-zinc-600'}`}
                  >
                    {flight.star || 'N/A'}
                  </p>
                </div>
              </div>

              {flight.remark && (
                <div className="flex items-start gap-3 mt-5 p-4 bg-blue-600/10 border border-blue-600/20 rounded-2xl">
                  <div>
                    <p className="text-xs text-zinc-500 mb-0.5">Remarks</p>
                    <p className="text-sm text-zinc-200">{flight.remark}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'photos' && (
            <div>
              <div className="flex items-center justify-end mb-4">
                <button
                  onClick={() => snapInputRef.current?.click()}
                  disabled={snapUploading || snaps.length >= 12}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-blue-500 bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                <p className="text-red-400 text-xs mb-3 font-mono">
                  {snapError}
                </p>
              )}
              {snaps.length === 0 && !snapUploading ? (
                <button
                  onClick={() => snapInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-2xl border-2 border-dashed border-zinc-800 text-zinc-600 hover:border-blue-500/40 hover:text-zinc-400 transition-colors"
                >
                  <Camera className="h-8 w-8" />
                  <span className="text-sm">Upload flight photos</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {snaps.map((snap) => (
                    <div
                      key={snap.cephie_id}
                      className="relative group rounded-xl overflow-hidden aspect-video bg-zinc-800/40"
                    >
                      <img
                        src={snap.url}
                        alt="Snap"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setLightboxSrc(snap.url)}
                      />
                      <button
                        onClick={() => handleSnapDelete(snap.cephie_id)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-zinc-950/80 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {snapUploading && (
                    <div className="rounded-xl aspect-video bg-zinc-800/40 border border-zinc-800 flex items-center justify-center">
                      <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                    </div>
                  )}
                </div>
              )}
              {snaps.length >= 12 && (
                <p className="text-xs text-zinc-600 mt-2 text-right font-mono">
                  12/12 photos
                </p>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div>
              <div className="flex items-center justify-end mb-3">
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
                rows={7}
                maxLength={2000}
                className="w-full bg-zinc-800/40 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-200 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 placeholder-zinc-600 transition-all"
              />
              <p className="text-right text-xs font-mono text-zinc-700 mt-1.5">
                {notes.length}/2000
              </p>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div>
              {statusTimeline.length === 0 ? (
                logsDiscardedDueToAge ? (
                  <p className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3">
                    This flight is older than 90 days. Status/action logs were
                    discarded by retention policy.
                  </p>
                ) : (
                  <p className="text-zinc-500 text-sm">
                    No status-change logs available for this flight.
                  </p>
                )
              ) : (
                <div className="overflow-x-auto pb-1">
                  <div className="flex items-center gap-2 min-w-max">
                    {statusTimeline.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <div className="p-3 bg-zinc-800/40 border border-zinc-800 rounded-2xl text-sm min-w-44">
                          <div className="text-zinc-200 font-medium mb-1">
                            {item.label}
                          </div>
                          <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                            <CalendarClock className="h-3 w-3 shrink-0" />
                            {new Date(item.at).toLocaleString()}
                          </div>
                        </div>
                        {index !== statusTimeline.length - 1 && (
                          <ArrowRight className="h-4 w-4 text-zinc-600 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
