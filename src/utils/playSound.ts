import type { Settings } from '../types/settings';

export function linearToLogVolume(linearVolume: number): number {
  const clamped = Math.max(0, Math.min(200, linearVolume));

  if (clamped <= 100) {
    // 0-100%: Use squared curve for natural feel
    // 50% slider → 25% actual volume
    const normalized = clamped / 100;
    return Math.pow(normalized, 2);
  } else {
    // 100-200%: Linear above 100% (1.0 to 2.0)
    return 1.0 + (clamped - 100) / 100;
  }
}

export function playAudioWithGain(
  audioElement: HTMLAudioElement,
  volume: number
): void {
  // For volumes <= 1.0, just use the audio element directly
  if (volume <= 1.0) {
    audioElement.volume = volume;
    audioElement.play().catch(() => {});
    return;
  }

  const audioContext = new (window.AudioContext ||
    (
      window as Window &
        typeof globalThis & { webkitAudioContext?: typeof AudioContext }
    ).webkitAudioContext!)();
  const source = audioContext.createMediaElementSource(audioElement);
  const gainNode = audioContext.createGain();

  gainNode.gain.value = volume;
  source.connect(gainNode);
  gainNode.connect(audioContext.destination);

  audioElement.volume = 1.0; // Set to max, gain will amplify
  audioElement.play().catch(() => {});
}

export function playSound(
  filepath: string,
  volume: number = 0.7
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const audio = new Audio(filepath);
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.preload = 'auto';

      const onCanPlay = () => {
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);
        resolve();
      };

      const onError = (error: Event) => {
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);
        console.warn('Could not play sound:', filepath, error);
        reject(error);
      };

      audio.addEventListener('canplay', onCanPlay);
      audio.addEventListener('error', onError);

      audio.play().catch(onError);
    } catch (error) {
      console.warn('Could not create audio element for:', filepath, error);
      reject(error);
    }
  });
}

export function playSoundWithSettings(
  soundType: 'startupSound' | 'chatNotificationSound' | 'newStripSound',
  userSettings: Settings,
  fallbackVolume: number = 0.7
): Promise<void> {
  const soundSettings = userSettings?.sounds?.[soundType];

  if (!soundSettings?.enabled) {
    return Promise.resolve();
  }

  // Convert from percentage (10-200%) to logarithmic scale
  const logVolume = linearToLogVolume(soundSettings.volume || 100);

  const adjustedVolume = logVolume * fallbackVolume;

  const soundMap = {
    startupSound: SOUNDS.SESSION_STARTUP,
    chatNotificationSound: SOUNDS.CHAT_NOTIFICATION,
    newStripSound: SOUNDS.NEW_STRIP,
  };

  return new Promise((resolve, reject) => {
    try {
      const audio = new Audio(soundMap[soundType]);
      audio.preload = 'auto';

      const onCanPlay = () => {
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);

        // Use playAudioWithGain to support volumes above 100%
        playAudioWithGain(audio, adjustedVolume);
        resolve();
      };

      const onError = (error: Event) => {
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);
        console.warn('Could not play sound:', soundMap[soundType], error);
        reject(error);
      };

      audio.addEventListener('canplay', onCanPlay);
      audio.addEventListener('error', onError);

      // Preload the audio
      audio.load();
    } catch (error) {
      console.warn(
        'Could not create audio element for:',
        soundMap[soundType],
        error
      );
      reject(error);
    }
  });
}

export function preloadSound(filepath: string): HTMLAudioElement {
  const audio = new Audio(filepath);
  audio.preload = 'auto';
  return audio;
}

export function playSounds(
  sounds: Array<{ filepath: string; volume?: number }>
): Promise<void[]> {
  return Promise.all(
    sounds.map((sound) => playSound(sound.filepath, sound.volume))
  );
}

export const SOUNDS = {
  CHAT_NOTIFICATION: '/assets/app/sounds/chatNotification.wav',
  SESSION_STARTUP: '/assets/app/sounds/startup.mp3',
  NEW_STRIP: '/assets/app/sounds/newStrip.mp3',
  ACARS_BEEP: '/assets/app/sounds/ACARSBeep.wav',
  ACARS_CHAT_POP: '/assets/app/sounds/ACARSChatPop.mp3',
} as const;
