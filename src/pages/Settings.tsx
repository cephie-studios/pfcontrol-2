import {
  useEffect,
  useState,
  useRef,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import {
  UNSAFE_NavigationContext,
  useLocation,
  useSearchParams,
  useNavigate,
} from 'react-router';
import { AlertTriangle, Loader2, RotateCcw, Save } from 'lucide-react';
import type {
  Settings,
  DepartureTableColumnSettings,
  ArrivalsTableColumnSettings,
} from '../types/settings';
import { useSettings } from '../hooks/settings/useSettings';
import { steps } from '../components/tutorial/TutorialStepsSettings';
import { updateTutorialStatus } from '../utils/fetch/auth';
import { useAuth } from '../hooks/auth/useAuth';
import { useToast } from '../hooks/useToast';
import Joyride, {
  type CallBackProps,
  STATUS,
} from 'react-joyride-react19-compat';
import { trackTutorialEvent } from '../utils/tutorialTracking';
import BackgroundImageSettings from '../components/Settings/BackgroundImageSettings';
import SoundSettings from '../components/Settings/SoundSettings';
import LayoutSettings from '../components/Settings/LayoutSettings';
import TableColumnSettings from '../components/Settings/TableColumnSettings';
import AccountSettings from '../components/Settings/AccountSettings';
import AcarsSettings from '../components/Settings/AcarsSettings';
import Navbar from '../components/Navbar';
import CustomTooltip from '../components/tutorial/CustomTooltip';
import { fetchBackgrounds } from '../utils/fetch/data';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
}

type SectionId =
  | 'account-settings'
  | 'table-column-settings'
  | 'layout-settings'
  | 'acars-settings'
  | 'sound-settings'
  | 'background-image-settings';

/** Wraps a section with its anchor id; the ids are tutorial targets. */
function SectionAnchor({
  id,
  children,
}: {
  id: SectionId;
  children: ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24">
      {children}
    </div>
  );
}

function useCustomBlocker(shouldBlock: boolean, onBlock: () => void) {
  const navigator = useContext(UNSAFE_NavigationContext)?.navigator;
  const location = useLocation();

  useEffect(() => {
    if (!shouldBlock || !navigator) return;

    const push = navigator.push;
    const replace = navigator.replace;

    const block = () => {
      onBlock();
    };

    navigator.push = () => {
      block();
    };
    navigator.replace = () => {
      block();
    };

    return () => {
      navigator.push = push;
      navigator.replace = replace;
    };
  }, [shouldBlock, onBlock, navigator, location]);
}

