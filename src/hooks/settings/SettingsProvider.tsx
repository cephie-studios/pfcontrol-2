import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  fetchUserSettings,
  updateUserSettings,
} from '../../utils/fetch/settings';
import type { Settings } from '../../types/settings';
import { SettingsContext } from './useSettings';

const defaultSettings: Settings = {
  backgroundImage: {
    selectedImage: null,
    useCustomBackground: false,
    favorites: [],
  },
  sounds: {
    startupSound: { enabled: true, volume: 100 },
    chatNotificationSound: { enabled: true, volume: 100 },
    newStripSound: { enabled: true, volume: 100 },
    acarsBeep: { enabled: true, volume: 100 },
    acarsChatPop: { enabled: true, volume: 100 },
  },
  layout: {
    showCombinedView: false,
    flightRowOpacity: 100,
    chartDrawerViewMode: 'legacy',
  },
  departureTableColumns: {
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
  },
  arrivalsTableColumns: {
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
  },
  acars: {
    notesEnabled: true,
    sidebarWidth: 15,
    terminalWidth: 70,
    notesWidth: 15,
    autoRedirectToAcars: true,
  },
  notificationViewMode: 'list',
  tutorialCompleted: false,
  displayStatsOnProfile: true,
  displayLinkedAccountsOnProfile: true,
  hideFromLeaderboard: false,
  holidayTheme: {
    enabled: false,
    snowEffect: true,
    music: false,
    musicVolume: 50,
    animations: true,
    santa: true,
    customMusicUrl: undefined,
  },
  displayBackgroundOnProfile: true,
  bio: '',
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userSettings = await fetchUserSettings();

      const mergedSettings: Settings = {
        ...defaultSettings,
        ...userSettings,
        backgroundImage: {
          ...defaultSettings.backgroundImage,
          ...userSettings.backgroundImage,
        },
        sounds: {
          ...defaultSettings.sounds,
          ...userSettings.sounds,
        },
        layout: {
          ...defaultSettings.layout,
          ...userSettings.layout,
        },
        departureTableColumns: {
          ...defaultSettings.departureTableColumns,
          ...userSettings.departureTableColumns,
        },
        arrivalsTableColumns: {
          ...defaultSettings.arrivalsTableColumns,
          ...userSettings.arrivalsTableColumns,
        },
        acars: {
          ...defaultSettings.acars,
          ...userSettings.acars,
        },
        holidayTheme: {
          ...defaultSettings.holidayTheme,
          ...userSettings.holidayTheme,
        },
      };

      setSettings(mergedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Settings) => {
    try {
      await updateUserSettings(newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}
