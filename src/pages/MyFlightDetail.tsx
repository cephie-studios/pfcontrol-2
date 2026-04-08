import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Plane,
  Route,
  History,
  MessageSquareText,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Loader from '../components/common/Loader';
import {
  fetchMyFlightById,
  fetchMyFlightLogs,
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

const getStatusClass = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    case 'CLEARED':
      return 'bg-green-500/20 text-green-400 border border-green-500/30';
    case 'TAXI':
    case 'TAXI_ORIG':
    case 'TAXI_ARRV':
      return 'bg-pink-500/20 text-pink-400 border border-pink-500/30';
    case 'DEPARTED':
      return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
    case 'STUP':
      return 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
    case 'PUSH':
      return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    case 'RWY':
    case 'RWY_ORIG':
      return 'bg-red-500/20 text-red-400 border border-red-500/30';
    case 'RWY_ARRV':
      return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    case 'DEPA':
      return 'bg-green-500/20 text-green-400 border border-green-500/30';
    case 'ENROUTE':
      return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
    case 'APP':
      return 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';
    case 'GATE':
      return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    default:
      return 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30';
  }
};

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
        setLogs(logsData.logs);
        setLogsDiscardedDueToAge(logsData.logsDiscardedDueToAge);
      })
      .catch(() => setError('Failed to load flight details.'))
      .finally(() => setLoading(false));
  }, [id]);

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
          <div className="p-4 rounded-2xl bg-red-900/30 border border-red-700 text-red-200 text-sm">
            {error || 'Flight not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />

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
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/70 to-gray-950" />
        </div>
        <div className="relative h-full flex flex-col items-center justify-center px-6 text-center gap-3">
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            {flight.callsign || 'Unknown Callsign'}
          </h1>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            {flight.departure && flight.arrival && (
              <span className="flex items-center gap-1.5 text-gray-300 font-mono text-sm">
                <span>{flight.departure}</span>
                <ArrowRight className="h-3.5 w-3.5 text-gray-500" />
                <span>{flight.arrival}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 pb-10 -mt-4 relative z-10 space-y-4">
        <Link
          to="/my-flights"
          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Flights
        </Link>

        <div className="bg-gray-900/20 border-2 border-gray-800 rounded-3xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Route className="h-4 w-4 text-gray-500 shrink-0" />
            <span className="font-mono text-lg font-bold text-white">{flight.departure || '----'}</span>
            <ArrowRight className="h-4 w-4 text-gray-600 shrink-0" />
            <span className="font-mono text-lg font-bold text-white">{flight.arrival || '----'}</span>
            {flight.route && (
              <>
                <span className="text-gray-700">·</span>
                <span className="text-gray-400 text-sm truncate">{flight.route}</span>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
            <Field label="Flight ID" value={String(flight.id)} />
            <Field label="Session ID" value={flight.session_id} />
            <Field label="Aircraft" value={flight.aircraft || 'N/A'} />
            <Field label="Flight Type" value={flight.flight_type || 'N/A'} />
            <Field label="Runway" value={flight.runway || 'N/A'} />
            <Field label="SID" value={flight.sid || 'N/A'} />
            <Field label="STAR" value={flight.star || 'N/A'} />
            <Field label="Stand / Gate" value={`${flight.stand || 'N/A'} / ${flight.gate || 'N/A'}`} />
            <Field label="Cruising FL" value={flight.cruisingFL || 'N/A'} />
            <Field label="Cleared FL" value={flight.clearedFL || 'N/A'} />
            <Field label="Squawk" value={flight.squawk || 'N/A'} />
            <Field label="WTC" value={flight.wtc || 'N/A'} />
          </div>

          <div className="border-t border-gray-700/50 pt-4 flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <CalendarClock className="h-4 w-4 text-gray-600 shrink-0" />
              <span className="text-gray-500">Created:</span>
              <span>{flight.created_at ? new Date(flight.created_at).toLocaleString() : 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <CalendarClock className="h-4 w-4 text-gray-600 shrink-0" />
              <span className="text-gray-500">Updated:</span>
              <span>{flight.updated_at ? new Date(flight.updated_at).toLocaleString() : 'N/A'}</span>
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

        <div className="bg-gray-900/20 border-2 border-gray-800 rounded-3xl p-4">
          <div className="flex items-center mb-4">
            <div className="p-2">
              <History className="h-5 w-5 text-blue-400 pt-0.5" />
            </div>
            <h2 className="text-lg font-semibold text-blue-400">Status Timeline</h2>
          </div>

          {statusTimeline.length === 0 ? (
            logsDiscardedDueToAge ? (
              <p className="text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3">
                This flight is older than 365 days. Status/action logs were discarded by retention policy.
              </p>
            ) : (
              <p className="text-gray-500 text-sm">No status-change logs available for this flight.</p>
            )
          ) : (
            <div className="overflow-x-auto pb-1">
              <div className="flex items-center gap-2 min-w-max">
                {statusTimeline.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="p-3 bg-gray-900/40 border border-gray-800 rounded-2xl text-sm min-w-44">
                      <div className="text-gray-200 font-medium mb-1">{item.label}</div>
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