export default function Settings() {
  const { settings, updateSettings, loading } = useSettings();
  const { refreshUser } = useAuth();
  const { showError } = useToast();
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDiscardToast, setShowDiscardToast] = useState(false);
  const [showTutorialCompleteModal, setShowTutorialCompleteModal] =
    useState(false);
  const preventNavigation = useRef(false);
  const [availableImages, setAvailableImages] = useState<AvailableImage[]>([]);
  const [customLoaded, setCustomLoaded] = useState(false);

  const [searchParams] = useSearchParams();
  const startTutorial = searchParams.get('tutorial') === 'true';
  const navigate = useNavigate();

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  useEffect(() => {
    if (settings && localSettings) {
      const hasChanges =
        JSON.stringify(settings) !== JSON.stringify(localSettings);
      setHasChanges(hasChanges);
      preventNavigation.current = hasChanges;
    }
  }, [settings, localSettings]);

  useCustomBlocker(hasChanges, () => setShowDiscardToast(true));

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

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

  const handleLocalSettingsChange = (updatedSettings: Settings) => {
    setLocalSettings(updatedSettings);
  };

  const handleDepartureColumnsChange = (
    columns: DepartureTableColumnSettings
  ) => {
    if (!localSettings) return;
    const newSettings = {
      ...localSettings,
      departureTableColumns: columns,
    };
    setLocalSettings(newSettings);
  };

  const handleArrivalsColumnsChange = (
    columns: ArrivalsTableColumnSettings
  ) => {
    if (!localSettings) return;
    const newSettings = {
      ...localSettings,
      arrivalsTableColumns: columns,
    };
    setLocalSettings(newSettings);
  };

  const handleResetTableColumns = () => {
    if (!localSettings) return;
    const newSettings: Settings = {
      ...localSettings,
      departureTableColumns: {
        time: true as const,
        callsign: true,
        stand: true,
        aircraft: true,
        wakeTurbulence: true,
        flightType: true,
        arrival: true,
        runway: true,
        sid: true,
        rfl: true,
        cfl: true,
        squawk: true,
        clearance: true,
        status: true,
        remark: true,
        pdc: true,
        hide: true,
        delete: true,
        req: true,
      },
      arrivalsTableColumns: {
        time: true as const,
        callsign: true,
        gate: true,
        aircraft: true,
        wakeTurbulence: true,
        flightType: true,
        departure: true,
        runway: true,
        star: true,
        rfl: true,
        cfl: true,
        squawk: true,
        status: true,
        remark: true,
        hide: true,
      },
    };
    setLocalSettings(newSettings);
  };

  const handleSave = async () => {
    if (!localSettings) return;

    try {
      setSaving(true);
      await updateSettings(localSettings);
      setHasChanges(false);
      preventNavigation.current = false;
    } catch (error) {
      console.error('Error updating settings:', error);
      showError(
        error instanceof Error
          ? `Failed to save settings: ${error.message}`
          : 'Failed to save settings'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (settings) {
      setLocalSettings(settings);
      setHasChanges(false);
      preventNavigation.current = false;
      setShowDiscardToast(false);
    }
  };

  const handleForceLeave = () => {
    preventNavigation.current = false;
    setShowDiscardToast(false);
    window.history.back();
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    trackTutorialEvent('settings', data);
    const { status } = data;
    if (status === STATUS.FINISHED) {
      setShowTutorialCompleteModal(true);
      updateTutorialStatus(true);
    } else if (status === STATUS.SKIPPED) {
      updateTutorialStatus(true);
    }
  };

  const handleRestartTutorial = async () => {
    try {
      const success = await updateTutorialStatus(false);
      if (success) {
        await refreshUser();
        navigate('/?tutorial=true');
      } else {
        console.error('Failed to reset tutorial.');
        showError('Failed to reset tutorial.');
      }
    } catch (error) {
      console.error('Error resetting tutorial:', error);
      showError('Failed to reset tutorial.');
    }
  };

  if (loading)
    return (
      <div className="shadcn-scope flex min-h-screen items-center justify-center bg-background text-foreground">
        <Navbar />
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="shadcn-scope min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="relative h-80 w-full overflow-hidden md:h-96">
        <div className="absolute inset-0">
          <img
            src="/assets/images/hero.webp"
            alt=""
            className="h-full w-full scale-110 object-cover"
          />
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-500"
            style={{ backgroundImage, opacity: customLoaded ? 1 : 0 }}
          />
          <div className="absolute inset-0 bg-linear-to-b from-background/40 via-background/70 to-background" />
        </div>
        <div className="relative flex h-full flex-col items-center justify-center gap-4 px-4 sm:px-6 md:px-10">
          <h1 className="text-center text-3xl font-black tracking-tight sm:text-5xl md:text-6xl">
            YOUR SETTINGS
          </h1>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-6 w-full max-w-4xl min-w-0 px-4 pb-32 sm:px-6 md:-mt-8">
        <main className="flex min-w-0 flex-col gap-12">
          <SectionAnchor id="account-settings">
            <AccountSettings
              settings={localSettings}
              onChange={handleLocalSettingsChange}
            />
          </SectionAnchor>

          <SectionAnchor id="table-column-settings">
            <TableColumnSettings
              departureColumns={{
                time: true,
                callsign: true,
                req: true,
                stand: true,
                aircraft: true,
                wakeTurbulence: true,
                flightType: true,
                arrival: true,
                runway: true,
                sid: true,
                rfl: true,
                cfl: true,
                squawk: true,
                clearance: true,
                status: true,
                remark: true,
                pdc: true,
                hide: true,
                delete: true,
                ...localSettings?.departureTableColumns,
              }}
              arrivalsColumns={
                localSettings?.arrivalsTableColumns || {
                  time: true,
                  callsign: true,
                  gate: true,
                  aircraft: true,
                  wakeTurbulence: true,
                  flightType: true,
                  departure: true,
                  runway: true,
                  star: true,
                  rfl: true,
                  cfl: true,
                  squawk: true,
                  status: true,
                  remark: true,
                  hide: true,
                }
              }
              onDepartureColumnsChange={handleDepartureColumnsChange}
              onArrivalsColumnsChange={handleArrivalsColumnsChange}
              onReset={handleResetTableColumns}
            />
          </SectionAnchor>

          <SectionAnchor id="layout-settings">
            <LayoutSettings
              settings={localSettings}
              onChange={handleLocalSettingsChange}
            />
          </SectionAnchor>

          <SectionAnchor id="acars-settings">
            <AcarsSettings
              settings={localSettings}
              onChange={handleLocalSettingsChange}
            />
          </SectionAnchor>

          <SectionAnchor id="sound-settings">
            <SoundSettings
              settings={localSettings}
              onChange={handleLocalSettingsChange}
            />
          </SectionAnchor>

          <SectionAnchor id="background-image-settings">
            <BackgroundImageSettings
              settings={localSettings}
              onChange={handleLocalSettingsChange}
            />
          </SectionAnchor>
        </main>
      </div>

      {/* Unsaved changes / leave warning. z above the app feedback banner
          (z-9999), which sits in the same bottom-centre spot. */}
      {hasChanges || showDiscardToast ? (
        <div className="fixed inset-x-4 bottom-4 z-[10000] flex justify-center sm:bottom-6">
          <div
            role={showDiscardToast ? 'alertdialog' : 'status'}
            aria-live="polite"
            className={cn(
              'flex w-full max-w-xl flex-col gap-3 rounded-2xl border bg-popover/95 p-3 pl-5 shadow-2xl backdrop-blur-md sm:flex-row sm:items-center',
              showDiscardToast && 'border-destructive/50'
            )}
          >
            <p className="flex flex-1 items-center gap-2 text-sm font-medium">
              {showDiscardToast ? (
                <>
                  <AlertTriangle className="size-4 shrink-0 text-destructive" />
                  Leave without saving your changes?
                </>
              ) : (
                'You have unsaved changes'
              )}
            </p>
            <div className="flex gap-2">
              {showDiscardToast ? (
                <>
                  <Button
                    variant="outline"
                    className="flex-1 sm:flex-none"
                    onClick={() => setShowDiscardToast(false)}
                  >
                    Stay
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 sm:flex-none"
                    onClick={handleForceLeave}
                  >
                    Leave anyway
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="flex-1 sm:flex-none"
                    onClick={handleDiscard}
                    disabled={saving}
                  >
                    Discard
                  </Button>
                  <Button
                    className="flex-1 sm:flex-none"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="animate-spin" /> : <Save />}
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <Dialog
        open={showTutorialCompleteModal}
        onOpenChange={setShowTutorialCompleteModal}
      >
        <DialogContent variant="success" className="shadcn-scope sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tutorial completed</DialogTitle>
            <DialogDescription>
              You finished the PFControl tutorial. Enjoy PFControl!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTutorialCompleteModal(false);
                handleRestartTutorial();
              }}
            >
              <RotateCcw />
              Restart tutorial
            </Button>
            <Button onClick={() => setShowTutorialCompleteModal(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Joyride
        steps={steps}
        run={startTutorial}
        callback={handleJoyrideCallback}
        continuous
        showProgress
        showSkipButton
        tooltipComponent={CustomTooltip}
        styles={{
          options: {
            primaryColor: '#3b82f6',
            textColor: '#ffffff',
            backgroundColor: '#1f2937',
            zIndex: 10000,
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
