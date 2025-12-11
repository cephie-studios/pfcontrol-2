import { useEffect, useState, useRef, useContext, useMemo } from 'react';
import {
  UNSAFE_NavigationContext,
  useLocation,
  useSearchParams,
  useNavigate,
} from 'react-router-dom';
import {
  Save,
  AlertTriangle,
  Settings as SettingsIcon,
  Check,
  RotateCcw,
} from 'lucide-react';
import type {
  Settings,
  DepartureTableColumnSettings,
  ArrivalsTableColumnSettings,
} from '../types/settings';
import { useSettings } from '../hooks/settings/useSettings';
import { steps } from '../components/tutorial/TutorialStepsSettings';
import { updateTutorialStatus } from '../utils/fetch/auth';
import { useAuth } from '../hooks/auth/useAuth';
import Joyride, {
  type CallBackProps,
  STATUS,
} from 'react-joyride-react19-compat';
import BackgroundImageSettings from '../components/Settings/BackgroundImageSettings';
import SoundSettings from '../components/Settings/SoundSettings';
import LayoutSettings from '../components/Settings/LayoutSettings';
import TableColumnSettings from '../components/Settings/TableColumnSettings';
import AccountSettings from '../components/Settings/AccountSettings';
import AcarsSettings from '../components/Settings/AcarsSettings';
import Navbar from '../components/Navbar';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';
import CustomTooltip from '../components/tutorial/CustomTooltip';
import Modal from '../components/common/Modal';
import { fetchBackgrounds } from '../utils/fetch/data';

const API_BASE_URL = import.meta.env.VITE_SERVER_URL;

interface AvailableImage {
  filename: string;
  path: string;
  extension: string;
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
      }
    } catch (error) {
      console.error('Error resetting tutorial:', error);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <Navbar />
        <Loader />
      </div>
    );

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
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/70 to-gray-950"></div>
        </div>

        <div className="relative h-full flex flex-col items-center justify-center px-6 md:px-10">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight text-center">
            YOUR SETTINGS
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-5xl px-4 pb-8 -mt-6 md:-mt-8 relative z-10">
        <div className="overflow-hidden">
          <div className="p-6 space-y-8">
            <div id="account-settings">
              <AccountSettings
                settings={localSettings}
                onChange={handleLocalSettingsChange}
              />
            </div>

            <div id="table-column-settings">
              <TableColumnSettings
                departureColumns={
                  localSettings?.departureTableColumns || {
                    time: true,
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
                  }
                }
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
            </div>

            <div id="layout-settings">
              <LayoutSettings
                settings={localSettings}
                onChange={handleLocalSettingsChange}
              />
            </div>

            <div id="acars-settings">
              <AcarsSettings
                settings={localSettings}
                onChange={handleLocalSettingsChange}
              />
            </div>

            <div id="sound-settings">
              <SoundSettings
                settings={localSettings}
                onChange={handleLocalSettingsChange}
              />
            </div>

            <div id="background-image-settings">
              <BackgroundImageSettings
                settings={localSettings}
                onChange={handleLocalSettingsChange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save/Discard Bar */}
      {hasChanges && !showDiscardToast && (
        <div className="fixed bottom-4 sm:bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 z-50">
          <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 sm:min-w-[320px]">
            <div className="flex-1">
              <p className="text-white font-medium text-sm">Unsaved changes</p>
              <p className="text-zinc-400 text-xs">
                Don't forget to save your settings
              </p>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <Button
                onClick={handleDiscard}
                variant="outline"
                size="sm"
                disabled={saving}
                className="flex-1 sm:flex-none text-xs border-zinc-600 text-zinc-300 hover:bg-zinc-800"
              >
                Discard
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                size="sm"
                className="flex-1 sm:flex-none text-xs bg-blue-600 hover:bg-blue-700 flex items-center justify-center space-x-2"
              >
                {saving ? (
                  <>
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    <span>Save</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Warning Toast */}
      {showDiscardToast && (
        <div className="fixed bottom-4 sm:bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 z-50">
          <div className="bg-red-900/95 backdrop-blur-md border border-red-600/50 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 sm:min-w-[380px]">
            <div className="flex items-start gap-3 sm:gap-4 flex-1">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">
                  Unsaved changes will be lost
                </p>
                <p className="text-red-300 text-xs">
                  Are you sure you want to leave?
                </p>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <Button
                onClick={() => setShowDiscardToast(false)}
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none text-xs border-zinc-600 text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleForceLeave}
                variant="danger"
                size="sm"
                className="flex-1 sm:flex-none text-xs bg-red-600 hover:bg-red-700 whitespace-nowrap"
              >
                Leave anyway
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Completion Modal */}
      <Modal
        isOpen={showTutorialCompleteModal}
        onClose={() => setShowTutorialCompleteModal(false)}
        title="Tutorial Completed!"
        variant="success"
        footer={
          <div className="flex gap-2">
            {' '}
            <Button
              onClick={() => {
                setShowTutorialCompleteModal(false);
                handleRestartTutorial();
              }}
              variant="outline"
              size="sm"
              className="border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/20 hover:border-yellow-600"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restart Tutorial
            </Button>
            <Button
              onClick={() => setShowTutorialCompleteModal(false)}
              variant="success"
              size="sm"
            >
              Got it!
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-green-500/20 rounded-xl">
            <Check className="h-8 w-8 text-green-400" />
          </div>
          <div>
            <p className="text-gray-300">
              You've successfully completed the tutorial for PFControl. Explore
              your new settings and enjoy using PFControl!
            </p>
          </div>
        </div>
      </Modal>

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
