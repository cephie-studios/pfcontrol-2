import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Check,
  ExternalLink,
  MoreVertical,
  Plane,
  Route,
  Search,
  Share2,
  Star,
  Workflow,
} from 'lucide-react';
import {
  claimSubmittedFlight,
  fetchMyFlights,
  toggleFeaturedOnProfile,
} from '../utils/fetch/flights';
import type { Flight } from '../types/flight';
import Navbar from '../components/Navbar';
import { useSettings } from '../hooks/settings/useSettings';
import { fetchBackgrounds } from '../utils/fetch/data';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

const FlightCardSkeleton = () => (
  <div className="bg-gray-800/50 border-2 border-gray-700 rounded-3xl p-5 animate-pulse">
    <div className="flex items-center mb-3 gap-2">
      <div className="h-5 w-5 rounded-full bg-gray-700 shrink-0" />
      <div className="h-4 w-28 rounded-full bg-gray-700" />
    </div>
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-gray-700 shrink-0" />
        <div className="h-3.5 w-36 rounded-full bg-gray-700" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-gray-700 shrink-0" />
        <div className="h-3.5 w-32 rounded-full bg-gray-700" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-gray-700 shrink-0" />
        <div className="h-3.5 w-24 rounded-full bg-gray-700" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-gray-700 shrink-0" />
        <div className="h-3.5 w-28 rounded-full bg-gray-700" />
      </div>
    </div>
  </div>
);

