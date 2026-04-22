import { Volume2, VolumeX, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { SOUNDS, linearToLogVolume, playAudioWithGain } from '../../utils/playSound';
import type { Settings } from '../../types/settings';
import AudioVisualizerButton from './AudioVisualizerButton';
import Button from '../common/Button';
import Toggle from './Toggle';
import { S } from './settingsTokens';

interface SoundSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

const soundConfigs = [
  {
    key: 'startupSound' as const,
    label: 'Session Startup Sound',
    description: 'Plays when you join a session',
    sound: SOUNDS.SESSION_STARTUP,
    color: 'blue',
  },
  {
    key: 'chatNotificationSound' as const,
    label: 'Chat Notification Sound',
    description: 'Plays when you receive a chat message',
    sound: SOUNDS.CHAT_NOTIFICATION,
    color: 'green',
  },
  {
    key: 'newStripSound' as const,
    label: 'New Strip Sound',
    description: 'Plays when a new flight strip appears',
    sound: SOUNDS.NEW_STRIP,
    color: 'purple',
  },
  {
    key: 'acarsBeep' as const,
    label: 'ACARS Alert Sound (BEEP BEEP)',
    description: 'Plays for PDC, warnings, and contact messages in ACARS',
    sound: SOUNDS.ACARS_BEEP,
    color: 'cyan',
  },
  {
    key: 'acarsChatPop' as const,
    label: 'ACARS Chat Sound',
    description: 'Plays for system messages and ATIS in ACARS',
    sound: SOUNDS.ACARS_CHAT_POP,
    color: 'orange',
  },
];

const getColorClasses = (color: string) => {
  switch (color) {
    case 'blue':   return { bg: 'bg-blue-500/20',   text: 'text-blue-400',   hover: 'hover:bg-blue-500/30'   };
    case 'green':  return { bg: 'bg-green-500/20',  text: 'text-green-400',  hover: 'hover:bg-green-500/30'  };
    case 'purple': return { bg: 'bg-purple-500/20', text: 'text-purple-400', hover: 'hover:bg-purple-500/30' };
    case 'cyan':   return { bg: 'bg-cyan-500/20',   text: 'text-cyan-400',   hover: 'hover:bg-cyan-500/30'   };
    case 'orange': return { bg: 'bg-orange-500/20', text: 'text-orange-400', hover: 'hover:bg-orange-500/30' };
    default:       return { bg: 'bg-zinc-500/20',   text: 'text-zinc-400',   hover: 'hover:bg-zinc-500/30'   };
  }
};

export default function SoundSettings({ settings, onChange }: SoundSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [playingKey, setPlayingKey] = useState<keyof Settings['sounds'] | null>(null);

  const handleToggle = (soundKey: keyof Settings['sounds']) => {
    if (!settings) return;
    onChange({
      ...settings,
      sounds: {
        ...settings.sounds,
        [soundKey]: {
          ...settings.sounds[soundKey],
          enabled: !settings.sounds[soundKey].enabled,
        },
      },
    });
  };

  const handleVolumeChange = (soundKey: keyof Settings['sounds'], volume: number) => {
    if (!settings) return;
    onChange({
      ...settings,
      sounds: {
        ...settings.sounds,
        [soundKey]: {
          ...settings.sounds[soundKey],
          volume,
        },
      },
    });
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
    <div className={S.card}>
      <div className={S.header}>
        <div className={S.headerInner}>
          <div className={S.headerClickable} onClick={() => setIsExpanded(!isExpanded)}>
            <div className={`${S.iconBox} ${S.iconBoxMr} bg-orange-500/20`}>
              <Volume2 className={`${S.icon} text-orange-400`} />
            </div>
            <div className="text-left min-w-0">
              <h3 className={S.title}>Sound Settings</h3>
              <p className={S.subtitle}>Configure audio notifications and their volume levels</p>
            </div>
          </div>
          <Button onClick={() => setIsExpanded(!isExpanded)} variant="outline" size="sm" className={S.chevronBtn}>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className={S.content}>
          <div className="space-y-4">
            {soundConfigs.map(({ key, label, description, color }) => {
              const soundSetting = settings.sounds[key];
              const colors = getColorClasses(color);
              return (
                <div key={key} className={`${S.section} transition-all ${soundSetting.enabled ? '' : 'opacity-75'}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start flex-1 gap-4">
                      <div
                        className={`${S.sectionIconBox} relative cursor-pointer transition-all duration-200 ${
                          soundSetting.enabled ? `${colors.bg} ${colors.hover}` : 'bg-zinc-700/30 hover:bg-zinc-600/30'
                        }`}
                        onClick={() => handleToggle(key)}
                      >
                        {soundSetting.enabled
                          ? <Volume2 className={`${S.sectionIcon} ${colors.text}`} />
                          : <VolumeX className={`${S.sectionIcon} text-zinc-500`} />
                        }
                        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-zinc-800 transition-all ${soundSetting.enabled ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
                      </div>
                      <div className="flex-1">
                        <h4 className={S.sectionTitle}>{label}</h4>
                        <p className={S.sectionSubtitle}>{description}</p>
                      </div>
                    </div>
                    <div className="ml-4">
                      <AudioVisualizerButton
                        isPlaying={playingKey === key}
                        onClick={() => handlePlayTest(key)}
                        label="Test"
                        variant={
                          key === 'startupSound' ? 'default'
                          : key === 'chatNotificationSound' ? 'notification'
                          : key === 'newStripSound' ? 'newstrip'
                          : key === 'acarsBeep' ? 'acars-beep'
                          : key === 'acarsChatPop' ? 'acars-chat'
                          : 'custom'
                        }
                      />
                    </div>
                  </div>
                  <div className={`transition-all ${soundSetting.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div className="flex items-center space-x-4">
                      <span className="text-xs text-zinc-500 w-16 text-center">10%</span>
                      <div className="flex-1 relative flex items-center">
                        <input
                          type="range"
                          min="10"
                          max="200"
                          step="10"
                          value={soundSetting.volume}
                          onChange={(e) => handleVolumeChange(key, parseInt(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer volume-slider"
                        />
                        <div
                          className={`absolute top-0 left-0 h-2 rounded-lg pointer-events-none ${
                            soundSetting.volume <= 100
                              ? 'bg-gradient-to-r from-green-500 to-yellow-500'
                              : 'bg-gradient-to-r from-yellow-500 to-red-500'
                          }`}
                          style={{ width: `${Math.min(((soundSetting.volume - 10) / 190) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500 w-16 text-center">200%</span>
                      <span className={`text-sm font-medium w-16 text-center px-2 py-1 rounded ${
                        soundSetting.volume <= 100 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {soundSetting.volume}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}