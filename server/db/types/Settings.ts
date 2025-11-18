export interface BackgroundImageSettings {
  selectedImage: string | null;
  useCustomBackground: boolean;
  favorites: string[];
}

export interface SoundSettings {
  enabled: boolean;
  volume: number; // 10 to 200%
}

export interface LayoutSettings {
  showCombinedView: boolean;
  flightRowOpacity: number; // 0 to 100%
  chartDrawerViewMode: 'list' | 'legacy';
}

export interface DepartureTableColumnSettings {
  time: true; // always true, cannot be disabled
  callsign: boolean;
  stand: boolean;
  aircraft: boolean;
  wakeTurbulence: boolean;
  flightType: boolean;
  arrival: boolean;
  runway: boolean;
  sid: boolean;
  rfl: boolean;
  cfl: boolean;
  squawk: boolean;
  clearance: boolean;
  status: boolean;
  remark: boolean;
  route?: boolean;
  pdc: boolean;
  hide: boolean;
  delete: boolean;
}

export interface ArrivalsTableColumnSettings {
  time: true; // always true, cannot be disabled
  callsign: boolean;
  gate: boolean;
  aircraft: boolean;
  wakeTurbulence: boolean;
  flightType: boolean;
  departure: boolean;
  runway: boolean;
  star: boolean;
  rfl: boolean;
  cfl: boolean;
  squawk: boolean;
  status: boolean;
  remark: boolean;
  route?: boolean;
  hide: boolean;
}

export interface AcarsSettings {
  notesEnabled: boolean;
  chartsEnabled: boolean;
  terminalWidth: number;
  notesWidth: number;
}

export interface HolidayThemeSettings {
  enabled: boolean;
  snowEffect: boolean;
  music: boolean;
  musicVolume: number; // 0 to 100
  animations: boolean;
  santa: boolean;
  customMusicUrl?: string;
}

export interface Settings {
  backgroundImage: BackgroundImageSettings;
  sounds: {
    startupSound: SoundSettings;
    chatNotificationSound: SoundSettings;
    newStripSound: SoundSettings;
    acarsBeep: SoundSettings;
    acarsChatPop: SoundSettings;
  };
  layout: LayoutSettings;
  departureTableColumns: DepartureTableColumnSettings;
  arrivalsTableColumns: ArrivalsTableColumnSettings;
  acars: AcarsSettings;
  tutorialCompleted: boolean;
  displayStatsOnProfile: boolean;
  displayLinkedAccountsOnProfile: boolean;
  hideFromLeaderboard: boolean;
  displayBackgroundOnProfile: boolean;
  bio: string;
  holidayTheme: HolidayThemeSettings;
  [key: string]: unknown;
}