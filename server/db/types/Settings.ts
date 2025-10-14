export interface Settings {
  Settings: {
  sounds?: {
    startupSound?: { enabled: boolean; volume: number };
    chatNotificationSound?: { enabled: boolean; volume: number };
    newStripSound?: { enabled: boolean; volume: number };
    acarsBeep?: { enabled: boolean; volume: number };
    acarsChatPop?: { enabled: boolean; volume: number };
  };
  backgroundImage?: {
    selectedImage?: string | null;
    useCustomBackground?: boolean;
    favorites?: string[];
  };
  layout?: {
    showCombinedView?: boolean;
    flightRowOpacity?: number;
  };
  departureTableColumns?: Record<string, boolean>;
  arrivalsTableColumns?: Record<string, boolean>;
  acars?: {
    notesEnabled?: boolean;
    chartsEnabled?: boolean;
    terminalWidth?: number;
    notesWidth?: number;
  };
  [key: string]: unknown;
  }
}