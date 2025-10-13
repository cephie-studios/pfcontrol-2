import type { Settings } from '../types/settings';
import { linearToLogVolume, playAudioWithGain } from './playSound';

export interface AcarsMessage {
    id: string;
    timestamp: string;
    station: string;
    text: string;
    type: 'system' | 'pdc' | 'atis' | 'contact' | 'warning' | 'Success';
    link?: {
        text: string;
        url: string;
    };
}

export const getChartsForAirport = (icao: string) => {
    const charts: { name: string; path: string; type: string }[] = [];
    const baseUrl = '/assets/app/charts';

    const availableCharts: Record<string, { pattern: string; num: number; name: string; type: string }[]> = {
        EGKK: [
            { pattern: 'GND', num: 1, name: 'Airport Diagram', type: 'Ground' },
            { pattern: 'GND', num: 2, name: 'Ground Movement', type: 'Ground' },
            { pattern: 'DEP', num: 1, name: 'SID Chart 1', type: 'Departure' },
            { pattern: 'DEP', num: 2, name: 'SID Chart 2', type: 'Departure' },
            { pattern: 'DEP', num: 3, name: 'SID Chart 3', type: 'Departure' },
            { pattern: 'ARR', num: 1, name: 'STAR Chart 1', type: 'Arrival' },
            { pattern: 'ARR', num: 2, name: 'STAR Chart 2', type: 'Arrival' },
        ],
        GCLP: [
            { pattern: 'GND', num: 1, name: 'Airport Diagram', type: 'Ground' },
            { pattern: 'DEP', num: 1, name: 'SID Chart 1', type: 'Departure' },
            { pattern: 'DEP', num: 2, name: 'SID Chart 2', type: 'Departure' },
            { pattern: 'DEP', num: 3, name: 'SID Chart 3', type: 'Departure' },
            { pattern: 'ARR', num: 1, name: 'STAR Chart 1', type: 'Arrival' },
            { pattern: 'ARR', num: 2, name: 'STAR Chart 2', type: 'Arrival' },
            { pattern: 'ARR', num: 3, name: 'STAR Chart 3', type: 'Arrival' },
        ],
        LCLK: [
            { pattern: 'GND', num: 1, name: 'Airport Diagram', type: 'Ground' },
            { pattern: 'GND', num: 2, name: 'Ground Movement', type: 'Ground' },
            { pattern: 'DEP', num: 1, name: 'SID Chart 1', type: 'Departure' },
            { pattern: 'DEP', num: 2, name: 'SID Chart 2', type: 'Departure' },
            { pattern: 'ARR', num: 1, name: 'STAR Chart', type: 'Arrival' },
        ],
        MDPC: [
            { pattern: 'GND', num: 1, name: 'Airport Diagram', type: 'Ground' },
            { pattern: 'GND', num: 2, name: 'Ground Movement', type: 'Ground' },
            { pattern: 'DEP', num: 1, name: 'SID Chart', type: 'Departure' },
            { pattern: 'ARR', num: 1, name: 'STAR Chart', type: 'Arrival' },
        ],
    };

    const airportCharts = availableCharts[icao.toUpperCase()];
    if (airportCharts) {
        airportCharts.forEach(({ pattern, num, name, type }) => {
            const path = `${baseUrl}/${icao}/${icao}_${pattern}_${num}.png`;
            charts.push({ name, path, type });
        });
    }

    return charts;
};

export const formatTimestamp = (isoTimestamp: string): string => {
    return (
        new Date(isoTimestamp).getUTCHours().toString().padStart(2, '0') +
        ':' +
        new Date(isoTimestamp).getUTCMinutes().toString().padStart(2, '0') +
        'Z'
    );
};

export const playNotificationSound = (messageType: AcarsMessage['type'], settings: Settings) => {
    if (!settings?.sounds) return;

    if (messageType === 'warning' || messageType === 'pdc' || messageType === 'contact') {
        const beepSettings = settings.sounds.acarsBeep;
        if (beepSettings?.enabled) {
            const audio = new Audio('/assets/app/sounds/ACARSBeep.wav');
            const logVolume = linearToLogVolume(beepSettings.volume || 100);
            const onCanPlay = () => {
                audio.removeEventListener('canplaythrough', onCanPlay);
                audio.removeEventListener('error', onError);
                playAudioWithGain(audio, logVolume);
            };
            const onError = () => {
                audio.removeEventListener('canplaythrough', onCanPlay);
                audio.removeEventListener('error', onError);
            };
            audio.addEventListener('canplaythrough', onCanPlay);
            audio.addEventListener('error', onError);
            audio.load();
        }
    } else if (messageType === 'system' || messageType === 'atis') {
        const chatPopSettings = settings.sounds.acarsChatPop;
        if (chatPopSettings?.enabled) {
            const audio = new Audio('/assets/app/sounds/ACARSChatPop.mp3');
            const logVolume = linearToLogVolume(chatPopSettings.volume || 100);
            const onCanPlay = () => {
                audio.removeEventListener('canplaythrough', onCanPlay);
                audio.removeEventListener('error', onError);
                playAudioWithGain(audio, logVolume);
            };
            const onError = () => {
                audio.removeEventListener('canplaythrough', onCanPlay);
                audio.removeEventListener('error', onError);
            };
            audio.addEventListener('canplaythrough', onCanPlay);
            audio.addEventListener('error', onError);
            audio.load();
        }
    }
};