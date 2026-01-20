import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import WindDisplay from '../components/tools/WindDisplay';
import Button from '../components/common/Button';
import {
  Check,
  AlertTriangle,
  PlaneTakeoff,
  PlaneLanding,
  Navigation,
  ArrowUpDown,
  Route,
  StickyNote,
  BadgeCheck,
  PlusCircle,
  ClipboardList,
  ParkingCircle,
  Loader2,
  Plane,
  HelpCircle,
  TowerControl,
} from 'lucide-react';
import { createFlightsSocket } from '../sockets/flightsSocket';
import { addFlight } from '../utils/fetch/flights';
import { useAuth } from '../hooks/auth/useAuth';
import { useSettings } from '../hooks/settings/useSettings';
import { fetchBackgrounds, fetchRoute } from '../utils/fetch/data';
import type { Flight } from '../types/flight';
import AirportDropdown from '../components/dropdowns/AirportDropdown';
import Dropdown from '../components/common/Dropdown';
import AircraftDropdown from '../components/dropdowns/AircraftDropdown';
import Loader from '../components/common/Loader';
import AccessDenied from '../components/AccessDenied';
import CallsignInput from '../components/common/CallsignInput';
import ControllerRatingPopup from '../components/tools/ControllerRatingPopup';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

interface SessionData {
  sessionId: string;
  airportIcao: string;
  activeRunway?: string;
  atis?: unknown;
  isPFATC?: boolean;
  createdBy: string;
}

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

