import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Info, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/auth/useAuth';
import { createSession, fetchMySessions } from '../utils/fetch/sessions';
import { generateATIS } from '../utils/fetch/atis';
import Navbar from '../components/Navbar';
import AirportDropdown from '../components/dropdowns/AirportDropdown';
import RunwayDropdown from '../components/dropdowns/RunwayDropdown';
import Checkbox from '../components/common/Checkbox';
import Button from '../components/common/Button';
import WindDisplay from '../components/tools/WindDisplay';
import Joyride, { type CallBackProps, STATUS } from 'react-joyride';
import CustomTooltip from '../components/tutorial/CustomTooltip';
import { updateTutorialStatus } from '../utils/fetch/auth';
import { steps } from '../components/tutorial/TutorialStepsCreate';

export default function Create() {
  const navigate = useNavigate();
  const [selectedAirport, setSelectedAirport] = useState<string>('');
  const [selectedRunway, setSelectedRunway] = useState<string>('');
  const [isPFATCNetwork, setIsPFATCNetwork] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [sessionLimitReached, setSessionLimitReached] =
    useState<boolean>(false);
  const [isDeletingOldest, setIsDeletingOldest] = useState<boolean>(false);
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const startTutorial = searchParams.get('tutorial') === 'true';

  useEffect(() => {
    if (user) {
      fetchMySessions()
        .then((sessions) => {
          const maxSessions = user.isAdmin || user.isTester ? 50 : 10;
          setSessionCount(sessions.length);
          setSessionLimitReached(sessions.length >= maxSessions);
        })
        .catch(console.error);
    }
  }, [user]);

  const handleDeleteOldestSession = async () => {
    setIsDeletingOldest(true);
    setError('');

    try {
      setSessionCount((prev) => Math.max(0, prev - 1));
      setSessionLimitReached(false);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete oldest session'
      );
    } finally {
      setIsDeletingOldest(false);
    }
  };

  const handleContinueToSession = (sessionId: string, accessId: string) => {
    const tutorialParam = startTutorial ? '&tutorial=true' : '';
    navigate(`/view/${sessionId}?accessId=${accessId}${tutorialParam}`);
  };

  const handleCreateSession = async () => {
    if (!selectedAirport || !selectedRunway) {
      setError('Please select both airport and runway');
      return;
    }

    if (sessionLimitReached) {
      const maxSessions = user?.isAdmin || user?.isTester ? 50 : 10;
      setError(
        `Session limit reached. You can create up to ${maxSessions} sessions.`
      );
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const newSession = await createSession({
        airportIcao: selectedAirport,
        activeRunway: selectedRunway,
        isPFATC: isPFATCNetwork,
        createdBy: user?.userId || 'unknown',
        isTutorial: startTutorial,
      });

      setSessionCount((prev) => prev + 1);

      await generateATIS({
        sessionId: newSession.sessionId,
        ident: 'A',
        icao: selectedAirport,
        landing_runways: [selectedRunway],
        departing_runways: [selectedRunway],
      });

      handleContinueToSession(newSession.sessionId, newSession.accessId);
    } catch (err) {
      console.error('Error creating session:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create session';
      setError(errorMessage);

      if (
        errorMessage.includes('Session limit reached') ||
        errorMessage.includes('limit reached')
      ) {
        setSessionLimitReached(true);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      updateTutorialStatus(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-slate-900 text-white relative">
      <div className="relative z-10">
        <Navbar />
        <div className="max-w-xl mx-auto py-12 px-4 pt-40">
          <h2
            className="text-6xl font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent mb-6 text-center"
            style={{ lineHeight: 1.4 }}
          >
            Create Session
          </h2>

          <div className="bg-gray-800/70 backdrop-blur-sm border border-gray-700 rounded-lg p-6 space-y-6">
            {error && (
              <div className="p-3 bg-red-900/40 backdrop-blur-sm border-2 border-red-700 rounded-full flex items-center text-sm">
                <AlertCircle className="h-5 w-5 mr-2 text-red-400" />
                {error}
              </div>
            )}

            {/* Session Count Info */}
            <div
              id="session-count-info"
              className={`p-3 backdrop-blur-sm border-2 rounded-full flex items-center justify-between text-sm ${
                sessionLimitReached
                  ? 'bg-red-900/40 border-red-700'
                  : sessionCount >= (user?.isAdmin || user?.isTester ? 48 : 8) // Yellow at maxSessions - 2
                    ? 'bg-yellow-900/40 border-yellow-700'
                    : 'bg-blue-900/40 border-blue-500/50'
              }`}
            >
              <div className="flex items-center">
                <Info
                  className={`h-4 w-4 mr-2 ${
                    sessionLimitReached
                      ? 'text-red-400'
                      : sessionCount >=
                          (user?.isAdmin || user?.isTester ? 48 : 8)
                        ? 'text-yellow-400'
                        : 'text-blue-400'
                  }`}
                />
                <span>
                  Sessions: {sessionCount}/
                  {user?.isAdmin || user?.isTester ? 50 : 10}
                  {sessionLimitReached && ' (Limit reached)'}
                </span>
              </div>

              {sessionLimitReached && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleDeleteOldestSession}
                  disabled={isDeletingOldest}
                  className="flex items-center space-x-1 text-xs"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>
                    {isDeletingOldest ? 'Deleting...' : 'Delete Oldest'}
                  </span>
                </Button>
              )}
            </div>

            <div id="airport-dropdown" className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Select Airport <span className="text-red-400">*</span>
              </label>
              <AirportDropdown
                value={selectedAirport}
                onChange={(airport) => {
                  setSelectedAirport(airport);
                  setSelectedRunway('');
                  setError('');
                }}
                disabled={isCreating}
              />
            </div>

            <div id="runway-dropdown" className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Select Departure Runway <span className="text-red-400">*</span>
              </label>
              <RunwayDropdown
                airportIcao={selectedAirport}
                value={selectedRunway}
                onChange={(runway) => {
                  setSelectedRunway(runway);
                  setError('');
                }}
                disabled={isCreating || !selectedAirport}
              />
            </div>

            {selectedAirport && <WindDisplay icao={selectedAirport} />}

            <div className="border-t border-gray-700 pt-6">
              <Checkbox
                id="pfatc-checkbox"
                checked={startTutorial ? true : isPFATCNetwork}
                onChange={setIsPFATCNetwork}
                label="I am controlling on the PFATC Network"
                className="text-gray-300"
                disabled={startTutorial ? true : false}
              />
              {isPFATCNetwork && (
                <div className="mt-3 p-3 bg-blue-900/40 backdrop-blur-sm border border-blue-500/50 rounded-md">
                  <div className="flex items-start space-x-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <Info className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="text-sm">
                      <p className="text-blue-200 font-medium mb-1">
                        PFATC Network Session
                      </p>
                      <p className="text-blue-300">
                        All submitted flights will be publicly viewable on the
                        PFATC Network Overview page.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-700 pt-4">
              <Button
                id="create-session-btn"
                onClick={handleCreateSession}
                disabled={
                  !selectedAirport ||
                  !selectedRunway ||
                  isCreating ||
                  sessionLimitReached
                }
                className={`w-full ${
                  !selectedAirport ||
                  !selectedRunway ||
                  isCreating ||
                  sessionLimitReached
                    ? 'opacity-50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                }`}
              >
                {isCreating ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Creating Session...
                  </span>
                ) : sessionLimitReached ? (
                  'Session Limit Reached'
                ) : (
                  'Create Session'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Joyride
        steps={steps}
        run={startTutorial}
        callback={handleJoyrideCallback}
        continuous
        showProgress
        showSkipButton
        disableScrolling={true}
        tooltipComponent={CustomTooltip}
        styles={{
          options: {
            primaryColor: '#3b82f6',
            textColor: '#ffffff',
            backgroundColor: '#1f2937',
            zIndex: 1000,
          },
          spotlight: {
            border: '2px solid #fbbf24',
            borderRadius: '24px',
            boxShadow: '0 0 20px rgba(251, 191, 36, 0.5)',
          },
        }}
      />
    </div>
  );
}
