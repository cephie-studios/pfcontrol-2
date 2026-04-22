import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  ExternalLink,
  History,
  MessageSquareText,
  Route,
  Share2,
  StickyNote,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Loader from '../components/common/Loader';
import {
  fetchMyFlightById,
  fetchMyFlightLogs,
  updateFlightNotes,
  type FlightLogItem,
} from '../utils/fetch/flights';
import type { Flight } from '../types/flight';
import { useSettings } from '../hooks/settings/useSettings';
import { fetchBackgrounds } from '../utils/fetch/data';

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
  createdBy: string;
}

const getDisplayStatus = (status?: string) => {
  if (!status) return 'PENDING';
  if (status === 'TAXI_ORIG' || status === 'TAXI_ARRV') return 'TAXI';
  if (status === 'RWY_ORIG' || status === 'RWY_ARRV') return 'RWY';
  return status;
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[11px] text-gray-500 mb-0.5 uppercase tracking-wide">{label}</p>
    <p className="text-sm text-gray-200 font-medium break-all">{value}</p>
  </div>
);

export default function MyFlightDetail() {
  const { id } = useParams<{ id: string }>();
  const { settings } = useSettings();
  const [flight, setFlight] = useState<Flight | null>(null);
  const [logs, setLogs] = useState<FlightLogItem[]>([]);
  const [logsDiscardedDueToAge, setLogsDiscardedDueToAge] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [customLoaded, setCustomLoaded] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionSubmitInfo | null>(null);
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesInitialized = useRef(false);

  useEffect(() => {
    const loadImages = async () => {
      try {
        const data = await fetchBackgrounds();
        setAvailableImages(data);
      } catch (fetchError) {
        console.error('Error loading available images:', fetchError);
      }
    };
    loadImages();
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([fetchMyFlightById(id), fetchMyFlightLogs(id)])
      .then(([flightData, logsData]) => {
        setFlight(flightData);
        setNotes(flightData.notes ?? '');
        notesInitialized.current = true;
        setLogs(logsData.logs);
        setLogsDiscardedDueToAge(logsData.logsDiscardedDueToAge);
        // Fetch session info (public endpoint — no auth needed)
        fetch(`${API_BASE_URL}/api/sessions/${flightData.session_id}/submit`)
          .then((r) => r.ok ? r.json() : null)
          .then((data) => { if (data) setSessionInfo(data); })
          .catch(() => {});
      })
      .catch(() => setError('Failed to load flight details.'))
      .finally(() => setLoading(false));
  }, [id]);

  // Debounced auto-save for notes
  useEffect(() => {
    if (!notesInitialized.current || !id) return;
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(async () => {
      try {
        await updateFlightNotes(id, notes);
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
      } catch {
        // silent — user can retry by typing again
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
          return { id: log.id, label: `Created as ${newStatus}`, at: log.created_at };
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
    const selectedImage = settings?.backgroundImage?.selectedImage;
    let bgImage = 'url("/assets/images/hero.webp")';

    const getImageUrl = (filename: string | null): string | null => {
      if (!filename || filename === 'random' || filename === 'favorites') return filename;
      if (filename.startsWith('https://api.cephie.app/')) return filename;
      return `${API_BASE_URL}/assets/app/backgrounds/${filename}`;
    };

    if (selectedImage === 'random') {
      if (availableImages.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableImages.length);
        bgImage = `url(${API_BASE_URL}${availableImages[randomIndex].path})`;
      }
    } else if (selectedImage === 'favorites') {
      const favorites = settings?.backgroundImage?.favorites || [];
      if (favorites.length > 0) {
        const randomFav = favorites[Math.floor(Math.random() * favorites.length)];
        const favImageUrl = getImageUrl(randomFav);
        if (favImageUrl && favImageUrl !== 'random' && favImageUrl !== 'favorites') {
          bgImage = `url(${favImageUrl})`;
        }
      }
    } else if (selectedImage) {
      const imageUrl = getImageUrl(selectedImage);
      if (imageUrl && imageUrl !== 'random' && imageUrl !== 'favorites') {
        bgImage = `url(${imageUrl})`;
      }
    }

    return bgImage;
  }, [
    settings?.backgroundImage?.selectedImage,
    settings?.backgroundImage?.favorites,
    availableImages,
  ]);

  useEffect(() => {
    if (backgroundImage !== 'url("/assets/images/hero.webp")') {
      setCustomLoaded(true);
    }
  }, [backgroundImage]);

  const acarsUrl =
    flight?.acars_token
      ? `${window.location.origin}/acars/${flight.session_id}/${flight.id}?acars_token=${flight.acars_token}`
      : null;

  const handleShare = async () => {
    if (!acarsUrl) return;
    await navigator.clipboard.writeText(acarsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Navbar />
        <Loader />
      </div>
    );
  }

  if (error || !flight) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 pt-24">
          <div className="p-4 rounded-2xl bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            {error || 'Flight not found'}
          </div>
        </div>
      </div>
    );
  }

  const isPFATC = sessionInfo?.isPFATC ?? false;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />

      {/* Hero */}
      <div className="relative w-full h-80 md:h-96 overflow-hidden">
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

        <div className="relative h-full flex flex-col items-center justify-center px-6 text-center gap-3">
          {/* Callsign */}
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            {flight.callsign || 'Unknown Callsign'}
          </h1>

          {/* Route + status */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {flight.departure && flight.arrival && (
              <span className="flex items-center gap-1.5 text-gray-300 font-mono text-sm bg-gray-900/50 backdrop-blur-sm px-3 py-1 rounded-full border border-gray-700/50">
                <span>{flight.departure}</span>
                <ArrowRight className="h-3 w-3 text-gray-500" />
                <span>{flight.arrival}</span>
              </span>
            )}
            <span className="text-xs px-2.5 py-1 rounded-full font-mono font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
              {getDisplayStatus(flight.status)}
            </span>
            {isPFATC && (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PFATC SESSION
              </span>
            )}
          </div>

          {/* Action buttons */}
          {acarsUrl && (
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={handleShare}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  copied
                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-gray-900/50 border-gray-600/50 text-gray-300 hover:border-gray-500 hover:text-white'
                }`}
              >
                {copied ? (
                  <><Check className="h-3.5 w-3.5" /> Copied</>
                ) : (
                  <><Share2 className="h-3.5 w-3.5" /> Share</>
                )}
              </button>
              <a
                href={acarsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border bg-indigo-600/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 transition-all"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open ACARS
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-5xl px-4 pb-8 -mt-6 md:-mt-8 relative z-10 space-y-4">
        <Link
          to="/my-flights"
          className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Flights
        </Link>

        {/* Flight info card — ACARS terminal style */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="bg-linear-to-r from-zinc-800 to-zinc-900 px-4 py-3 border-b border-zinc-700 flex items-center gap-2">
            <Route className="h-4 w-4 text-green-500" />
            <span className="text-sm font-mono text-zinc-300">
              {flight.callsign || 'UNKNOWN'} ACARS
            </span>
            {flight.departure && flight.arrival && (
              <span className="ml-auto font-mono text-xs text-zinc-500">
                {flight.departure} → {flight.arrival}
              </span>
            )}
          </div>
          <div className="p-5 space-y-5 font-mono">
            {/* Route */}
            {flight.route && (
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Route</p>
                <p className="text-xs text-zinc-300 break-all">{flight.route}</p>
              </div>
            )}

            {/* Fields grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
              <Field label="Aircraft" value={flight.aircraft || 'N/A'} />
              <Field label="Flight Type" value={flight.flight_type || 'N/A'} />
              <Field label="Runway" value={flight.runway || 'N/A'} />
              <Field label="SID" value={flight.sid || 'N/A'} />
              <Field label="STAR" value={flight.star || 'N/A'} />
              <Field label="Stand" value={flight.stand || 'N/A'} />
              <Field label="Gate" value={flight.gate || 'N/A'} />
              <Field label="Cruising FL" value={flight.cruisingFL || 'N/A'} />
              <Field label="Cleared FL" value={flight.clearedFL || 'N/A'} />
              <Field label="Squawk" value={flight.squawk || 'N/A'} />
              <Field label="WTC" value={flight.wtc || 'N/A'} />
              <Field label="Session" value={flight.session_id} />
            </div>

            {/* Timestamps */}
            <div className="border-t border-zinc-800 pt-4 flex flex-wrap gap-x-6 gap-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <CalendarClock className="h-3 w-3 shrink-0" />
                <span className="text-zinc-600">Created:</span>
                <span>{flight.created_at ? new Date(flight.created_at).toLocaleString() : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <CalendarClock className="h-3 w-3 shrink-0" />
                <span className="text-zinc-600">Updated:</span>
                <span>{flight.updated_at ? new Date(flight.updated_at).toLocaleString() : 'N/A'}</span>
              </div>
            </div>

            {/* Remark */}
            {flight.remark && (
              <div className="flex items-start gap-3 p-3 bg-blue-950/30 border border-blue-900/40 rounded-lg">
                <MessageSquareText className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Remarks</p>
                  <p className="text-xs text-zinc-300">{flight.remark}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Timeline */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="bg-linear-to-r from-zinc-800 to-zinc-900 px-4 py-3 border-b border-zinc-700 flex items-center gap-2">
            <History className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-mono text-zinc-300">Status Timeline</span>
          </div>
          <div className="p-4">
            {statusTimeline.length === 0 ? (
              logsDiscardedDueToAge ? (
                <p className="text-amber-400 text-xs font-mono bg-amber-950/30 border border-amber-900/40 rounded-lg p-3">
                  Flight older than 365 days — status logs discarded by retention policy.
                </p>
              ) : (
                <p className="text-zinc-600 text-xs font-mono">No status-change logs available.</p>
              )
            ) : (
              <div className="overflow-x-auto pb-1">
                <div className="flex items-center gap-2 min-w-max">
                  {statusTimeline.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono min-w-44">
                        <div className="text-zinc-200 mb-1">{item.label}</div>
                        <div className="flex items-center gap-1 text-zinc-600">
                          <CalendarClock className="h-3 w-3 shrink-0" />
                          {new Date(item.at).toLocaleString()}
                        </div>
                      </div>
                      {index !== statusTimeline.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5 text-zinc-700 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Flight Notes */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="bg-linear-to-r from-zinc-800 to-zinc-900 px-4 py-3 border-b border-zinc-700 flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-mono text-zinc-300">Flight Notes</span>
            <span
              className={`ml-auto text-xs font-mono text-emerald-400 transition-opacity duration-300 ${
                notesSaved ? 'opacity-100' : 'opacity-0'
              }`}
            >
              saved
            </span>
          </div>
          <div className="p-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add personal notes about this flight — visible only to you..."
              rows={5}
              maxLength={2000}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-zinc-600"
            />
            <p className="text-right text-[10px] font-mono text-zinc-700 mt-1">{notes.length}/2000</p>
          </div>
        </div>
      </div>
    </div>
  );
}
