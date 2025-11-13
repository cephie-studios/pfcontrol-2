import { useEffect, useState, useRef, useContext } from 'react';
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
import Joyride, { type CallBackProps, STATUS } from 'react-joyride';
import BackgroundImageSettings from '../components/Settings/BackgroundImageSettings';
import SoundSettings from '../components/Settings/SoundSettings';
import LayoutSettings from '../components/Settings/LayoutSettings';
import TableColumnSettings from '../components/Settings/TableColumnSettings';
import AccountSettings from '../components/Settings/AccountSettings';
import AcarsSettings from '../components/Settings/AcarsSettings';
import NotificationSettings from '../components/Settings/NotificationSettings';
import HolidayThemeSettings from '../components/Settings/HolidayThemeSettings';
import Navbar from '../components/Navbar';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';
import CustomTooltip from '../components/tutorial/CustomTooltip';
import Modal from '../components/common/Modal';
import { useAuth } from '../hooks/auth/useAuth';
import { fetchGlobalHolidayStatus } from '../utils/fetch/data';

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

  const [searchParams] = useSearchParams();
  const startTutorial = searchParams.get('tutorial') === 'true';
  const navigate = useNavigate();
  const [globalHolidayEnabled, setGlobalHolidayEnabled] = useState(true);
  const [loadingGlobalHoliday, setLoadingGlobalHoliday] = useState(true);

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

  useEffect(() => {
    const loadGlobalHolidayStatus = async () => {
      try {
        const status = await fetchGlobalHolidayStatus();
        setGlobalHolidayEnabled(status.enabled);
      } catch (error) {
        console.error('Error fetching global holiday status:', error);
        // Fail open - show holiday settings if fetch fails
        setGlobalHolidayEnabled(true);
      } finally {
        setLoadingGlobalHoliday(false);
      }
    };

    loadGlobalHolidayStatus();
  }, []);

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
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />

      {/* Header */}
      <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 border-b border-zinc-700/50 relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pt-24 sm:pt-28">
          <div className="flex items-center mb-4">
            <div className="p-2 sm:p-3 bg-blue-500/20 rounded-xl mr-3 sm:mr-4">
              <SettingsIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400" />
            </div>
            <div>
              <h1
                className="text-3xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600 font-extrabold mb-2"
                style={{ lineHeight: 1.4 }}
              >
                Settings
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 relative z-10">
        <div className="space-y-8">
          <div id="holiday-theme-settings">
            <HolidayThemeSettings
              settings={localSettings}
              onChange={handleLocalSettingsChange}
              globalHolidayEnabled={globalHolidayEnabled && !loadingGlobalHoliday}
            />
          </div>

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

          <div id="notification-settings">
            <NotificationSettings
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
