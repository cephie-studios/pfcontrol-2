import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  Calendar,
  Check,
  ExternalLink,
  MoreVertical,
  Plane,
  Route,
  Workflow,
  Search,
  Share2,
  Star,
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


function FlightCard({ flight, large = false }: { flight: Flight; large?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const coverSnap = flight.snap_images?.[0];
  const hasCover = !!coverSnap;

  const acarsUrl = flight.acars_token
    ? `${window.location.origin}/acars/${flight.session_id}/${flight.id}?acars_token=${flight.acars_token}`
    : null;

  const publicFlightUrl = flight.acars_token
    ? `${window.location.origin}/flight/${flight.id}`
    : null;

  const callsign = flight.callsign?.toUpperCase() || 'Unknown';

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
    if (!publicFlightUrl) return;
    await navigator.clipboard.writeText(publicFlightUrl);
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

  if (hasCover) {
    // Photo card — image fills background, info overlaid at bottom
    return (
      <div className={`relative ${large ? 'col-span-2' : ''}`}>
        <Link
          to={`/my-flights/${flight.id}`}
          className="block rounded-3xl overflow-hidden aspect-video relative group border-2 border-gray-700 hover:border-blue-600/50 transition-colors"
        >
          <img
            src={coverSnap!.url}
            alt={flight.callsign}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-transparent" />

          {/* Top-left: snap count */}
          {(flight.snap_images?.length ?? 0) > 1 && (
            <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/60 text-white border border-white/10 backdrop-blur-sm">
              <Camera className="h-2.5 w-2.5" />
              {flight.snap_images!.length}
            </div>
          )}

          {/* Top-right: featured star */}
          {flight.featured_on_profile && (
            <div className="absolute top-3 right-3">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400 drop-shadow" />
            </div>
          )}

          {/* Info overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="font-bold text-white text-lg font-mono leading-tight truncate drop-shadow">
              {callsign}
            </p>
            {flight.departure && flight.arrival && (
              <div className="flex items-center gap-1.5 text-gray-300 font-mono text-sm mt-0.5">
                <span>{flight.departure}</span>
                <ArrowRight className="h-3 w-3 text-gray-500 shrink-0" />
                <span>{flight.arrival}</span>
              </div>
            )}
            {flight.aircraft && (
              <p className="text-xs text-gray-400 mt-0.5">{flight.aircraft}</p>
            )}
            {flight.isPFATC && (
              <div className="flex items-center mt-1">
                <Workflow className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
                <span className="text-blue-400 text-xs font-medium">PFATC Session</span>
              </div>
            )}
          </div>
        </Link>

        {/* 3-dot menu for photo cards */}
        {acarsUrl && (
          <div className="absolute top-3 right-10" ref={menuRef}>
            <button
              onClick={toggleMenu}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-black/40 transition-colors backdrop-blur-sm"
              aria-label="Flight options"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <MoreVertical className="h-4 w-4" />}
            </button>

            {menuOpen && (
              <div className="absolute top-8 right-0 z-30 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl shadow-black/40 py-1 min-w-40">
                <button onClick={handleShare} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                  <Share2 className="h-3.5 w-3.5 text-gray-400" />
                  Share flight
                </button>
                <button onClick={handleOpenAcars} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                  <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                  Open ACARS
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Standard info card (no photo) — matches Sessions card structure exactly
  return (
    <div className="relative">
      <Link
        to={`/my-flights/${flight.id}`}
        className="bg-gray-800/50 border-2 border-gray-700 hover:border-blue-600/50 rounded-3xl p-5 transition-all hover:bg-gray-800/70 block h-full"
      >
        {/* Header — icon + callsign, like Sessions icon + name */}
        <div className="flex items-center mb-3">
          <Plane className="h-5 w-5 text-blue-500 mr-2 shrink-0" />
          <span className="font-medium truncate text-md">{callsign}</span>
          {flight.featured_on_profile && (
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 ml-2 shrink-0" />
          )}
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm text-gray-300">
          <div className="flex items-center">
            <Route className="h-4 w-4 mr-2 text-gray-500 shrink-0" />
            <span className="font-mono font-medium text-white">{flight.departure || '----'}</span>
            <ArrowRight className="h-3.5 w-3.5 mx-1.5 text-gray-500 shrink-0" />
            <span className="font-mono font-medium text-white">{flight.arrival || '----'}</span>
          </div>
          <div className="flex items-center">
            <Plane className="h-4 w-4 mr-2 text-gray-500 shrink-0" />
            {flight.aircraft || 'Unknown aircraft'}
          </div>
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-2 text-gray-500 shrink-0" />
            {flight.created_at
              ? new Date(flight.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Unknown date'}
          </div>
          <div className="flex items-center">
            {flight.isPFATC ? (
              <>
                <Workflow className="h-4 w-4 mr-2 text-blue-400" />
                <span className="text-blue-400 font-medium">PFATC Session</span>
              </>
            ) : (
              <>
                <Workflow className="h-4 w-4 mr-2 text-green-400" />
                <span className="text-green-400 font-medium">Standard Session</span>
              </>
            )}
          </div>
        </div>

        {flight.notes && (
          <p className="mt-3 text-xs text-gray-500 italic truncate border-t border-gray-700/40 pt-2">
            {flight.notes}
          </p>
        )}
      </Link>

      {/* 3-dot menu */}
      {acarsUrl && (
        <div className="absolute top-4 right-4" ref={menuRef}>
          <button
            onClick={toggleMenu}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-700/60 transition-colors"
            aria-label="Flight options"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <MoreVertical className="h-4 w-4" />}
          </button>

          {menuOpen && (
            <div className="absolute top-8 right-0 z-30 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl shadow-black/40 py-1 min-w-40">
              <button onClick={handleShare} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                <Share2 className="h-3.5 w-3.5 text-gray-400" />
                Share flight
              </button>
              <button onClick={handleOpenAcars} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors">
                <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                Open ACARS
              </button>
            </div>
          )}
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
    fetchBackgrounds()
      .then(setAvailableImages)
      .catch((err) => console.error('Error loading images:', err));
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

  const totalSnaps = useMemo(
    () => flights.reduce((acc, f) => acc + (f.snap_images?.length ?? 0), 0),
    [flights]
  );

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
  }, [settings?.backgroundImage?.selectedImage, settings?.backgroundImage?.favorites, availableImages]);

  useEffect(() => {
    if (backgroundImage !== 'url("/assets/images/hero.webp")') {
      setCustomLoaded(true);
    }
  }, [backgroundImage]);

  // Bento grid layout: first photo flight spans 2 cols
  const bentoFlights = useMemo(() => {
    const withPhoto = filteredFlights.filter((f) => (f.snap_images?.length ?? 0) > 0);
    const withoutPhoto = filteredFlights.filter((f) => !(f.snap_images?.length ?? 0));
    // interleave: lead with photo flights, then info cards
    return [...withPhoto, ...withoutPhoto];
  }, [filteredFlights]);

  return (
    <div className="min-h-screen bg-gray-950 text-white relative">
      <Navbar />

      {/* Hero banner */}
      <div className="relative w-full h-80 md:h-96 overflow-hidden">
        <div className="absolute inset-0">
          <img src="/assets/images/hero.webp" alt="Banner" className="object-cover w-full h-full scale-110" />
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

        <div className="relative h-full flex flex-col items-center justify-center px-6 md:px-10 gap-3">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight text-center drop-shadow-lg">
            MY FLIGHTS
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="flex items-center justify-center gap-2 px-5 py-2 bg-blue-600/20 backdrop-blur-md border border-blue-500/30 rounded-full shadow-lg">
              <Plane className="h-4 w-4 text-blue-400" />
              <span className="text-blue-400 text-sm font-semibold tracking-wider">
                {flights.length} FLIGHT{flights.length === 1 ? '' : 'S'}
              </span>
            </div>
            {totalSnaps > 0 && (
              <div className="flex items-center justify-center gap-2 px-5 py-2 bg-purple-600/20 backdrop-blur-md border border-purple-500/30 rounded-full shadow-lg">
                <Camera className="h-4 w-4 text-purple-400" />
                <span className="text-purple-400 text-sm font-semibold tracking-wider">
                  {totalSnaps} SNAP{totalSnaps === 1 ? '' : 'S'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 pb-8 -mt-6 md:-mt-8 relative z-10">
        <div className="p-6 space-y-6">
          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search callsign, airport, aircraft..."
              className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border-2 border-zinc-700 rounded-full text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 hover:border-zinc-600"
            />
          </div>

          {/* Content */}
          {loading ? (
            <Loader />
          ) : error ? (
            <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-2xl text-red-300 text-sm">
              {error}
            </div>
          ) : bentoFlights.length === 0 ? (
            <div className="p-10 text-center bg-gray-800/50 border-2 border-gray-700 rounded-3xl">
              <div className="inline-block p-4 bg-blue-600/20 rounded-full mb-4">
                <Plane className="h-12 w-12 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No flights yet</h2>
              <p className="text-gray-400 mb-6">Submit a flight plan and it will show up here.</p>
              <Link
                to="/create"
                className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-all"
              >
                Create Session
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bentoFlights.map((flight, index) => {
                const hasPhoto = (flight.snap_images?.length ?? 0) > 0;
                // First photo flight gets large (2-col) treatment
                const isLarge = hasPhoto && index === 0 && bentoFlights.length > 1;
                return (
                  <div
                    key={String(flight.id)}
                    className={isLarge ? 'sm:col-span-2' : ''}
                  >
                    <FlightCard flight={flight} large={isLarge} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
