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
    const charts: { name: string; path: string; type: string; credits?: string }[] = [];
    const baseUrl = '/assets/app/charts';

    const availableCharts: Record<string, { file: string; name: string; type: string; credits?: string }[]> = {
        EFKT: [
            { file: 'EFKT_GND_1.png', name: 'Airport Diagram', type: 'Ground', credits: '© PFATC' },
            { file: 'EFKT_DEP_1.png', name: 'Departure', type: 'Departure', credits: '© PFATC' },
            { file: 'EFKT_ARR_1.png', name: 'Arrival', type: 'Arrival', credits: '© PFATC' },
        ],
        EGHI: [
            { file: 'EGHI_GND.png', name: 'Airport Diagram', type: 'Ground', credits: '© BABAHAXSON, PFATC' },
        ],
        EGKK: [
            { file: 'EGKK_GND_1.png', name: 'Airport Diagram', type: 'Ground', credits: '© PFATC' },
            { file: 'EGKK_GND_2.jpg', name: 'Ground Movement', type: 'Ground', credits: '© PFATC' },
            { file: 'EGKK_DEP_1.jpg', name: 'SID Chart 1', type: 'Departure', credits: '© PFATC' },
            { file: 'EGKK_DEP_2.jpg', name: 'SID Chart 2', type: 'Departure', credits: '© PFATC' },
            { file: 'EGKK_DEP_3.jpg', name: 'SID Chart 3', type: 'Departure', credits: '© PFATC' },
            { file: 'EGKK_ARR_1.jpg', name: 'STAR Chart 1', type: 'Arrival', credits: '© PFATC' },
            { file: 'EGKK_ARR_2.jpg', name: 'STAR Chart 2', type: 'Arrival', credits: '© PFATC' },
        ],
        GCLP: [
            { file: 'GCLP_GND_1.jpg', name: 'Airport Diagram', type: 'Ground', credits: '© BABAXSON, PFATC' },
            { file: 'GCLP_DEP_1.jpg', name: 'SID Chart 1', type: 'Departure', credits: '© PFATC' },
            { file: 'GCLP_DEP_2.jpg', name: 'SID Chart 2', type: 'Departure', credits: '© PFATC' },
            { file: 'GCLP_DEP_3.jpg', name: 'SID Chart 3', type: 'Departure', credits: '© PFATC' },
            { file: 'GCLP_ARR_1.jpg', name: 'STAR Chart 1', type: 'Arrival', credits: '© PFATC' },
            { file: 'GCLP_ARR_2.jpg', name: 'STAR Chart 2', type: 'Arrival', credits: '© PFATC' },
            { file: 'GCLP_ARR_3.jpg', name: 'STAR Chart 3', type: 'Arrival', credits: '© PFATC' },
        ],
        LCLK: [
            { file: 'LCLK_GND_1.png', name: 'Airport Diagram', type: 'Ground', credits: '© .hykka, PFATC' },
            { file: 'LCLK_GND_2.png', name: 'Ground Movement Passenger', type: 'Ground', credits: '© .hykka, PFATC' },
            { file: 'LCLK_GND_3.png', name: 'Ground Movement Cargo', type: 'Ground', credits: '© .hykka, PFATC' },
            { file: 'LCLK_DEP_1.png', name: 'SID Chart 1', type: 'Departure', credits: '© .hykka, PFATC' },
            { file: 'LCLK_DEP_2.png', name: 'SID Chart 2', type: 'Departure', credits: '© .hykka, PFATC' },
            { file: 'LCLK_ARR_1.png', name: 'STAR Chart', type: 'Arrival', credits: '© .hykka, PFATC' },
        ],
        LCPH: [
            { file: 'LCPH_GND_3.png', name: 'Airport Diagram', type: 'Ground', credits: '© vowray, PFATC' },
            { file: 'LCPH_GND_1.png', name: 'Ground Movement', type: 'Ground', credits: '© vowray, PFATC' },
            { file: 'LCPH_GND_2.png', name: 'Ground Movement Pad', type: 'Ground', credits: '© vowray, PFATC' },
        ],
        LCRA: [
            { file: 'LCRA_GND_1.png', name: 'Airport Diagram', type: 'Ground', credits: '© vowray, PFATC' },
        ],
        LEMH: [
            { file: 'LEMH_GND_1.png', name: 'Airport Diagram', type: 'Ground', credits: '© BABAHAXSON, PFATC' },
            { file: 'LEMH_DEP_1.png', name: 'Departure', type: 'Departure', credits: '© PFATC' },
            { file: 'LEMH_ARR_1.png', name: 'Arrival', type: 'Arrival', credits: '© PFATC' },
        ],
        MDAB: [
            { file: 'MDAB_GND.png', name: 'Airport Diagram', type: 'Ground', credits: '© BABAHAXSON PFATC' },
        ],
        MDCR: [
            { file: 'MDCR_GND.png', name: 'Airport Diagram', type: 'Ground', credits: '© PFATC' },
        ],
        MDPC: [
            { file: 'MDPC_GND_1.jpg', name: 'Airport Diagram', type: 'Ground', credits: '© CPTMILK, PFATC' },
            { file: 'MDPC_GND_2.jpg', name: 'Ground Movement', type: 'Ground', credits: '© PFATC' },
            { file: 'MDPC_DEP_1.png', name: 'SID Chart 1', type: 'Departure', credits: '© .hykka, PFATC' },
            { file: 'MDPC_DEP_2.png', name: 'SID Chart 2', type: 'Departure', credits: '© .hykka, PFATC' },
            { file: 'MDPC_ARR_1.png', name: 'STAR Chart 1', type: 'Arrival', credits: '© .hykka, PFATC' },
            { file: 'MDPC_ARR_2.png', name: 'STAR Chart 2', type: 'Arrival', credits: '© .hykka, PFATC' },
            { file: 'MDPC_ARR_3.png', name: 'STAR Chart 3', type: 'Arrival', credits: '© .hykka, PFATC' },
        ],
        MDST: [
            { file: 'MDST_GND.png', name: 'Airport Diagram', type: 'Ground', credits: '© PFATC' },
        ],
        MTCA: [
            { file: 'MTCA_GND.png', name: 'Airport Diagram', type: 'Ground', credits: '© PFATC' },
        ],
    };

    const airportCharts = availableCharts[icao.toUpperCase()];
    if (airportCharts) {
        airportCharts.forEach(({ file, name, type, credits }) => {
            const path = `${baseUrl}/${icao.toUpperCase()}/${file}`;
            charts.push({ name, path, type, credits });
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