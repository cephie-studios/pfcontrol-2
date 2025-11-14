import { useEffect, useRef, useState } from 'react';
import MusicPlayerControl from './MusicPlayerControl';

interface HolidayMusicProps {
  enabled: boolean;
  volume: number;
}

// All songs in the chunks folder - all have equal chance of playing
const TRACK_FILES = [
  "Bobby Helms - Jingle Bell Rock.mp3",
  "Mariah Carey - All I Want For Christmas Is You.mp3",
  "Michael Buble - All I Want For Christmas Is You.mp3",
  "Michael Buble - Ave Maria.mp3",
  "Michael Buble - Blue Christmas.mp3",
  "Michael Buble - Christmas (Baby Please Come Home).mp3",
  "Michael Buble - Cold December Night.mp3",
  "Michael Buble - Frosty The Snowman.mp3",
  "Michael Buble - Have Yourself A Merry Little Christmas.mp3",
  "Michael Buble - Holly Jolly Christmas.mp3",
  "Michael Buble - Ill Be Home For Christmas.mp3",
  "Michael Buble - Its Beginning To Look A Lot Like Christmas.mp3",
  "Michael Buble - Jingle Bells.mp3",
  "Michael Buble - Mis Deseos Feliz Navidad.mp3",
  "Michael Buble - Santa Baby.mp3",
  "Michael Buble - Santa Claus Is Coming To Town.mp3",
  "Michael Buble - Silent Night.mp3",
  "Michael Buble - Silver Bells.mp3",
  "Michael Buble - The Christmas Song.mp3",
  "Michael Buble - White Christmas.mp3",
  "Michael Buble - Winter Wonderland.mp3",
];

const STORAGE_KEY_TRACK = 'holiday-music-track';
const STORAGE_KEY_TAB_ID = 'holiday-music-tab-id';
const STORAGE_KEY_PLAYING = 'holiday-music-playing';
const STORAGE_KEY_TIMESTAMP = 'holiday-music-timestamp';
const STORAGE_KEY_LAST_UPDATE = 'holiday-music-last-update';

// Generate unique tab ID for this session
const TAB_ID = `tab-${Date.now()}-${Math.random()}`;

