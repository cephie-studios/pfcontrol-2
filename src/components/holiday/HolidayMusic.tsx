import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from 'react-responsive';
import MusicPlayerControl from './MusicPlayerControl';

interface HolidayMusicProps {
  enabled: boolean;
  volume: number;
}

const TRACK_FILES = [
  'Bobby Helms - Jingle Bell Rock.mp3',
  'Michael Buble - Ave Maria.mp3',
  "Idina Menzel & Michael Buble - Baby It's Cold Outside.mp3",
  'Michael Buble - Blue Christmas.mp3',
  'Michael Buble - Christmas (Baby Please Come Home).mp3',
  'Andy Williams - Happy Holiday.mp3',
  'Michael Buble - Cold December Night.mp3',
  'Michael Buble - Frosty The Snowman.mp3',
  'Mariah Carey - All I Want For Christmas Is You.mp3',
  'Michael Buble - Have Yourself A Merry Little Christmas.mp3',
  'Michael Buble - Holly Jolly Christmas.mp3',
  'Gene Autry - Up On The House Top (Ho Ho Ho).mp3',
  'Michael Buble - Ill Be Home For Christmas.mp3',
  'Michael Buble - Its Beginning To Look A Lot Like Christmas.mp3',
  'Wham! - Last Christmas.mp3',
  'Michael Buble - Jingle Bells.mp3',
  'Brad Paisley - Santa Looked a Lot Like Daddy.mp3',
  'Michael Buble - Mis Deseos Feliz Navidad.mp3',
  'Michael Buble - Santa Baby.mp3',
  'Donny Hathaway - This Christmas.mp3',
  'Michael Buble - Santa Claus Is Coming To Town.mp3',
  'Michael Buble - Silent Night.mp3',
  'Michael Buble - Silver Bells.mp3',
  'Dean Martin - Let It Snow! Let It Snow! Let It Snow!.mp3',
  'Michael Buble - The Christmas Song.mp3',
  'Michael Buble - White Christmas.mp3',
  'Brenda Lee - Rockin\' Around The Christmas Tree.mp3',
  'Michael Buble - Winter Wonderland.mp3',
];

const STORAGE_KEY_TRACK = 'holiday-music-track';
const STORAGE_KEY_TAB_ID = 'holiday-music-tab-id';
const STORAGE_KEY_PLAYING = 'holiday-music-playing';
const STORAGE_KEY_TIMESTAMP = 'holiday-music-timestamp';
const STORAGE_KEY_LAST_UPDATE = 'holiday-music-last-update';

const TAB_ID = `tab-${Date.now()}-${Math.random()}`;

