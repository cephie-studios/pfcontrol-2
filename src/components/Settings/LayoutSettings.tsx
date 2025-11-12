import {
  Layout,
  Eye,
  Monitor,
  Smartphone,
  Layers,
  ChevronDown,
  ChevronUp,
  Map,
} from 'lucide-react';
import { BiSidebar } from 'react-icons/bi';
import { HiOutlineQueueList } from 'react-icons/hi2';
import { useState } from 'react';
import type { Settings } from '../../types/settings';
import Button from '../common/Button';

interface LayoutSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

export default function LayoutSettings({
  settings,
  onChange,
}: LayoutSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCombinedViewToggle = () => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      layout: {
        ...settings.layout,
        showCombinedView: !settings.layout.showCombinedView,
      },
    };
    onChange(updatedSettings);
  };

  const handleOpacityChange = (opacity: number) => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      layout: {
        ...settings.layout,
        flightRowOpacity: opacity,
      },
    };
    onChange(updatedSettings);
  };

  const handleChartViewModeChange = (mode: 'list' | 'legacy') => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      layout: {
        ...settings.layout,
        chartDrawerViewMode: mode,
      },
    };
    onChange(updatedSettings);
  };

  if (!settings) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="w-full p-4 sm:p-6 border-b border-zinc-700/50">
        <div className="flex items-center justify-between gap-3">
          <div
            className="flex items-center flex-1 min-w-0 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="p-2 bg-green-500/20 rounded-lg mr-3 sm:mr-4 flex-shrink-0">
              <Layout className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" />
            </div>
            <div className="text-left min-w-0">
              <h3 className="text-lg sm:text-xl font-semibold text-white">
                Layout Settings
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm mt-1 hidden sm:block">
                Configure how flight tables are displayed and their appearance
              </p>
            </div>
          </div>
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
          <div className="space-y-6">
            {/* Combined View Setting */}
            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-5">
              <div className="flex items-start mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg mr-4 mt-0.5">
                  <Monitor className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-medium mb-1">
                    Combined View (Desktop)
                  </h4>
                  <p className="text-zinc-400 text-sm">
                    Show both departure and arrival tables on the same page for
                    desktop users
                  </p>
                </div>
              </div>

              {/* Toggle Control */}
              <div className="flex items-center justify-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.layout.showCombinedView}
                    onChange={handleCombinedViewToggle}
                    className="sr-only peer"
                  />
                  <div className="relative w-14 h-7 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600 shadow-inner">
                    <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-medium">
                      <Smartphone className="h-3 w-3 text-white" />
                      <Monitor className="h-3 w-3 text-zinc-400" />
                    </div>
                  </div>
                </label>
              </div>

              <div className="mt-3 text-center">
                <span
                  className={`text-sm font-medium ${
                    settings.layout.showCombinedView
                      ? 'text-green-400'
                      : 'text-zinc-400'
                  }`}
                >
                  {settings.layout.showCombinedView
                    ? 'Combined view enabled'
                    : 'Separate tabs (default)'}
                </span>
              </div>
            </div>

            {/* Flight Row Transparency Setting */}
            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-5">
              <div className="flex items-start mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg mr-4 mt-0.5">
                  <Layers className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">
                    Flight Row Transparency
                  </h4>
                  <p className="text-zinc-400 text-sm">
                    Adjust the opacity of flight strips when using background
                    images
                  </p>
                </div>
              </div>

              {/* Slider Control */}
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <span className="text-xs text-zinc-500 w-16 text-center">
                    0%
                  </span>
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={settings.layout.flightRowOpacity}
                      onChange={(e) =>
                        handleOpacityChange(parseInt(e.target.value))
                      }
                      className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer opacity-slider"
                    />
                    <div
                      className="absolute top-0 left-0 h-2 bg-gradient-to-r from-purple-500 to-purple-400 rounded-lg pointer-events-none"
                      style={{
                        width: `${settings.layout.flightRowOpacity}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-xs text-zinc-500 w-16 text-center">
                    100%
                  </span>
                  <span
                    className={`text-sm font-medium w-16 text-center px-2 py-1 rounded ${
                      settings.layout.flightRowOpacity <= 50
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {settings.layout.flightRowOpacity}%
                  </span>
                </div>

                {/* Enhanced Preview */}
                <div className="mt-4">
                  <p className="text-xs text-zinc-400 mb-3 flex items-center">
                    <Eye className="h-3 w-3 mr-1" />
                    Preview:
                  </p>
                  <div className="relative rounded-lg overflow-hidden border border-zinc-700/50">
                    {/* Background Image Simulation */}
                    <div
                      className="absolute inset-0 bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900"
                      style={{
                        backgroundImage: `
                                                    radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
                                                    radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.15) 0%, transparent 50%),
                                                    radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.1) 0%, transparent 50%)
                                                `,
                      }}
                    ></div>

                    {/* Flight Strip Overlay */}
                    <div
                      className="relative bg-zinc-800 border border-zinc-700 p-3"
                      style={{
                        backgroundColor: `rgba(39, 39, 42, ${
                          settings.layout.flightRowOpacity / 100
                        })`,
                      }}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-4">
                          <span className="text-blue-400 font-mono font-medium">
                            BAW123
                          </span>
                          <span className="text-zinc-300">B738</span>
                          <span className="text-zinc-400">EGLL → KJFK</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                            RWY
                          </span>
                          <span className="text-zinc-400 text-xs">09:15</span>
                        </div>
                      </div>
                    </div>

                    {/* Second flight strip for better preview */}
                    <div
                      className="relative bg-zinc-800 border-t border-zinc-700 p-3"
                      style={{
                        backgroundColor: `rgba(39, 39, 42, ${
                          settings.layout.flightRowOpacity / 100
                        })`,
                      }}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-4">
                          <span className="text-blue-400 font-mono font-medium">
                            UAL456
                          </span>
                          <span className="text-zinc-300">B777</span>
                          <span className="text-zinc-400">KJFK → EGLL</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                            TAXI
                          </span>
                          <span className="text-zinc-400 text-xs">09:22</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart Drawer View Mode */}
            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-5">
              <div className="flex items-start mb-4">
                <div className="p-2 bg-cyan-500/20 rounded-lg mr-4 mt-0.5">
                  <Map className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">
                    Chart Drawer View Mode
                  </h4>
                  <p className="text-zinc-400 text-sm">
                    Choose how charts are displayed
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleChartViewModeChange('legacy')}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    (settings.layout.chartDrawerViewMode || 'legacy') ===
                    'legacy'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  <BiSidebar className="text-base" />
                  Legacy View
                </button>
                <button
                  onClick={() => handleChartViewModeChange('list')}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    settings.layout.chartDrawerViewMode === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  <HiOutlineQueueList className="text-base" />
                  List View
                </button>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-500/20 rounded-lg">
            <div className="flex items-start">
              <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
              <div>
                <h4 className="text-blue-300 font-medium text-sm mb-1">
                  Layout Information
                </h4>
                <p className="text-blue-200/80 text-xs sm:text-sm leading-relaxed">
                  Combined view only applies to desktop screens - mobile devices
                  will always show tabs. Flight row transparency affects the
                  visibility of flight strips when background images are
                  enabled, helping you balance aesthetics with readability.
                  Chart drawer view mode controls how charts are displayed in
                  the ACARS terminal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
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