function FlightCard({
  flight,
  featuredCount,
  onFeaturedToggle,
}: {
  flight: Flight;
  featuredCount: number;
  onFeaturedToggle: (id: string, featured: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [featured, setFeatured] = useState(flight.featured_on_profile ?? false);
  const [featuredLoading, setFeaturedLoading] = useState(false);
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
  const atCap = !featured && featuredCount >= 3;

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

  const handleToggleFeatured = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (featuredLoading || atCap) return;
    setFeaturedLoading(true);
    try {
      const result = await toggleFeaturedOnProfile(String(flight.id));
      setFeatured(result.featured);
      onFeaturedToggle(String(flight.id), result.featured);
    } catch {
      // cap or network error
    } finally {
      setFeaturedLoading(false);
      setMenuOpen(false);
    }
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen((v) => !v);
  };

  const dropdown = menuOpen && (
    <div className="absolute top-8 right-0 z-30 w-44 bg-zinc-900 border border-blue-600 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden animate-in slide-in-from-top-1 duration-150">
      <div className="p-1.5">
        <button
          onClick={handleToggleFeatured}
          disabled={featuredLoading || atCap}
          className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-2xl transition-colors duration-150 text-sm ${
            atCap
              ? 'text-zinc-600 cursor-not-allowed'
              : featured
                ? 'text-amber-400 hover:bg-amber-600/20'
                : 'text-zinc-400 hover:bg-blue-800 hover:text-zinc-50'
          }`}
        >
          <Star
            className={`h-4 w-4 shrink-0 ${featured ? 'fill-amber-400' : ''}`}
          />
          <span className="font-medium">
            {featured
              ? 'Unfeature'
              : atCap
                ? 'Max 3 featured'
                : 'Feature flight'}
          </span>
        </button>
        <button
          onClick={handleShare}
          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-2xl text-zinc-400 hover:bg-blue-800 hover:text-zinc-50 transition-colors duration-150 text-sm"
        >
          <Share2 className="h-4 w-4 shrink-0" />
          <span className="font-medium">Share flight</span>
        </button>
        <button
          onClick={handleOpenAcars}
          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-2xl text-zinc-400 hover:bg-blue-800 hover:text-zinc-50 transition-colors duration-150 text-sm"
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          <span className="font-medium">Open ACARS</span>
        </button>
      </div>
    </div>
  );

  if (hasCover) {
    return (
      <div className="relative">
        <Link
          to={`/my-flights/${flight.id}`}
          className="relative overflow-hidden border-2 border-gray-700 hover:border-blue-600/50 rounded-3xl p-5 transition-all block h-full"
        >
          {/* Background image + overlay */}
          <img
            src={coverSnap!.url}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gray-900/70" />

          {/* Same content as standard card, positioned above the overlay */}
          <div className="relative">
            <div className="flex items-center mb-3">
              <Plane className="h-5 w-5 text-blue-500 mr-2 shrink-0" />
              <span className="font-medium truncate text-md">{callsign}</span>
              {featured && (
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 ml-2 shrink-0" />
              )}
            </div>
            <div className="space-y-2 text-sm text-gray-300">
              <div className="flex items-center">
                <Route className="h-4 w-4 mr-2 text-gray-500 shrink-0" />
                <span className="font-mono font-medium text-white">
                  {flight.departure || '----'}
                </span>
                <ArrowRight className="h-3.5 w-3.5 mx-1.5 text-gray-500 shrink-0" />
                <span className="font-mono font-medium text-white">
                  {flight.arrival || '----'}
                </span>
              </div>
              <div className="flex items-center">
                <Plane className="h-4 w-4 mr-2 text-gray-500 shrink-0" />
                {flight.aircraft || 'Unknown aircraft'}
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-gray-500 shrink-0" />
                {flight.created_at
                  ? new Date(flight.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Unknown date'}
              </div>
              <div className="flex items-center">
                {flight.isAdvancedATC ? (
                  <>
                    <Workflow className="h-4 w-4 mr-2 text-purple-400" />
                    <span className="text-purple-400 font-medium">
                      Advanced ATC Session
                    </span>
                  </>
                ) : flight.isPFATC ? (
                  <>
                    <Workflow className="h-4 w-4 mr-2 text-blue-400" />
                    <span className="text-blue-400 font-medium">
                      PFATC Session
                    </span>
                  </>
                ) : (
                  <>
                    <Workflow className="h-4 w-4 mr-2 text-green-400" />
                    <span className="text-green-400 font-medium">
                      Standard Session
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </Link>

        <div
          className="absolute top-4 right-4 flex items-center gap-2"
          ref={menuRef}
        >
          {acarsUrl && (
            <>
              <button
                onClick={toggleMenu}
                className="px-3 py-2 rounded-2xl text-blue-400 border-2 border-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                aria-label="Flight options"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <MoreVertical className="h-4 w-6" />
                )}
              </button>
              {dropdown}
            </>
          )}
        </div>
      </div>
    );
  }

  // Standard info card (no photo)
  return (
    <div className="relative">
      <Link
        to={`/my-flights/${flight.id}`}
        className="bg-gray-800/50 border-2 border-gray-700 hover:border-blue-600/50 rounded-3xl p-5 transition-all hover:bg-gray-800/70 block h-full"
      >
        {/* Header */}
        <div className="flex items-center mb-3">
          <Plane className="h-5 w-5 text-blue-500 mr-2 shrink-0" />
          <span className="font-medium truncate text-md">{callsign}</span>
          {featured && (
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 ml-2 shrink-0" />
          )}
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm text-gray-300">
          <div className="flex items-center">
            <Route className="h-4 w-4 mr-2 text-gray-500 shrink-0" />
            <span className="font-mono font-medium text-white">
              {flight.departure || '----'}
            </span>
            <ArrowRight className="h-3.5 w-3.5 mx-1.5 text-gray-500 shrink-0" />
            <span className="font-mono font-medium text-white">
              {flight.arrival || '----'}
            </span>
          </div>
          <div className="flex items-center">
            <Plane className="h-4 w-4 mr-2 text-gray-500 shrink-0" />
            {flight.aircraft || 'Unknown aircraft'}
          </div>
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-2 text-gray-500 shrink-0" />
            {flight.created_at
              ? new Date(flight.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Unknown date'}
          </div>
          <div className="flex items-center">
            {flight.isAdvancedATC ? (
              <>
                <Workflow className="h-4 w-4 mr-2 text-purple-400" />
                <span className="text-purple-400 font-medium">
                  Advanced ATC Session
                </span>
              </>
            ) : flight.isPFATC ? (
              <>
                <Workflow className="h-4 w-4 mr-2 text-blue-400" />
                <span className="text-blue-400 font-medium">PFATC Session</span>
              </>
            ) : (
              <>
                <Workflow className="h-4 w-4 mr-2 text-green-400" />
                <span className="text-green-400 font-medium">
                  Standard Session
                </span>
              </>
            )}
          </div>
        </div>
      </Link>

      {/* 3-dot menu */}
      {acarsUrl && (
        <div className="absolute top-4 right-4" ref={menuRef}>
          <button
            onClick={toggleMenu}
            className="px-3 py-2 rounded-2xl text-blue-400 border-2 border-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
            aria-label="Flight options"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <MoreVertical className="h-4 w-6" />
            )}
          </button>
          {dropdown}
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

  const featuredCount = useMemo(
    () => flights.filter((f) => f.featured_on_profile).length,
    [flights]
  );

  const handleFeaturedToggle = (id: string, newFeatured: boolean) => {
    setFlights((prev) =>
      prev.map((f) =>
        String(f.id) === id ? { ...f, featured_on_profile: newFeatured } : f
      )
    );
  };

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
      if (!filename || filename === 'random' || filename === 'favorites') {
        return filename;
      }
      if (filename.startsWith('https://api.cephie.app/')) {
        return filename;
      }
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
        const randomFav =
          favorites[Math.floor(Math.random() * favorites.length)];
        const favImageUrl = getImageUrl(randomFav);
        if (
          favImageUrl &&
          favImageUrl !== 'random' &&
          favImageUrl !== 'favorites'
        ) {
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
                {filteredFlights.length} FLIGHT
                {filteredFlights.length === 1 ? '' : 'S'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 pb-8 -mt-6 md:-mt-8 relative z-10">
        <div className="p-6 space-y-6">
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1 z-10 flex items-center justify-center">
              <Search className="h-5 w-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search callsign, airport, aircraft..."
              className="w-full bg-gray-900/70 backdrop-blur-md border-2 border-gray-800 rounded-full pl-12 pr-4 py-3 text-white font-semibold focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
            />
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <FlightCardSkeleton key={i} />
              ))}
            </div>
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
                <FlightCard
                  key={String(flight.id)}
                  flight={flight}
                  featuredCount={featuredCount}
                  onFeaturedToggle={handleFeaturedToggle}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
