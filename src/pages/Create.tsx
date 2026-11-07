import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AlertTriangle, FolderOpen, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/auth/useAuth';
import { createSession, fetchMySessions } from '../utils/fetch/sessions';
import { generateATIS } from '../utils/fetch/atis';
import { updateTutorialStatus } from '../utils/fetch/auth';
import { steps } from '../components/tutorial/TutorialStepsCreate';
import { useData } from '../hooks/data/useData';
import Joyride, {
  type CallBackProps,
  STATUS,
} from 'react-joyride-react19-compat';
import { trackTutorialEvent } from '../utils/tutorialTracking';
import Navbar from '../components/Navbar';
import PageHero from '../components/common/PageHero';
import AirportCombobox from '../components/dropdowns/AirportCombobox';
import RunwaySelect from '../components/dropdowns/RunwaySelect';
import WindDisplay from '../components/tools/WindDisplay';
import AtisReminderModal from '../components/modals/AtisReminderModal';
import CustomTooltip from '../components/tutorial/CustomTooltip';
import SettingsGroup from '../components/Settings/SettingsGroup';
import SettingsRow from '../components/Settings/SettingsRow';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { minDuration } from '@/lib/minDuration';
import { Checkbox } from '@/components/ui/checkbox';
import { SIGNATURE_TONES } from '@/lib/signatureTones';

type NetworkSessionKind = 'standard' | 'pfatc' | 'advanced_atc';

function networkKindFromModeParam(
  mode: string | null
): NetworkSessionKind | null {
  if (!mode) return null;
  const normalized = mode.toLowerCase();
  if (normalized === 'pfatc') return 'pfatc';
  // AATC disabled — was: if (normalized === 'aatc' || normalized === 'advanced_atc') return 'advanced_atc';
  return null;
}

function initialNetworkKind(
  searchParams: URLSearchParams,
  startTutorial: boolean
): NetworkSessionKind {
  if (startTutorial) return 'pfatc';
  return networkKindFromModeParam(searchParams.get('mode')) ?? 'standard';
}

