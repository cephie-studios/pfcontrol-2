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
    hide: boolean;
}

export interface AcarsSettings {
    notesEnabled: boolean;
    sidebarWidth: number;
    terminalWidth: number;
    notesWidth: number;
    chartDrawerViewMode: 'list' | 'legacy';
    autoRedirectToAcars: boolean;
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
    notificationViewMode: 'legacy' | 'list';
    tutorialCompleted: boolean;
    displayStatsOnProfile: boolean;
    displayLinkedAccountsOnProfile: boolean;
    hideFromLeaderboard: boolean;
}