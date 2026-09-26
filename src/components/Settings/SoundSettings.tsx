import { Volume2 } from 'lucide-react';
import { useState } from 'react';
import {
  SOUNDS,
  linearToLogVolume,
  playAudioWithGain,
} from '../../utils/playSound';
import type { Settings } from '../../types/settings';
import AudioVisualizerButton from './AudioVisualizerButton';
import SettingsSection from './SettingsSection';
import SettingsGroup from './SettingsGroup';
import SettingsRow from './SettingsRow';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { TooltipProvider } from '@/components/ui/tooltip';

interface SoundSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

const soundConfigs = [
  {
    key: 'startupSound' as const,
    label: 'Session startup',
    description: 'Plays when you join a session.',
    sound: SOUNDS.SESSION_STARTUP,
  },
  {
    key: 'chatNotificationSound' as const,
    label: 'Chat notification',
    description: 'Plays when you receive a chat message.',
    sound: SOUNDS.CHAT_NOTIFICATION,
  },
  {
    key: 'newStripSound' as const,
    label: 'New strip',
    description: 'Plays when a new flight strip appears.',
    sound: SOUNDS.NEW_STRIP,
  },
  {
    key: 'acarsBeep' as const,
    label: 'ACARS alert',
    description: 'Plays for PDC, warnings and contact messages in ACARS.',
    sound: SOUNDS.ACARS_BEEP,
  },
  {
    key: 'acarsChatPop' as const,
    label: 'ACARS chat',
    description: 'Plays for system messages and ATIS in ACARS.',
    sound: SOUNDS.ACARS_CHAT_POP,
  },
];

export default function SoundSettings({
  settings,
  onChange,
}: SoundSettingsProps) {
  const [playingKey, setPlayingKey] = useState<keyof Settings['sounds'] | null>(
    null
  );

  const handleToggle = (soundKey: keyof Settings['sounds']) => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      sounds: {
        ...settings.sounds,
        [soundKey]: {
          ...settings.sounds[soundKey],
          enabled: !settings.sounds[soundKey].enabled,
        },
      },
    };
    onChange(updatedSettings);
  };

  const handleVolumeChange = (
    soundKey: keyof Settings['sounds'],
    volume: number
  ) => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      sounds: {
        ...settings.sounds,
        [soundKey]: {
          ...settings.sounds[soundKey],
          volume,
        },
      },
    };
    onChange(updatedSettings);
  };

  const handlePlayTest = (soundKey: keyof Settings['sounds']) => {
    const soundSetting = settings?.sounds[soundKey];
    const config = soundConfigs.find((c) => c.key === soundKey);
    if (!soundSetting?.enabled || !config?.sound) return;

    try {
      setPlayingKey(soundKey);
      const audio = new Audio(config.sound);
      const logVolume = linearToLogVolume(soundSetting.volume);

      const onCanPlay = () => {
        audio.removeEventListener('canplaythrough', onCanPlay);
        audio.removeEventListener('error', onError);

        playAudioWithGain(audio, logVolume);
      };

      const onError = (error: Event) => {
        audio.removeEventListener('canplaythrough', onCanPlay);
        audio.removeEventListener('error', onError);
        console.warn('Failed to play test sound:', error);
        setPlayingKey(null);
      };

      audio.addEventListener('canplaythrough', onCanPlay);
      audio.addEventListener('error', onError);
      audio.onended = () => setPlayingKey(null);
      audio.load();
    } catch (error) {
      console.warn('Failed to play test sound:', error);
      setPlayingKey(null);
    }
  };

  if (!settings) return null;

  return (
    <TooltipProvider delayDuration={0}>
      <SettingsSection title="Sounds" icon={Volume2}>
        <SettingsGroup>
          {soundConfigs.map(({ key, label, description }) => {
            const soundSetting = settings.sounds[key];
            const switchId = `sound-${key}-enabled`;

            return (
              <SettingsRow
                key={key}
                label={label}
                description={description}
                htmlFor={switchId}
              >
                <AudioVisualizerButton
                  isPlaying={playingKey === key}
                  onClick={() => handlePlayTest(key)}
                  label={`Preview ${label}`}
                  disabled={!soundSetting.enabled}
                />
                <Slider
                  min={10}
                  max={200}
                  step={10}
                  value={[soundSetting.volume]}
                  onValueChange={([volume]) => handleVolumeChange(key, volume)}
                  disabled={!soundSetting.enabled}
                  aria-label={`${label} volume`}
                  className="flex-1 sm:w-36 sm:flex-none"
                />
                <span className="w-11 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                  {soundSetting.volume}%
                </span>
                <Switch
                  id={switchId}
                  checked={soundSetting.enabled}
                  onCheckedChange={() => handleToggle(key)}
                />
              </SettingsRow>
            );
          })}
        </SettingsGroup>
      </SettingsSection>
    </TooltipProvider>
  );
}