export default function Create() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startTutorial = searchParams.get('tutorial') === 'true';
  const [selectedAirport, setSelectedAirport] = useState<string>('');
  const [selectedRunway, setSelectedRunway] = useState<string>('');
  const [selectedArrivalRunway, setSelectedArrivalRunway] =
    useState<string>('');
  const [networkKind, setNetworkKind] = useState<NetworkSessionKind>(() =>
    initialNetworkKind(searchParams, startTutorial)
  );
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [sessionLimitReached, setSessionLimitReached] =
    useState<boolean>(false);
  const [showAtisReminderModal, setShowAtisReminderModal] = useState(false);
  const [createdSession, setCreatedSession] = useState<{
    sessionId: string;
    accessId: string;
    atisText: string;
    networkSessionKind: 'pfatc' | 'advanced_atc';
  } | null>(null);
  const { user } = useAuth();
  const { airports, frequencies } = useData();
  const maxSessions = user?.limits?.maxSessions ?? 50;

  useEffect(() => {
    if (user) {
      fetchMySessions()
        .then((sessions) => {
          setSessionCount(sessions.length);
          setSessionLimitReached(sessions.length >= maxSessions);
        })
        .catch(console.error)
        .finally(() => setSessionsLoaded(true));
    }
  }, [user, maxSessions]);

  const handleContinueToSession = (sessionId: string, accessId: string) => {
    const tutorialParam = startTutorial ? '&tutorial=true' : '';
    navigate(`/view/${sessionId}?accessId=${accessId}${tutorialParam}`);
  };

  const handleCreateSession = async () => {
    if (!selectedAirport || !selectedRunway || sessionLimitReached) return;

    setIsCreating(true);
    void import('./Flights');

    try {
      const effectiveKind: NetworkSessionKind = startTutorial
        ? 'pfatc'
        : networkKind;
      const newSession = await minDuration(
        createSession({
          airportIcao: selectedAirport,
          activeRunway: selectedRunway,
          arrivalRunway: selectedArrivalRunway || undefined,
          isPFATC: effectiveKind === 'pfatc',
          isAdvancedATC: false, // AATC disabled — was: effectiveKind === 'advanced_atc'
          createdBy: user?.userId || 'unknown',
          isTutorial: startTutorial,
        })
      );

      let atisResponse = null;
      try {
        const landingRunways = selectedArrivalRunway
          ? [selectedArrivalRunway]
          : [selectedRunway];
        const departingRunways = [selectedRunway];

        atisResponse = await generateATIS({
          sessionId: newSession.sessionId,
          ident: 'A',
          icao: selectedAirport,
          landing_runways: landingRunways,
          departing_runways: departingRunways,
        });
      } catch (atisError) {
        console.warn(
          'Failed to generate ATIS during session creation:',
          atisError
        );
      }

      const showAtisReminder =
        effectiveKind === 'pfatc' && // AATC disabled — was: (effectiveKind === 'pfatc' || effectiveKind === 'advanced_atc')
        atisResponse?.atisText;
      if (showAtisReminder) {
        setCreatedSession({
          sessionId: newSession.sessionId,
          accessId: newSession.accessId,
          atisText: atisResponse?.atisText || '',
          networkSessionKind: 'pfatc', // AATC disabled — was: effectiveKind === 'advanced_atc' ? 'advanced_atc' : 'pfatc'
        });
        setShowAtisReminderModal(true);
      } else {
        handleContinueToSession(newSession.sessionId, newSession.accessId);
      }
    } catch (err) {
      console.error('Error creating session:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create session';
      toast.error(errorMessage);

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
    trackTutorialEvent('create', data);
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      updateTutorialStatus(true);
    }
  };

  return (
    <div className="shadcn-scope min-h-screen bg-background text-foreground">
      <Navbar />

      <PageHero title="CREATE SESSION">
        <div
          id="session-count-info"
          className="flex items-center gap-2 text-sm font-medium text-zinc-200 tabular-nums"
        >
          <FolderOpen className="size-4 text-blue-400" />
          {sessionsLoaded ? (
            `${sessionCount}/${maxSessions} sessions`
          ) : (
            <Skeleton className="h-4 w-24" />
          )}
        </div>
      </PageHero>

      <div className="relative z-10 mx-auto -mt-6 w-full max-w-3xl min-w-0 px-4 pb-16 sm:px-6 md:-mt-8">
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateSession();
          }}
        >
          {sessionLimitReached && (
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-start gap-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                <p>
                  <span className="font-medium text-amber-300">
                    Session limit reached.
                  </span>{' '}
                  <span className="text-muted-foreground">
                    Delete an old session to create a new one.
                  </span>
                </p>
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className={SIGNATURE_TONES.amber}
              >
                <Link to="/sessions">Manage sessions</Link>
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <SettingsGroup>
              <div id="airport-dropdown">
                <SettingsRow
                  htmlFor="create-airport"
                  label={
                    <>
                      Airport <span className="text-red-400">*</span>
                    </>
                  }
                  description="The airport you'll be controlling."
                >
                  <div className="w-full sm:w-72">
                    <AirportCombobox
                      id="create-airport"
                      value={selectedAirport}
                      onChange={(airport) => {
                        setSelectedAirport(airport);
                        setSelectedRunway('');
                        setSelectedArrivalRunway('');
                      }}
                      disabled={isCreating}
                    />
                  </div>
                </SettingsRow>
              </div>
              <div id="runway-dropdown">
                <SettingsRow
                  htmlFor="create-departure"
                  label={
                    <>
                      Departure runway <span className="text-red-400">*</span>
                    </>
                  }
                  description="Used for departures and the ATIS."
                >
                  <div className="w-full sm:w-72">
                    <RunwaySelect
                      id="create-departure"
                      airportIcao={selectedAirport}
                      value={selectedRunway}
                      onChange={setSelectedRunway}
                      disabled={isCreating}
                    />
                  </div>
                </SettingsRow>
              </div>
              <div id="arrival-runway-dropdown">
                <SettingsRow
                  htmlFor="create-arrival"
                  label={
                    <>
                      Arrival runway{' '}
                      <span className="font-normal text-zinc-500">
                        (optional)
                      </span>
                    </>
                  }
                  description="Leave empty to land on the departure runway."
                >
                  <div className="w-full sm:w-72">
                    <RunwaySelect
                      id="create-arrival"
                      airportIcao={selectedAirport}
                      value={selectedArrivalRunway}
                      onChange={setSelectedArrivalRunway}
                      disabled={isCreating}
                      placeholder="Same as departure"
                      noneLabel="Same as departure"
                    />
                  </div>
                </SettingsRow>
              </div>
            </SettingsGroup>

            {selectedAirport && (
              <WindDisplay
                icao={selectedAirport}
                className="rounded-2xl border-zinc-800 bg-zinc-950"
              />
            )}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <div id="network-session-options">
                <SettingsRow
                  htmlFor="pfatc-checkbox"
                  className="sm:items-start"
                  label={
                    <span className="block text-base leading-6">
                      I am controlling on the{' '}
                      <a
                        href="https://discord.gg/pfatc"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-400 underline underline-offset-4 hover:text-blue-300"
                      >
                        PFATC Network
                      </a>
                    </span>
                  }
                  description={
                    networkKind === 'pfatc' && !startTutorial ? (
                      <span className="text-[15px]">
                        All submitted flights will be publicly viewable on the
                        Network Overview page. Flights are shared between
                        sessions, allowing controllers to see the arrivals and
                        traffic of other open sessions.
                      </span>
                    ) : undefined
                  }
                >
                  <Checkbox
                    id="pfatc-checkbox"
                    checked={startTutorial || networkKind === 'pfatc'}
                    onCheckedChange={(checked) =>
                      setNetworkKind(checked === true ? 'pfatc' : 'standard')
                    }
                    disabled={startTutorial || isCreating}
                    className="mt-1"
                  />
                </SettingsRow>
              </div>
            </div>

            <Button
              id="create-session-btn"
              type="submit"
              className="h-10 w-full rounded-xl sm:mt-2 sm:w-auto"
              disabled={
                isCreating ||
                sessionLimitReached ||
                !selectedAirport ||
                !selectedRunway
              }
            >
              {isCreating ? <Loader2 className="animate-spin" /> : <Plus />}
              {isCreating
                ? 'Creating session…'
                : sessionLimitReached
                  ? 'Session limit reached'
                  : 'Create session'}
            </Button>
          </div>
        </form>
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

      {/* ATIS Reminder Modal */}
      {showAtisReminderModal && createdSession && user && (
        <AtisReminderModal
          onContinue={() => {
            setShowAtisReminderModal(false);
            handleContinueToSession(
              createdSession.sessionId,
              createdSession.accessId
            );
          }}
          atisText={createdSession.atisText}
          accessId={createdSession.accessId}
          userId={user.userId}
          sessionId={createdSession.sessionId}
          airportIcao={selectedAirport}
          airportName={
            airports.find((a) => a.icao === selectedAirport)?.name ||
            selectedAirport
          }
          airportControlName={
            airports.find((a) => a.icao === selectedAirport)?.controlName ||
            selectedAirport
          }
          airportAppFrequency={(() => {
            const airportObj = airports.find((a) => a.icao === selectedAirport);
            const freqObj = frequencies.find((f) => f.icao === selectedAirport);
            const order = ['APP', 'TWR', 'GND', 'DEL'];
            for (const key of order) {
              const fromAirport = airportObj?.allFrequencies?.[key];
              const fromFreqs = freqObj?.[key];
              if (fromAirport && fromAirport !== 'n/a') return fromAirport;
              if (fromFreqs && fromFreqs !== 'n/a') return fromFreqs;
            }
            return 'n/a';
          })()}
          airportFrequencyType={(() => {
            const airportObj = airports.find((a) => a.icao === selectedAirport);
            const freqObj = frequencies.find((f) => f.icao === selectedAirport);
            const order = ['APP', 'TWR', 'GND', 'DEL'];
            for (const key of order) {
              const fromAirport = airportObj?.allFrequencies?.[key];
              const fromFreqs = freqObj?.[key];
              if (
                (fromAirport && fromAirport !== 'n/a') ||
                (fromFreqs && fromFreqs !== 'n/a')
              )
                return key;
            }
            return 'APP';
          })()}
          networkSessionKind={createdSession.networkSessionKind}
        />
      )}
    </div>
  );
}
