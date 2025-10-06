import { Volume2, VolumeX, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { SOUNDS } from '../../utils/playSound';
import type { Settings } from '../../types/settings';
import AudioVisualizerButton from './AudioVisualizerButton';
import Button from '../common/Button';

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
];

export default function SoundSettings({
    settings,
    onChange,
}: SoundSettingsProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [playingKey, setPlayingKey] = useState<
        keyof Settings['sounds'] | null
    >(null);

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
            audio.volume = Math.max(0, Math.min(1, soundSetting.volume / 100));
            audio.play();
            audio.onended = () => setPlayingKey(null);
            audio.onerror = () => setPlayingKey(null);
        } catch (error) {
            console.warn('Failed to play test sound:', error);
            setPlayingKey(null);
        }
    };

    if (!settings) return null;

    const getColorClasses = (color: string) => {
        switch (color) {
            case 'blue':
                return {
                    bg: 'bg-blue-500/20',
                    text: 'text-blue-400',
                    border: 'border-blue-500/30',
                    hover: 'hover:bg-blue-500/30',
                };
            case 'green':
                return {
                    bg: 'bg-green-500/20',
                    text: 'text-green-400',
                    border: 'border-green-500/30',
                    hover: 'hover:bg-green-500/30',
                };
            case 'purple':
                return {
                    bg: 'bg-purple-500/20',
                    text: 'text-purple-400',
                    border: 'border-purple-500/30',
                    hover: 'hover:bg-purple-500/30',
                };
            default:
                return {
                    bg: 'bg-zinc-500/20',
                    text: 'text-zinc-400',
                    border: 'border-zinc-500/30',
                    hover: 'hover:bg-zinc-500/30',
                };
        }
    };

    return (
        <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-6 border-b border-zinc-700/50"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <div className="p-2 bg-orange-500/20 rounded-lg mr-4">
                            <Volume2 className="h-6 w-6 text-orange-400" />
                        </div>
                        <div className="text-left">
                            <h3 className="text-xl font-semibold text-white">
                                Sound Settings
                            </h3>
                            <p className="text-zinc-400 text-sm mt-1">
                                Configure audio notifications and their volume
                                levels
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => setIsExpanded(!isExpanded)}
                        variant="outline"
                        size="sm"
                        className="border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                    >
                        {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </button>

            {/* Content */}
            <div
                className={`transition-all duration-300 ease-in-out ${
                    isExpanded
                        ? 'max-h-[2000px] opacity-100'
                        : 'max-h-0 opacity-0 overflow-hidden'
                }`}
            >
                <div className="p-6">
                    <div className="space-y-4">
                        {soundConfigs.map(
                            ({ key, label, description, color }) => {
                                const soundSetting = settings.sounds[key];
                                const colors = getColorClasses(color);

                                return (
                                    <div
                                        key={key}
                                        className={`bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-5 transition-all ${
                                            soundSetting.enabled
                                                ? `hover:${colors.border}`
                                                : 'opacity-75'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-start flex-1">
                                                {/* Icon Toggle Button */}
                                                <button
                                                    onClick={() =>
                                                        handleToggle(key)
                                                    }
                                                    className={`relative p-2 rounded-lg mr-4 mt-0.5 transition-all duration-200 cursor-pointer group ${
                                                        soundSetting.enabled
                                                            ? `${colors.bg} ${colors.hover}`
                                                            : 'bg-zinc-700/30 hover:bg-zinc-600/30'
                                                    }`}
                                                >
                                                    {soundSetting.enabled ? (
                                                        <Volume2
                                                            className={`h-5 w-5 transition-colors ${colors.text}`}
                                                        />
                                                    ) : (
                                                        <VolumeX className="h-5 w-5 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                                                    )}

                                                    {/* Toggle indicator */}
                                                    <div
                                                        className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-zinc-800 transition-all ${
                                                            soundSetting.enabled
                                                                ? 'bg-emerald-500'
                                                                : 'bg-zinc-600'
                                                        }`}
                                                    />
                                                </button>

                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-white font-medium">
                                                            {label}
                                                        </h4>
                                                    </div>
                                                    <p className="text-zinc-400 text-sm">
                                                        {description}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="ml-4">
                                                <AudioVisualizerButton
                                                    isPlaying={
                                                        playingKey === key
                                                    }
                                                    onClick={() =>
                                                        handlePlayTest(key)
                                                    }
                                                    label="Test"
                                                    variant={
                                                        key === 'startupSound'
                                                            ? 'default'
                                                            : key ===
                                                              'chatNotificationSound'
                                                            ? 'notification'
                                                            : key ===
                                                              'newStripSound'
                                                            ? 'newstrip'
                                                            : 'custom'
                                                    }
                                                />
                                            </div>
                                        </div>

                                        {/* Volume Control */}
                                        <div
                                            className={`transition-all ${
                                                soundSetting.enabled
                                                    ? 'opacity-100'
                                                    : 'opacity-50 pointer-events-none'
                                            }`}
                                        >
                                            <div className="flex items-center space-x-4">
                                                <span className="text-xs text-zinc-500 w-16 text-center">
                                                    10%
                                                </span>
                                                <div className="flex-1 relative flex items-center">
                                                    <input
                                                        type="range"
                                                        min="10"
                                                        max="200"
                                                        step="10"
                                                        value={
                                                            soundSetting.volume
                                                        }
                                                        onChange={(e) =>
                                                            handleVolumeChange(
                                                                key,
                                                                parseInt(
                                                                    e.target
                                                                        .value
                                                                )
                                                            )
                                                        }
                                                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer volume-slider"
                                                    />
                                                    <div
                                                        className={`absolute top-0 left-0 h-2 rounded-lg pointer-events-none ${
                                                            soundSetting.volume <=
                                                            100
                                                                ? 'bg-gradient-to-r from-green-500 to-yellow-500'
                                                                : 'bg-gradient-to-r from-yellow-500 to-red-500'
                                                        }`}
                                                        style={{
                                                            width: `${Math.min(
                                                                ((soundSetting.volume -
                                                                    10) /
                                                                    190) *
                                                                    100,
                                                                100
                                                            )}%`,
                                                        }}
                                                    ></div>
                                                </div>
                                                <span className="text-xs text-zinc-500 w-16 text-center">
                                                    200%
                                                </span>
                                                <span
                                                    className={`text-sm font-medium w-16 text-center px-2 py-1 rounded ${
                                                        soundSetting.volume <=
                                                        100
                                                            ? 'bg-green-500/20 text-green-400'
                                                            : 'bg-red-500/20 text-red-400'
                                                    }`}
                                                >
                                                    {soundSetting.volume}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .volume-slider::-webkit-slider-thumb {
                    appearance: none;
                    height: 18px;
                    width: 18px;
                    border-radius: 50%;
                    background: #ffffff;
                    cursor: pointer;
                    border: 2px solid #10b981;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    position: relative;
                    z-index: 10;
                }
                .volume-slider::-moz-range-thumb {
                    height: 18px;
                    width: 18px;
                    border-radius: 50%;
                    background: #ffffff;
                    cursor: pointer;
                    border: 2px solid #10b981;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    position: relative;
                    z-index: 10;
                }
                .volume-slider {
                    background: transparent;
                    position: relative;
                    z-index: 5;
                }
                .opacity-slider::-webkit-slider-thumb {
                    appearance: none;
                    height: 18px;
                    width: 18px;
                    border-radius: 50%;
                    background: #ffffff;
                    cursor: pointer;
                    border: 2px solid #a855f7;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    position: relative;
                    z-index: 10;
                }
                .opacity-slider::-moz-range-thumb {
                    height: 18px;
                    width: 18px;
                    border-radius: 50%;
                    background: #ffffff;
                    cursor: pointer;
                    border: 2px solid #a855f7;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    position: relative;
                    z-index: 10;
                }
                .opacity-slider {
                    background: transparent;
                    position: relative;
                    z-index: 5;
                }
            `}</style>
        </div>
    );
}
