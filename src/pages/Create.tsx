import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AlertTriangle, FolderOpen, Info, Loader2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { minDuration } from '@/lib/minDuration';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

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

      <div className="relative z-10 mx-auto -mt-6 w-full max-w-[34rem] px-4 pb-16 md:-mt-8">
        <form
          className="flex flex-col gap-4 rounded-4xl border-2 border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
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
                className="border-2 border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-white focus-visible:bg-amber-500 focus-visible:text-white focus-visible:ring-0 dark:hover:bg-amber-500"
              >
                <Link to="/sessions">Manage sessions</Link>
              </Button>
            </div>
          )}

          <div id="airport-dropdown" className="grid gap-2">
            <Label htmlFor="create-airport" className="text-zinc-300">
              Select airport <span className="-ml-1 text-red-400">*</span>
            </Label>
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

          <div id="runway-dropdown" className="grid gap-2">
            <Label htmlFor="create-departure" className="text-zinc-300">
              Select departure runway{' '}
              <span className="-ml-1 text-red-400">*</span>
            </Label>
            <RunwaySelect
              id="create-departure"
              airportIcao={selectedAirport}
              value={selectedRunway}
              onChange={setSelectedRunway}
              disabled={isCreating}
            />
          </div>

          <div id="arrival-runway-dropdown" className="grid gap-2">
            <Label htmlFor="create-arrival" className="text-zinc-300">
              Select arrival runway
              <span className="font-normal text-zinc-500">(optional)</span>
            </Label>
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

          {selectedAirport && (
            <WindDisplay
              icao={selectedAirport}
              className="rounded-2xl border-zinc-800 bg-zinc-950"
            />
          )}

          <div
            id="network-session-options"
            className="flex flex-col gap-2 pt-1"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <span className="text-zinc-300">I am controlling on the</span>
              <label
                htmlFor="pfatc-checkbox"
                className="flex cursor-pointer items-center gap-3 has-disabled:cursor-not-allowed"
              >
                <Checkbox
                  id="pfatc-checkbox"
                  checked={startTutorial || networkKind === 'pfatc'}
                  onCheckedChange={(checked) =>
                    setNetworkKind(checked === true ? 'pfatc' : 'standard')
                  }
                  disabled={startTutorial || isCreating}
                />
                <a
                  href="https://discord.gg/pfatc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-400 underline underline-offset-4 hover:text-blue-300"
                >
                  PFATC Network
                </a>
              </label>
            </div>
            {networkKind === 'pfatc' && !startTutorial && (
              <div className="flex animate-in items-start gap-2 text-sm text-zinc-400 fade-in-0 slide-in-from-top-1">
                <Info className="mt-0.5 size-4 shrink-0 text-blue-400" />
                <p>
                  All submitted flights will be publicly viewable on the Network
                  Overview page. Flights are shared between sessions, allowing
                  controllers to see the arrivals and traffic of other open
                  sessions.
                </p>
              </div>
            )}
          </div>

          <Button
            id="create-session-btn"
            type="submit"
            size="lg"
            className="h-11 w-full rounded-xl"
            disabled={
              isCreating ||
              sessionLimitReached ||
              !selectedAirport ||
              !selectedRunway
            }
          >
            {isCreating && <Loader2 className="animate-spin" />}
            {isCreating
              ? 'Creating session…'
              : sessionLimitReached
                ? 'Session limit reached'
                : 'Create session'}
          </Button>
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