export default function Submit() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const accessId = searchParams.get('accessId') ?? undefined;
  const { user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submittedFlight, setSubmittedFlight] = useState<Flight | null>(null);
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [customLoaded, setCustomLoaded] = useState(false);
  const [form, setForm] = useState({
    callsign: '',
    aircraft_type: '',
    departure: '',
    arrival: '',
    route: '',
    stand: '',
    remark: '',
    flight_type: 'IFR',
    cruisingFL: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  const [flightsSocket, setFlightsSocket] = useState<ReturnType<
    typeof createFlightsSocket
  > | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    if (
      success &&
      submittedFlight &&
      session?.isPFATC &&
      (settings?.acars?.autoRedirectToAcars ?? true)
    ) {
      if (session?.createdBy && session.createdBy !== user?.userId) return;
      navigate(
        `/acars/${sessionId}/${submittedFlight.id}?acars_token=${submittedFlight.acars_token}`
      );
    }
  }, [
    success,
    submittedFlight,
    session?.isPFATC,
    settings?.acars?.autoRedirectToAcars,
    sessionId,
    navigate,
    session?.createdBy,
    user?.userId,
  ]);

  useEffect(() => {
    if (!sessionId || initialLoadComplete) return;

    setLoading(true);

    Promise.all([
      fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/sessions/${sessionId}/submit`
      ).then((res) => (res.ok ? res.json() : Promise.reject(res))),
      fetch(`${import.meta.env.VITE_SERVER_URL}/api/data/settings`).then(
        (res) => (res.ok ? res.json() : Promise.reject(res))
      ),
    ])
      .then(([sessionData]) => {
        console.log('Session data loaded for submit:', sessionData);
        setSession(sessionData);
        setForm((f) => ({
          ...f,
          departure: sessionData.airportIcao || '',
        }));
        setInitialLoadComplete(true);
      })
      .catch((err) => {
        console.error('Error loading session data:', err);
        setError('Session not found');
      })
      .finally(() => setLoading(false));
  }, [sessionId, initialLoadComplete]);

  useEffect(() => {
    const loadImages = async () => {
      try {
        const data = await fetchBackgrounds();
        setAvailableImages(data);
      } catch (error) {
        console.error('Error loading available images:', error);
      }
    };
    loadImages();
  }, []);

  useEffect(() => {
    if (!sessionId || !accessId || !initialLoadComplete) return;

    const socket = createFlightsSocket(
      sessionId,
      accessId,
      user?.userId || '',
      user?.username || '',
      (flight: Flight) => {
        setSubmittedFlight(flight);
        setSuccess(true);
        setIsSubmitting(false);
        if (session?.createdBy && session.createdBy !== user?.userId) {
          setShowRating(true);
        }
      },
      () => {},
      () => {},
      (error) => {
        console.error('Flight error:', error);
        setError('Failed to submit flight.');
        setIsSubmitting(false);
      }
    );

    setFlightsSocket(socket);

    return () => {
      socket.socket.disconnect();
    };
  }, [sessionId, accessId, initialLoadComplete]);

  const backgroundImage = useMemo(() => {
    const selectedImage = settings?.backgroundImage?.selectedImage;
    let bgImage = 'url("/assets/app/backgrounds/mdpc_01.webp")';

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
    if (backgroundImage !== 'url("/assets/app/backgrounds/mdpc_01.webp")') {
      setCustomLoaded(true);
    }
  }, [backgroundImage]);

  const handleChange = (name: string) => (value: string) => {
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    setError('');
    setSuccess(false);
    setIsSubmitting(true);

    if (!form.callsign || !form.arrival || !form.aircraft_type) {
      setError('Please fill all required fields.');
      setIsSubmitting(false);
      return;
    }

    if (flightsSocket) {
      flightsSocket.addFlight({
        ...form,
        flight_type: form.flight_type,
        cruisingFL: form.cruisingFL,
        status: 'PENDING',
      });
    } else {
      try {
        const flight = await addFlight(sessionId!, {
          ...form,
          flight_type: form.flight_type,
          cruisingFL: form.cruisingFL,
          status: 'PENDING',
        });
        setSubmittedFlight(flight);
        setSuccess(true);
        if (session?.createdBy && session.createdBy !== user?.userId) {
          setShowRating(true);
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Callsign')) {
            setError(
              `Callsign error: ${error.message}. Callsign must contain at least one number.`
            );
          } else if (error.message.includes('Stand')) {
            setError(
              `Stand error: ${error.message}. Stand can only contain numbers and letters.`
            );
          } else if (error.message.includes('Cruising FL')) {
            setError(`Flight Level error: ${error.message}`);
          } else if (error.message.includes('Squawk')) {
            setError(`Squawk error: ${error.message}`);
          } else {
            setError(`${error.message}`);
          }
        } else {
          setError('Failed to submit flight. Please try again.');
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleCreateAnother = () => {
    setSuccess(false);
    setSubmittedFlight(null);
    setShowRating(false);
    setForm({
      callsign: '',
      aircraft_type: '',
      departure: session?.airportIcao || '',
      arrival: '',
      route: '',
      stand: '',
      remark: '',
      flight_type: 'IFR',
      cruisingFL: '',
    });
  };

  const handleGenerateRoute = async () => {
    if (!form.departure || !form.arrival) {
      setError(
        'Please select both departure and arrival airports to generate a route.'
      );
      return;
    }

    setError('');
    setIsGeneratingRoute(true);

    const minimumDelay = new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const [routeData] = await Promise.all([
        fetchRoute(form.departure, form.arrival),
        minimumDelay,
      ]);

      if (routeData.success) {
        const route = routeData.path
          .map((point: { name: string }) => point.name)
          .join(', ');
        setForm((f) => ({ ...f, route }));
      } else {
        setError('Failed to generate a route. Please try again.');
      }
    } catch (error) {
      console.error('Error generating route:', error);
      setError('An error occurred while generating the route.');
    } finally {
      setIsGeneratingRoute(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Navbar />
        <Loader />
      </div>
    );
  }

  if (!sessionId || !session) {
    return <AccessDenied errorType="invalid-session" />;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white relative">
      <Navbar />
      <div className="relative w-full h-96 md:h-[32rem] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/assets/app/backgrounds/mdpc_01.webp"
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
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/70 to-gray-950"></div>
        </div>

        {/* Content */}
        <div className="relative h-full flex flex-col items-center justify-center px-6 md:px-10">
          <div className="flex gap-4 mb-4">
            {session.airportIcao && (
              <div className="px-6 py-2 bg-blue-600/20 backdrop-blur-md border border-blue-500/30 rounded-full shadow-lg">
                <span className="text-blue-400 text-sm font-semibold tracking-wider">
                  {session.airportIcao}
                </span>
              </div>
            )}
            {session.activeRunway && (
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/80 backdrop-blur-sm border border-gray-700/40 rounded-full">
                <PlaneTakeoff className="h-4 w-4 text-blue-400" />
                <span className="text-gray-300 text-sm">
                  RWY{' '}
                  <span className="font-bold text-blue-400">
                    {session.activeRunway}
                  </span>
                </span>
              </div>
            )}
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight text-center">
            SUBMIT FLIGHT PLAN
          </h1>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 pb-8 -mt-32 md:-mt-40 relative z-10">
        <div className="mb-6">
          <WindDisplay icao={session.airportIcao} />
        </div>

        {/* Controller Rating (Inline Version) */}
        {showRating && session?.createdBy && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <ControllerRatingPopup
              controllerId={session.createdBy}
              flightId={submittedFlight?.id?.toString()}
              onClose={() => setShowRating(false)}
              isInline={true}
            />
          </div>
        )}

        {/* Success Message */}
        {success && submittedFlight && (
          <>
            <div className="bg-green-900/30 backdrop-blur-md border border-green-700 rounded-3xl mb-8 overflow-hidden shadow-2xl">
              <div className="bg-green-900/50 p-4 border-b border-green-700 flex items-center">
                <div className="bg-green-700 rounded-full p-2 mr-3">
                  <Check className="h-6 w-6 text-green-200" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-200">
                    Flight Plan Submitted Successfully!
                  </h3>
                  <p className="text-green-300 text-sm">
                    Your flight plan has been submitted to ATC and is awaiting
                    clearance.
                  </p>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <ClipboardList className="h-5 w-5 text-green-400 mr-2" />
                  <h4 className="text-lg font-semibold text-green-200">
                    Flight Plan Details
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-400">
                        Callsign:
                      </span>
                      <p className="text-white font-semibold">
                        {submittedFlight.callsign}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-400">
                        Aircraft:
                      </span>
                      <p className="text-white">{submittedFlight.aircraft}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-400">
                        Flight Type:
                      </span>
                      <p className="text-white">
                        {submittedFlight.flight_type}
                      </p>
                    </div>
                    {submittedFlight.stand && (
                      <div>
                        <span className="text-sm font-medium text-gray-400">
                          Stand:
                        </span>
                        <p className="text-white">{submittedFlight.stand}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-400">
                        Departure:
                      </span>
                      <p className="text-white">{submittedFlight.departure}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-400">
                        Arrival:
                      </span>
                      <p className="text-white">{submittedFlight.arrival}</p>
                    </div>
                    {submittedFlight.route && (
                      <div>
                        <span className="text-sm font-medium text-gray-400">
                          Route:
                        </span>
                        <p className="text-white font-mono">
                          {submittedFlight.route}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                {submittedFlight.remark && (
                  <div className="mt-4 pt-4 border-t border-green-800">
                    <span className="text-sm font-medium text-gray-400">
                      Remarks:
                    </span>
                    <p className="text-white mt-1">{submittedFlight.remark}</p>
                  </div>
                )}
                <div className="mt-6 pt-4 border-t border-green-800 space-x-2">
                      {session?.isPFATC && (
                        <Button
                          onClick={() => {
                            setShowRating(false);
                            navigate(
                              `/acars/${sessionId}/${submittedFlight.id}?acars_token=${submittedFlight.acars_token}`
                            );
                          }}
                        >
                          <TowerControl className="h-5 w-5 mr-2" />
                          Go to ACARS
                        </Button>
                      )}
                  <Button onClick={handleCreateAnother} variant="outline">
                    <PlusCircle className="h-5 w-5 mr-2" />
                    Create Another Flight Plan
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {!success && (
          <div className="bg-gray-900/70 backdrop-blur-md rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="p-3 bg-red-900/40 border border-red-700 rounded-full flex items-center text-sm mb-2">
                  <AlertTriangle className="h-5 w-5 mr-2 text-red-400" />
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                      <BadgeCheck className="h-4 w-4 mr-2 text-gray-400" />
                      Callsign <span className="text-red-400 ml-1">*</span>
                      <button
                        type="button"
                        className="ml-2 text-blue-400 hover:text-blue-300 transition-colors"
                        aria-label="Callsign formatting help"
                        title="Callsign formatting help"
                      >
                        <HelpCircle
                          onClick={() =>
                            window.open(
                              'https://vatsim.net/docs/basics/choosing-a-callsign#2-flight-identification-flight-number',
                              '_blank'
                            )
                          }
                          className="h-4 w-4"
                        />
                      </button>
                    </label>
                    <CallsignInput
                      value={form.callsign}
                      onChange={handleChange('callsign')}
                      required
                      placeholder="e.g. DLH123"
                      maxLength={16}
                    />
                  </div>
                  <div>
                    <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                      <Plane className="h-4 w-4 mr-2 text-gray-400" />
                      Aircraft Type <span className="text-red-400 ml-1">*</span>
                    </label>
                    <AircraftDropdown
                      value={form.aircraft_type}
                      onChange={handleChange('aircraft_type')}
                    />
                  </div>
                  <div>
                    <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                      <Navigation className="h-4 w-4 mr-2 text-gray-400" />
                      Flight Type <span className="text-red-400 ml-1">*</span>
                    </label>
                    <Dropdown
                      value={form.flight_type}
                      onChange={handleChange('flight_type')}
                      placeholder="IFR or VFR"
                      options={[
                        { label: 'IFR', value: 'IFR' },
                        { label: 'VFR', value: 'VFR' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                      <ParkingCircle className="h-4 w-4 mr-2 text-gray-400" />
                      Stand
                    </label>
                    <input
                      type="text"
                      name="stand"
                      value={form.stand}
                      onChange={(e) => handleChange('stand')(e.target.value)}
                      placeholder="e.g. A12"
                      className="flex items-center w-full pl-6 p-3 bg-gray-800 border-2 border-blue-600 rounded-full text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                      <PlaneTakeoff className="h-4 w-4 mr-2 text-gray-400" />
                      Departure Airport
                    </label>
                    <AirportDropdown
                      value={form.departure}
                      onChange={handleChange('departure')}
                      disabled
                    />
                  </div>
                  <div>
                    <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                      <PlaneLanding className="h-4 w-4 mr-2 text-gray-400" />
                      Arrival Airport{' '}
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <AirportDropdown
                      value={form.arrival}
                      onChange={handleChange('arrival')}
                    />
                  </div>
                  <div>
                    <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                      <ArrowUpDown className="h-4 w-4 mr-2 text-gray-400" />
                      Cruising Flight Level{' '}
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      name="cruisingFL"
                      value={form.cruisingFL}
                      onChange={(e) =>
                        handleChange('cruisingFL')(e.target.value)
                      }
                      placeholder="e.g. 350"
                      className="flex items-center w-full pl-6 p-3 bg-gray-800 border-2 border-blue-600 rounded-full text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                      required
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                  <Route className="h-4 w-4 mr-2 text-gray-400" />
                  Route
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="route"
                    value={form.route}
                    onChange={(e) => handleChange('route')(e.target.value)}
                    placeholder="e.g. HAZEL NOVMA LEDGO"
                    className="flex items-center w-full pl-6 pr-28 p-3 bg-gray-800 border-2 border-blue-600 rounded-full text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateRoute}
                    disabled={isGeneratingRoute}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {isGeneratingRoute ? (
                      <div className="py-0.5">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      'Generate'
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="flex items-center mb-2 text-sm font-medium text-gray-300">
                  <StickyNote className="h-4 w-4 mr-2 text-gray-400" />
                  Remarks
                </label>
                <input
                  type="text"
                  name="remark"
                  value={form.remark}
                  onChange={(e) => handleChange('remark')(e.target.value)}
                  placeholder="Any additional information"
                  className="flex items-center w-full pl-6 p-3 bg-gray-800 border-2 border-blue-600 rounded-full text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                />
              </div>

              <div className="mt-8">
                <Button
                  type="submit"
                  className="w-full flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-full transition-colors disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      Submitting...
                    </>
                  ) : (
                    <>Submit Flight Plan</>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
