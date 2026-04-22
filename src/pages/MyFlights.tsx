import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  Check,
  ExternalLink,
  MoreVertical,
  Plane,
  Route,
  Search,
  Share2,
} from 'lucide-react';
import { claimSubmittedFlight, fetchMyFlights } from '../utils/fetch/flights';
import type { Flight } from '../types/flight';
import Navbar from '../components/Navbar';
import Loader from '../components/common/Loader';
import { useSettings } from '../hooks/settings/useSettings';
import { fetchBackgrounds } from '../utils/fetch/data';

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

function FlightCard({ flight }: { flight: Flight }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const acarsUrl = flight.acars_token
    ? `${window.location.origin}/acars/${flight.session_id}/${flight.id}?acars_token=${flight.acars_token}`
    : null;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!acarsUrl) return;
    await navigator.clipboard.writeText(acarsUrl);
    setCopied(true);
    setMenuOpen(false);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenAcars = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (acarsUrl) window.open(acarsUrl, '_blank');
    setMenuOpen(false);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen((v) => !v);
  };

  return (
    <div className="relative group">
      <Link
        to={`/my-flights/${flight.id}`}
        className="bg-gray-800/50 border-2 border-gray-700 hover:border-blue-600/50 rounded-3xl p-5 transition-all hover:bg-gray-800/70 block"
      >
        {/* Header row */}
        <div className="flex items-start justify-between mb-4 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-base font-bold text-white truncate font-mono">
              {flight.callsign || 'Unknown'}
            </p>
            {flight.isPFATC && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                PFATC
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-500 font-mono font-medium">
              {getDisplayStatus(flight.status)}
            </span>
            {/* 3-dot menu trigger */}
            {acarsUrl && (
              <button
                onClick={toggleMenu}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700/60 transition-colors"
                aria-label="Flight options"
              >
                {copied ? (
                  <Check className="h-5 w-5 text-emerald-400" />
                ) : (
                  <MoreVertical className="h-5 w-5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Route */}
        <div className="flex items-center gap-1.5 mb-3 text-sm">
          <Route className="h-3.5 w-3.5 text-gray-500 shrink-0" />
          <span className="font-mono text-gray-200 font-medium">
            {flight.departure || '----'}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-gray-600 shrink-0" />
          <span className="font-mono text-gray-200 font-medium">
            {flight.arrival || '----'}
          </span>
        </div>

        {/* Details row */}
        <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-1">
            <Plane className="h-3 w-3 text-gray-600" />
            {flight.aircraft || 'Unknown'}
          </span>
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3 w-3 text-gray-600" />
            {flight.created_at
              ? new Date(flight.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Unknown date'}
          </span>
        </div>

        {/* Notes preview */}
        {flight.notes && (
          <p className="mt-3 text-xs text-gray-500 italic truncate border-t border-gray-700/40 pt-2">
            {flight.notes}
          </p>
        )}
      </Link>

      {/* 3-dot dropdown */}
      {menuOpen && acarsUrl && (
        <div
          ref={menuRef}
          className="absolute top-10 right-2 z-30 bg-gray-900 border border-gray-700/80 rounded-xl shadow-2xl shadow-black/40 py-1 min-w-40"
        >
          <button
            onClick={handleShare}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
          >
            <Share2 className="h-3.5 w-3.5 text-gray-400" />
            Share flight
          </button>
          <button
            onClick={handleOpenAcars}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
            Open ACARS
          </button>
        </div>
      )}
    </div>
  );
}

export default function MyFlights() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings } = useSettings();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [customLoaded, setCustomLoaded] = useState(false);
  const claimSessionId = searchParams.get('claimSessionId');
  const claimFlightId = searchParams.get('claimFlightId');
  const claimToken = searchParams.get('claimToken');

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
    const loadFlights = async () => {
      try {
        if (claimSessionId && claimFlightId && claimToken) {
          await claimSubmittedFlight(claimSessionId, claimFlightId, claimToken);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete('claimSessionId');
            next.delete('claimFlightId');
            next.delete('claimToken');
            return next;
          });
        }
        const result = await fetchMyFlights();
        setFlights(result);
      } catch {
        setError('Failed to load your flights.');
      } finally {
        setLoading(false);
      }
    };
    loadFlights();
  }, [claimSessionId, claimFlightId, claimToken, setSearchParams]);

  const filteredFlights = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flights;
    return flights.filter((flight) =>
      [flight.callsign, flight.departure, flight.arrival, flight.aircraft]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [flights, query]);

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

  return (
    <div className="min-h-screen bg-gray-950 text-white relative">
      <Navbar />

      {/* Hero banner */}
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
          <div className="absolute inset-0 bg-linear-to-b from-gray-950/40 via-gray-950/70 to-gray-950"></div>
        </div>

        <div className="relative h-full flex flex-col items-center justify-center px-6 md:px-10">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight text-center mb-6">
            MY FLIGHTS
          </h1>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full px-4">
            <div className="flex items-center justify-center gap-2 px-6 py-4 bg-blue-600/20 backdrop-blur-md border border-blue-500/30 rounded-full shadow-lg h-12 sm:h-auto">
              <Plane className="h-5 w-5 text-blue-400" />
              <span className="text-blue-400 text-sm font-semibold tracking-wider whitespace-nowrap">
                {filteredFlights.length} FLIGHT{filteredFlights.length === 1 ? '' : 'S'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 pb-8 -mt-6 md:-mt-8 relative z-10">
        <div className="p-6 space-y-6">
          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 bg-gray-950 rounded-full p-1 z-10 flex items-center justify-center">
              <Search className="h-5 w-5 text-blue-500" />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search callsign, airport, aircraft..."
              className="w-full bg-gray-900/70 backdrop-blur-md border-2 border-blue-600 rounded-full pl-12 pr-4 py-3 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
            />
          </div>

          {/* Content */}
          {loading ? (
            <Loader />
          ) : error ? (
            <div className="p-3 bg-red-900/40 border border-red-700 rounded-full flex items-center text-sm">
              {error}
            </div>
          ) : filteredFlights.length === 0 ? (
            <div className="p-8 text-center bg-gray-900/70 backdrop-blur-md border border-gray-800 rounded-3xl">
              <div className="inline-block p-4 bg-blue-600/20 rounded-full mb-4">
                <Plane className="h-12 w-12 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No flights yet</h2>
              <p className="text-gray-400 mb-6">
                Submit a flight plan and it will show up here.
              </p>
              <Link
                to="/create"
                className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-all"
              >
                Create Session
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredFlights.map((flight) => (
                <FlightCard key={String(flight.id)} flight={flight} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