export default function HolidayMusic({ enabled, volume }: HolidayMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isInitialMount = useRef(true);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Initialize audio on mount/enable
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

    // Only run once when enabled - don't recreate audio element
    if (audioRef.current) return;

    // Claim ownership of playback for this tab
    try {
      localStorage.setItem(STORAGE_KEY_TAB_ID, TAB_ID);
    } catch (e) {
      // Ignore
    }

    // Get starting track from storage or random
    const getStartTrack = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_TRACK);
        if (stored) {
          const track = parseInt(stored, 10);
          if (!isNaN(track) && track >= 0 && track < TRACK_FILES.length) {
            return track;
          }
        }
      } catch (e) {
        // Ignore
      }
      return Math.floor(Math.random() * TRACK_FILES.length);
    };

    const startTrack = getStartTrack();
    setCurrentTrack(startTrack);

    // Create audio element
    const audio = new Audio(`/assets/app/holiday/chunks/${TRACK_FILES[startTrack]}`);
    audio.volume = volume / 100;
    audioRef.current = audio;

    const handleCanPlay = () => {
      setIsReady(true);

      // Restore timestamp from storage
      try {
        const storedTimestamp = localStorage.getItem(STORAGE_KEY_TIMESTAMP);
        if (storedTimestamp) {
          const timestamp = parseFloat(storedTimestamp);
          if (!isNaN(timestamp) && timestamp > 0) {
            audio.currentTime = timestamp;
          }
        }
      } catch (e) {
        // Ignore
      }

      // Try to autoplay (will be blocked by browser policy until user interaction)
      audio.play().then(() => {
        setHasInteracted(true);
      }).catch(() => {
        // Browser blocked autoplay, wait for user click
        console.log('Autoplay blocked - waiting for user interaction');
      });
    };

    const handlePlay = () => {
      setIsPlaying(true);
      try {
        localStorage.setItem(STORAGE_KEY_PLAYING, 'true');
        localStorage.setItem(STORAGE_KEY_LAST_UPDATE, Date.now().toString());
      } catch (e) {
        // Ignore
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
      try {
        localStorage.setItem(STORAGE_KEY_PLAYING, 'false');
        localStorage.setItem(STORAGE_KEY_TIMESTAMP, audio.currentTime.toString());
        localStorage.setItem(STORAGE_KEY_LAST_UPDATE, Date.now().toString());
      } catch (e) {
        // Ignore
      }
    };

    // Save timestamp periodically while playing
    const handleTimeUpdate = () => {
      try {
        localStorage.setItem(STORAGE_KEY_TIMESTAMP, audio.currentTime.toString());
      } catch (e) {
        // Ignore
      }
    };

    const handleEnded = () => {
      // Play next track using state updater
      setCurrentTrack(prev => {
        const nextTrack = (prev + 1) % TRACK_FILES.length;
        try {
          localStorage.setItem(STORAGE_KEY_TRACK, nextTrack.toString());
        } catch (e) {
          // Ignore
        }
        return nextTrack;
      });
    };

    // Listen for other tabs syncing state
    const handleStorageChange = (e: StorageEvent) => {
      // If another tab claims ownership, pause this one immediately
      if (e.key === STORAGE_KEY_TAB_ID && e.newValue && e.newValue !== TAB_ID) {
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
        return; // Don't sync anything else if we're not the active tab
      }

      // Only sync state if this tab is the active one
      const activeTabId = localStorage.getItem(STORAGE_KEY_TAB_ID);
      if (activeTabId !== TAB_ID) {
        return; // Not our turn to play
      }

      // Sync track changes from other tabs
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
  }, [enabled]); // Removed volume from dependencies - it's handled in separate useEffect

  // Update track when currentTrack changes (skip initial mount)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !enabled) return;

    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const wasPlaying = isPlaying;

    // Update audio source
    audio.src = `/assets/app/holiday/chunks/${TRACK_FILES[currentTrack]}`;
    audio.load();

    // Reset timestamp for new track
    try {
      localStorage.setItem(STORAGE_KEY_TIMESTAMP, '0');
    } catch (e) {
      // Ignore
    }

    // Auto-play if was playing before
    if (wasPlaying && hasInteracted) {
      const handleLoadedData = () => {
        audio.play().catch(e => console.error("Error playing track:", e));
        audio.removeEventListener('loadeddata', handleLoadedData);
      };
      audio.addEventListener('loadeddata', handleLoadedData);
    }
  }, [currentTrack]);

  // Update volume when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Add click listener to enable autoplay after first interaction
  useEffect(() => {
    if (!hasInteracted && enabled) {
      const handleFirstClick = () => {
        setHasInteracted(true);
        // Try to play audio after user interaction
        if (audioRef.current && isReady) {
          audioRef.current.play().catch(e => console.error("Error playing audio:", e));
        }
      };

      document.addEventListener('click', handleFirstClick, { once: true });
      return () => document.removeEventListener('click', handleFirstClick);
    }
  }, [hasInteracted, enabled, isReady]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !isReady) return;

    // Mark as interacted
    if (!hasInteracted) {
      setHasInteracted(true);
    }

    // Claim playback for this tab
    try {
      localStorage.setItem(STORAGE_KEY_TAB_ID, TAB_ID);
    } catch (e) {
      // Ignore
    }

    if (isPlaying) {
      audio.pause(); // This keeps the current time position
    } else {
      audio.play().catch(e => console.error("Error playing audio:", e));
    }
  };

  const handleSkip = () => {
    // Mark as interacted
    if (!hasInteracted) {
      setHasInteracted(true);
    }

    // Claim playback for this tab
    try {
      localStorage.setItem(STORAGE_KEY_TAB_ID, TAB_ID);
    } catch (e) {
      // Ignore
    }

    setCurrentTrack(prev => {
      const nextTrack = (prev + 1) % TRACK_FILES.length;
      try {
        localStorage.setItem(STORAGE_KEY_TRACK, nextTrack.toString());
      } catch (e) {
        // Ignore
      }
      return nextTrack;
    });
  };

  if (!enabled) return null;

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