export default function HolidayMusic({ enabled, volume }: HolidayMusicProps) {
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isInitialMount = useRef(true);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    if (!enabled) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
      setIsReady(false);
      return;
    }

    if (audioRef.current) return;

    try {
      localStorage.setItem(STORAGE_KEY_TAB_ID, TAB_ID);
    } catch {
      // ignore
    }

    const getStartTrack = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_TRACK);
        if (stored) {
          const track = parseInt(stored, 10);
          if (!isNaN(track) && track >= 0 && track < TRACK_FILES.length) {
            return track;
          }
        }
      } catch {
        // ignore
      }
      return Math.floor(Math.random() * TRACK_FILES.length);
    };

    const startTrack = getStartTrack();
    setCurrentTrack(startTrack);

    const audio = new Audio(
      `/assets/app/holiday/chunks/${TRACK_FILES[startTrack]}`
    );
    audio.volume = volume / 100;
    audioRef.current = audio;

    const handleCanPlay = () => {
      setIsReady(true);

      try {
        const storedTimestamp = localStorage.getItem(STORAGE_KEY_TIMESTAMP);
        if (storedTimestamp) {
          const timestamp = parseFloat(storedTimestamp);
          if (!isNaN(timestamp) && timestamp > 0) {
            audio.currentTime = timestamp;
          }
        }
      } catch {
        // ignore
      }

      audio
        .play()
        .then(() => {
          setHasInteracted(true);
        })
        .catch(() => {
          console.log('Autoplay blocked - waiting for user interaction');
        });
    };

    const handlePlay = () => {
      setIsPlaying(true);
      try {
        localStorage.setItem(STORAGE_KEY_PLAYING, 'true');
        localStorage.setItem(STORAGE_KEY_LAST_UPDATE, Date.now().toString());
      } catch {
        // ignore
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
      try {
        localStorage.setItem(STORAGE_KEY_PLAYING, 'false');
        localStorage.setItem(
          STORAGE_KEY_TIMESTAMP,
          audio.currentTime.toString()
        );
        localStorage.setItem(STORAGE_KEY_LAST_UPDATE, Date.now().toString());
      } catch {
        // ignore
      }
    };

    const handleTimeUpdate = () => {
      try {
        localStorage.setItem(
          STORAGE_KEY_TIMESTAMP,
          audio.currentTime.toString()
        );
      } catch {
        // ignore
      }
    };

    const handleEnded = () => {
      setCurrentTrack((prev) => {
        const nextTrack = (prev + 1) % TRACK_FILES.length;
        try {
          localStorage.setItem(STORAGE_KEY_TRACK, nextTrack.toString());
        } catch {
          // ignore
        }
        return nextTrack;
      });
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_TAB_ID && e.newValue && e.newValue !== TAB_ID) {
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
        return;
      }

      const activeTabId = localStorage.getItem(STORAGE_KEY_TAB_ID);
      if (activeTabId !== TAB_ID) {
        return;
      }

      if (e.key === STORAGE_KEY_TRACK && e.newValue) {
        const newTrack = parseInt(e.newValue, 10);
        if (!isNaN(newTrack)) {
          setCurrentTrack(newTrack);
        }
      }
    };

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      audio.pause();
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      window.removeEventListener('storage', handleStorageChange);
      audioRef.current = null;
      setIsPlaying(false);
      setIsReady(false);
    };
  }, [enabled]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !enabled) return;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const wasPlaying = isPlaying;

    audio.src = `/assets/app/holiday/chunks/${TRACK_FILES[currentTrack]}`;
    audio.load();

    try {
      localStorage.setItem(STORAGE_KEY_TIMESTAMP, '0');
    } catch {
      // ignore
    }

    if (wasPlaying && hasInteracted) {
      const handleLoadedData = () => {
        audio.play().catch((e) => console.error('Error playing track:', e));
        audio.removeEventListener('loadeddata', handleLoadedData);
      };
      audio.addEventListener('loadeddata', handleLoadedData);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  useEffect(() => {
    if (!hasInteracted && enabled) {
      const handleFirstClick = () => {
        setHasInteracted(true);
        if (audioRef.current && isReady) {
          audioRef.current
            .play()
            .catch((e) => console.error('Error playing audio:', e));
        }
      };

      document.addEventListener('click', handleFirstClick, { once: true });
      return () => document.removeEventListener('click', handleFirstClick);
    }
  }, [hasInteracted, enabled, isReady]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !isReady) return;

    if (!hasInteracted) {
      setHasInteracted(true);
    }

    try {
      localStorage.setItem(STORAGE_KEY_TAB_ID, TAB_ID);
    } catch {
      // ignore
    }

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((e) => console.error('Error playing audio:', e));
    }
  };

  const handleSkip = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
    }

    try {
      localStorage.setItem(STORAGE_KEY_TAB_ID, TAB_ID);
    } catch {
      // ignore
    }

    setCurrentTrack((prev) => {
      const nextTrack = (prev + 1) % TRACK_FILES.length;
      try {
        localStorage.setItem(STORAGE_KEY_TRACK, nextTrack.toString());
      } catch {
        // ignore
      }
      return nextTrack;
    });
  };

  if (!enabled) return null;

  // On mobile, keep the audio playing but don't render the control UI
  if (isMobile) return null;

  return (
    <MusicPlayerControl
      isPlaying={isPlaying}
      onPlayPause={handlePlayPause}
      onSkip={handleSkip}
      currentTrack={TRACK_FILES[currentTrack]}
      enabled={isReady}
    />
  );
}
