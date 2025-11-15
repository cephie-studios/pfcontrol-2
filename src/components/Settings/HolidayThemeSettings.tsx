import type { Settings } from '../../types/settings';
import { Snowflake, Music, Gift, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import Button from '../common/Button';

interface HolidayThemeSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
  globalHolidayEnabled: boolean;
}

export default function HolidayThemeSettings({
  settings,
  onChange,
  globalHolidayEnabled,
}: HolidayThemeSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!settings) return null;

  // Hide entire section if global holiday is disabled
  if (!globalHolidayEnabled) {
    return null;
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="w-full p-4 sm:p-6 border-b border-zinc-700/50">
        <div className="flex items-center justify-between gap-3">
          <div
            className="flex items-center flex-1 min-w-0 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="p-2 bg-red-500/20 rounded-lg mr-3 sm:mr-4 flex-shrink-0">
              <Gift className="h-5 w-5 sm:h-6 sm:w-6 text-red-400" />
            </div>
            <div className="text-left min-w-0">
              <h3 className="text-lg sm:text-xl font-semibold text-white">
                Holiday Theme Settings
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm mt-1 hidden sm:block">
                Customize your festive experience
              </p>
            </div>
          </div>

          {/* Master Toggle */}
          <label className="relative inline-flex items-center cursor-pointer mr-2">
            <input
              type="checkbox"
              checked={settings.holidayTheme?.enabled ?? false}
              onChange={(e) => {
                const newSettings = {
                  ...settings,
                  holidayTheme: {
                    ...settings.holidayTheme,
                    enabled: e.target.checked,
                  },
                };
                onChange(newSettings);
              }}
              className="sr-only peer"
            />
            <div className="relative w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
          </label>

          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            variant="outline"
            size="sm"
            className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 p-2 flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

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
            {/* Snow Effect Toggle */}
            <div className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 hover:border-blue-500/30 transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Snowflake className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <label className="text-white font-medium">Snow Effect</label>
                  <p className="text-xs text-zinc-400 mt-1">
                    Display falling snow animation
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.holidayTheme?.snowEffect ?? true}
                  onChange={(e) => {
                    const newSettings = {
                      ...settings,
                      holidayTheme: {
                        ...settings.holidayTheme,
                        snowEffect: e.target.checked,
                      },
                    };
                    onChange(newSettings);
                  }}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Snowman Toggle */}
            <div className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 hover:border-blue-500/30 transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg text-2xl">
                  ☃️
                </div>
                <div>
                  <label className="text-white font-medium">Snowman</label>
                  <p className="text-xs text-zinc-400 mt-1">
                    Display snowman decoration
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.holidayTheme?.animations ?? true}
                  onChange={(e) => {
                    const newSettings = {
                      ...settings,
                      holidayTheme: {
                        ...settings.holidayTheme,
                        animations: e.target.checked,
                      },
                    };
                    onChange(newSettings);
                  }}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            {/* going to keep this disabled until we have a proper implementation */}
            {/* Santa Toggle
            <div className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 hover:border-red-500/30 transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg text-2xl">
                  🎅
                </div>
                <div>
                  <label className="text-white font-medium">Santa</label>
                  <p className="text-xs text-zinc-400 mt-1">
                    Display Santa decoration
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.holidayTheme?.santa ?? true}
                  onChange={(e) => {
                    const newSettings = {
                      ...settings,
                      holidayTheme: {
                        ...settings.holidayTheme,
                        santa: e.target.checked,
                      },
                    };
                    onChange(newSettings);
                  }}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div> */}

            {/* Holiday Music Toggle */}
            <div className="flex items-center justify-between p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 hover:border-green-500/30 transition-all">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Music className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <label className="text-white font-medium">Holiday Music</label>
                  <p className="text-xs text-zinc-400 mt-1">
                    Play festive background music
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.holidayTheme?.music ?? false}
                  onChange={(e) => {
                    const newSettings = {
                      ...settings,
                      holidayTheme: {
                        ...settings.holidayTheme,
                        music: e.target.checked,
                      },
                    };
                    onChange(newSettings);
                  }}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            {/* Music Volume Slider */}
            {settings.holidayTheme?.music && (
              <div className="p-4 bg-zinc-800/30 border border-zinc-700/50 rounded-lg">
                <label className="text-white font-medium block mb-3 flex items-center gap-2">
                  <Music className="w-4 h-4 text-green-400" />
                  Music Volume
                </label>
                <div className="flex items-center space-x-4">
                  <span className="text-xs text-zinc-500 w-16 text-center">
                    0%
                  </span>
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.holidayTheme?.musicVolume ?? 50}
                      onChange={(e) => {
                        const newSettings = {
                          ...settings,
                          holidayTheme: {
                            ...settings.holidayTheme,
                            musicVolume: parseInt(e.target.value, 10),
                          },
                        };
                        onChange(newSettings);
                      }}
                      className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer music-volume-slider"
                    />
                    <div
                      className="absolute top-0 left-0 h-2 bg-gradient-to-r from-green-500 to-green-400 rounded-lg pointer-events-none"
                      style={{
                        width: `${settings.holidayTheme?.musicVolume ?? 50}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-xs text-zinc-500 w-16 text-center">
                    100%
                  </span>
                  <span className="text-sm font-medium w-16 text-center px-2 py-1 rounded bg-green-500/20 text-green-400">
                    {settings.holidayTheme?.musicVolume ?? 50}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .music-volume-slider::-webkit-slider-thumb {
          appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 2px solid #22c55e;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          position: relative;
          z-index: 10;
        }
        .music-volume-slider::-moz-range-thumb {
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 2px solid #22c55e;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          position: relative;
          z-index: 10;
        }
        .music-volume-slider {
          background: transparent;
          position: relative;
          z-index: 5;
        }
      `}</style>
    </div>
  );
}
