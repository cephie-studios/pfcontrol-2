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

export interface BundledChart {
  name: string;
  path: string;
  type: string;
  credits?: string;
  procedures?: string[];
  source?: 'cephie';
}

const BUNDLED_CHART_BASE_URL = '/assets/app/charts';

const availableCharts: Record<
  string,
  {
    file: string;
    name: string;
    type: string;
    credits?: string;
    procedures?: string[];
    source?: 'cephie';
  }[]
> = {
  EFKT: [
    {
      file: 'EFKT_GND_1.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© PFATC',
    },
    {
      file: 'EFKT_DEP_1.png',
      name: 'Departure',
      type: 'Departure',
      credits: '© PFATC',
      procedures: [
        'SPECA1A',
        'KEFT2D',
        'ROSE3C',
        'SPECA',
        'KEFT',
        'ROSE',
        'RWY34',
      ],
    },
    {
      file: 'EFKT_ARR_1.png',
      name: 'Arrival',
      type: 'Arrival',
      credits: '© PFATC',
      procedures: [
        'KRDSH1A',
        'KIT2D',
        'KEFLA3C',
        'KRDSH',
        'KIT',
        'KEFLA',
        'RWY34',
      ],
    },
  ],
  EGFF: [
    {
      file: 'EGFF_GND_1.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© .hykka & PFATC',
    },
  ],
  EGHI: [
    {
      file: 'EGHI_GND.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© BABAHAXSON',
    },
  ],
  EGKK: [
    {
      file: 'EGKK_GND_3.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© .hykka & PFATC',
    },
    {
      file: 'EGKK_GND_2.jpg',
      name: 'Ground Movement',
      type: 'Ground',
      credits: '© PFATC',
    },
    {
      file: 'EGKK_DEP_1.png',
      name: 'SID Chart 1',
      type: 'Departure',
      credits: '© .hykka & PFATC',
      procedures: [
        'NOVM1X',
        'BOGN1X',
        'NOVMA1X',
        'BOGNA1X',
        'NOVMA',
        'BOGNA',
        'RWY26L',
      ],
    },
    {
      file: 'EGKK_DEP_2.png',
      name: 'SID Chart 2',
      type: 'Departure',
      credits: '© .hykka & PFATC',
      procedures: [
        'WIZA1X',
        'SFD1X',
        'LAM6M',
        'WIZAD1X',
        'WIZAD',
        'SFD',
        'LAM',
        'RWY26L',
      ],
    },
    {
      file: 'EGKK_DEP_3.png',
      name: 'SID Chart 3',
      type: 'Departure',
      credits: '© .hykka & PFATC',
      procedures: [
        'IMVUR1Z',
        'ODVIK2Z',
        'SFD4Z',
        'LAM1Z',
        'IMVUR',
        'ODVIK',
        'SFD',
        'LAM',
        'RWY08R',
      ],
    },
    {
      file: 'EGKK_ARR_1.jpg',
      name: 'STAR Chart 1',
      type: 'Arrival',
      credits: '© PFATC',
      procedures: ['KUNA1G', 'KUNAV', 'RWY26L', 'RWY08R'],
    },
    {
      file: 'EGKK_ARR_2.jpg',
      name: 'STAR Chart 2',
      type: 'Arrival',
      credits: '© PFATC',
      procedures: ['VASU1G', 'VASUX', 'RWY26L', 'RWY08R'],
    },
  ],
  EGLC: [
    {
      file: 'EGLC_GND_1.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© .hykka & PFATC',
    },
    {
      file: 'EGLC_DEP_1.png',
      name: 'SID Chart 1',
      type: 'Departure',
      credits: '© .hykka & PFATC',
      procedures: ['BPK1H', 'ODUK1H', 'ODUKU1H', 'BPK', 'ODUKU', 'RWY27'],
    },
    {
      file: 'EGLC_DEP_2.png',
      name: 'SID Chart 2',
      type: 'Departure',
      credits: '© .hykka & PFATC',
      procedures: ['BPK1A', 'ODUK1A', 'ODUKU1A', 'BPK', 'ODUKU', 'RWY27'],
    },
  ],
  GCLP: [
    {
      file: 'GCLP_GND_1.jpg',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© BABAXSON',
    },
    {
      file: 'GCLP_DEP_1.jpg',
      name: 'SID Chart 1',
      type: 'Departure',
      credits: '© PFATC',
      procedures: [
        'KOPU1B',
        'KOPU1A',
        'KOPUD',
        'RWY03L',
        'RWY03R',
        'RWY21L',
        'RWY21R',
      ],
    },
    {
      file: 'GCLP_DEP_2.jpg',
      name: 'SID Chart 2',
      type: 'Departure',
      credits: '© PFATC',
      procedures: [
        'COST4A',
        'COST4B',
        'COSTI',
        'RWY03L',
        'RWY03R',
        'RWY21L',
        'RWY21R',
      ],
    },
    {
      file: 'GCLP_DEP_3.jpg',
      name: 'SID Chart 3',
      type: 'Departure',
      credits: '© PFATC',
      procedures: [
        'OEDG2A',
        'OEDG2B',
        'ODEGI',
        'RWY03L',
        'RWY03R',
        'RWY21L',
        'RWY21R',
      ],
    },
    {
      file: 'GCLP_ARR_1.jpg',
      name: 'STAR Chart 1',
      type: 'Arrival',
      credits: '© PFATC',
      procedures: [
        'LORP1C',
        'LORP1Z',
        'LORPO',
        'RWY03L',
        'RWY03R',
        'RWY21L',
        'RWY21R',
      ],
    },
    {
      file: 'GCLP_ARR_2.jpg',
      name: 'STAR Chart 2',
      type: 'Arrival',
      credits: '© PFATC',
      procedures: [
        'ORTI5C',
        'KONBA4B',
        'ORTIS',
        'KONBA',
        'RWY03L',
        'RWY03R',
        'RWY21L',
        'RWY21R',
      ],
    },
    {
      file: 'GCLP_ARR_3.jpg',
      name: 'STAR Chart 3',
      type: 'Arrival',
      credits: '© PFATC',
      procedures: ['COST1C', 'COSTI', 'RWY03L', 'RWY03R', 'RWY21L', 'RWY21R'],
    },
  ],
  LCLK: [
    {
      file: 'LCLK_GND_1.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© .hykka',
    },
    {
      file: 'LCLK_GND_2.png',
      name: 'Ground Movement Passenger',
      type: 'Ground',
      credits: '© .hykka',
    },
    {
      file: 'LCLK_GND_3.png',
      name: 'Ground Movement Cargo',
      type: 'Ground',
      credits: '© .hykka',
    },
    {
      file: 'LCLK_DEP_1.png',
      name: 'SID Chart 1',
      type: 'Departure',
      credits: '© .hykka',
      procedures: [
        'LUBE1W',
        'KURS1W',
        'RUDE1D',
        'EMED1D',
        'LUBES1W',
        'KURSA1W',
        'RUDER1D',
        'EMEDA1D',
        'LUBES',
        'KURSA',
        'RUDER',
        'EMEDA',
        'RWY22',
      ],
    },
    {
      file: 'LCLK_DEP_2.png',
      name: 'SID Chart 2',
      type: 'Departure',
      credits: '© .hykka & PFATC',
      procedures: [
        'RUDE1W',
        'EMED1W',
        'RUDER1W',
        'EMEDA1W',
        'RUDER',
        'EMEDA',
        'RWY04',
      ],
    },
    {
      file: 'LCLK_DEP_3.png',
      name: 'SID Chart 3',
      type: 'Departure',
      credits: '© .hykka & PFATC',
      procedures: [
        'BONE2W',
        'NORD1W',
        'BONEK2W',
        'NORDI1W',
        'BONEK',
        'NORDI',
        'RWY04',
      ],
    },
    {
      file: 'LCLK_DEP_4.png',
      name: 'SID Chart 4',
      type: 'Departure',
      credits: '© .hykka & PFATC',
      procedures: [
        'RUDE1D',
        'EMED1D',
        'RUDER1D',
        'EMEDA1D',
        'RUDER',
        'EMEDA',
        'RWY22',
      ],
    },
    {
      file: 'LCLK_DEP_5.png',
      name: 'SID Chart 5',
      type: 'Departure',
      credits: '© .hykka & PFATC',
      procedures: [
        'EMIL2C',
        'RUDE2C',
        'EMILI2C',
        'RUDER2C',
        'EMILI',
        'RUDER',
        'RWY04',
      ],
    },
    {
      file: 'LCLK_ARR_1.png',
      name: 'STAR Chart 1',
      type: 'Arrival',
      credits: '© .hykka',
      procedures: ['LUBE1R', 'KURSA1R', 'LUBES', 'KURSA', 'RWY04'],
    },
    {
      file: 'LCLK_ARR_2.png',
      name: 'STAR Chart 2',
      type: 'Arrival',
      credits: '© .hykka',
      procedures: [
        'BONE1R',
        'NIMS1R',
        'KRAS1V',
        'BONEK',
        'NIMSI',
        'KRASI',
        'RWY22',
      ],
    },
  ],
  LCPH: [
    {
      file: 'LCPH_GND_3.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© vowray',
    },
    {
      file: 'LCPH_GND_1.png',
      name: 'Ground Movement',
      type: 'Ground',
      credits: '© vowray',
    },
    {
      file: 'LCPH_GND_2.png',
      name: 'Ground Movement Pad',
      type: 'Ground',
      credits: '© vowray',
    },
    {
      file: 'LCPH_GND_4.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© .hykka & PFATC',
    },
    {
      file: 'LCPH_GND_5.png',
      name: 'Parking',
      type: 'Ground',
      credits: '© .hykka & PFATC',
    },
  ],
  LCRA: [
    {
      file: 'LCRA_GND_1.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© vowray',
    },
  ],
  LEMH: [
    {
      file: 'LEMH_GND_1.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© BABAHAXSON',
    },
    {
      file: 'LEMH_DEP_1.png',
      name: 'Departure',
      type: 'Departure',
      credits: '© PFATC',
      procedures: ['ISKAL1A', 'AVI4D', 'SARGO2B', 'MEROS3C', 'RWY01'],
    },
    {
      file: 'LEMH_ARR_1.png',
      name: 'Arrival',
      type: 'Arrival',
      credits: '© PFATC',
      procedures: ['RWY01'],
    },
  ],
  LPMA: [
    {
      file: 'LPMA_GND_1.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© .hykka & PFATC',
    },
    {
      file: 'LPMA_GND_2.png',
      name: 'Parking',
      type: 'Ground',
      credits: '© .hykka & PFATC',
    },
  ],
  MDAB: [
    {
      file: 'MDAB_GND.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© BABAHAXSON',
    },
  ],
  MDCR: [
    {
      file: 'MDCR_GND.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© PFATC',
    },
  ],
  MDPC: [
    {
      file: 'MDPC_OVR.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© iceit Cephie Studios',
      source: 'cephie',
    },
    {
      file: 'MDPC_GND_1.jpg',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© CPTMILK',
    },
    {
      file: 'MDPC_GND_2.jpg',
      name: 'Ground Movement',
      type: 'Ground',
      credits: '© PFATC',
    },
    {
      file: 'MDPC_DEP_1.png',
      name: 'SID Chart 1',
      type: 'Departure',
      credits: '© .hykka',
      procedures: [
        'KATOK3T',
        'CHUM3T',
        'PIXA3T',
        'ETBO3T',
        'KATOK',
        'CHUMA',
        'PIXAR',
        'ETBOD',
        'RWY26',
        'RWY27',
      ],
    },
    {
      file: 'MDPC_DEP_2.png',
      name: 'SID Chart 2',
      type: 'Departure',
      credits: '© .hykka',
      procedures: [
        'KATO2T',
        'CHUM2T',
        'PIXA2T',
        'ETBO2T',
        'KATOK',
        'CHUMA',
        'PIXAR',
        'ETBOD',
        'RWY08',
        'RWY09',
      ],
    },
    {
      file: 'MDPC_ARR_1.png',
      name: 'STAR Chart 1',
      type: 'Arrival',
      credits: '© .hykka',
      procedures: [
        'POKE1W',
        'BETI1W',
        'KATO1W',
        'ANTE1W',
        'POKEG',
        'BETIR',
        'KATOK',
        'ANTEX',
        'RWY08',
        'RWY09',
      ],
    },
    {
      file: 'MDPC_ARR_2.png',
      name: 'STAR Chart 2',
      type: 'Arrival',
      credits: '© .hykka',
      procedures: [
        'POKE2C',
        'BETI2C',
        'KATO2C',
        'ANTE2C',
        'POKEG',
        'BETIR',
        'KATOK',
        'ANTEX',
        'RWY27',
      ],
    },
    {
      file: 'MDPC_ARR_3.png',
      name: 'STAR Chart 3',
      type: 'Arrival',
      credits: '© .hykka',
      procedures: [
        'POKE1C',
        'BETI1C',
        'KATO1C',
        'ANTE1C',
        'POKEG',
        'BETIR',
        'KATOK',
        'ANTEX',
        'RWY26',
      ],
    },
  ],
  MDST: [
    {
      file: 'MDST_GND.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© PFATC',
    },
  ],
  MTCA: [
    {
      file: 'MTCA_GND.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© PFATC',
    },
  ],
  PAFA: [
    {
      file: 'PAFA_GND_1.png',
      name: 'Airport Diagram',
      type: 'Information',
      credits: '© .hykka & PFATC',
    },
  ],
};

export const getChartsForAirport = (icao: string): BundledChart[] => {
  const code = icao.toUpperCase();
  return (availableCharts[code] ?? []).map(
    ({ file, name, type, credits, procedures, source }) => ({
      name,
      path: `${BUNDLED_CHART_BASE_URL}/${code}/${file}`,
      type,
      credits,
      procedures,
      source,
    })
  );
};

export const formatTimestamp = (isoTimestamp: string): string => {
  return (
    new Date(isoTimestamp).getUTCHours().toString().padStart(2, '0') +
    ':' +
    new Date(isoTimestamp).getUTCMinutes().toString().padStart(2, '0') +
    'Z'
  );
};

export const playNotificationSound = (
  messageType: AcarsMessage['type'],
  settings: Settings
) => {
  if (!settings?.sounds) return;

  if (
    messageType === 'warning' ||
    messageType === 'pdc' ||
    messageType === 'contact'
  ) {
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
