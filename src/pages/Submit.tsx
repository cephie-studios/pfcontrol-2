import React, { useEffect, useState } from 'react';
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
  MapPinCheck,
  Plane,
} from 'lucide-react';
import { createFlightsSocket } from '../sockets/flightsSocket';
import { addFlight } from '../utils/fetch/flights';
import { useAuth } from '../hooks/auth/useAuth';
import { useSettings } from '../hooks/settings/useSettings';
import type { Flight } from '../types/flight';
import AirportDropdown from '../components/dropdowns/AirportDropdown';
import Dropdown from '../components/common/Dropdown';
import AircraftDropdown from '../components/dropdowns/AircraftDropdown';
import Loader from '../components/common/Loader';
import AccessDenied from '../components/AccessDenied';
import CallsignInput from '../components/common/CallsignInput';

interface SessionData {
  sessionId: string;
  airportIcao: string;
  activeRunway?: string;
  atis?: unknown;
  isPFATC?: boolean;
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
  const [testerGateEnabled, setTesterGateEnabled] = useState(false);
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
      .then(([sessionData, settings]) => {
        setSession(sessionData);
        setTesterGateEnabled(settings.tester_gate_enabled || false);
        setForm((f) => ({
          ...f,
          departure: sessionData.airportIcao || '',
        }));
        setInitialLoadComplete(true);
      })
      .catch(() => setError('Session not found'))
      .finally(() => setLoading(false));
  }, [sessionId, initialLoadComplete]);

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
      } catch {
        setError('Failed to submit flight.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleCreateAnother = () => {
    setSuccess(false);
    setSubmittedFlight(null);
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
      {/* Banner */}
      <div className="relative w-full h-56 md:h-72 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent">
          <img
            src="/assets/app/backgrounds/mdpc_01.webp"
            alt="Banner"
            className="object-cover w-full h-full blur-xs scale-110 opacity-60"
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center p-6 md:p-10">
          {session.airportIcao ? (
            <h2
              className="text-3xl sm:text-5xl font-extrabold text-blue-500 mb-6"
              style={{ lineHeight: 1.4 }}
            >
              <span>{session.airportIcao}</span> - SUBMIT FLIGHT PLAN
            </h2>
          ) : (
            'SUBMIT FLIGHT PLAN'
          )}
          {session.activeRunway && (
            <div className="-mt-6 text-blue-400 text-md">
              Departure Runway:{' '}
              <span className="font-semibold">{session.activeRunway}</span>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 pb-8 pt-8">
        <div className="mb-8 relative z-10">
          <WindDisplay icao={session.airportIcao} />
        </div>
        {/* Success Message */}
        {success && submittedFlight && (
          <>
            <div className="bg-green-900/30 border border-green-700 rounded-xl mb-8 overflow-hidden relative z-10">
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
                      onClick={() =>
                        navigate(
                          `/acars/${sessionId}/${submittedFlight.id}?acars_token=${submittedFlight.acars_token}`
                        )
                      }
                    >
                      <Plane className="h-5 w-5 mr-2 rotate-45" />
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

        {/* Form */}
        {!success && (
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 shadow-xl overflow-hidden relative z-10">
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="p-3 bg-red-900/40 border border-red-700 rounded-md flex items-center text-sm mb-2">
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
                <input
                  type="text"
                  name="route"
                  value={form.route}
                  onChange={(e) => handleChange('route')(e.target.value)}
                  placeholder="e.g. HAZEL NOVMA LEDGO"
                  className="flex items-center w-full pl-6 p-3 bg-gray-800 border-2 border-blue-600 rounded-full text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                />
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
                    <>
                      <MapPinCheck className="h-5 w-5 mr-2" />
                      Submit Flight Plan
                    </>
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