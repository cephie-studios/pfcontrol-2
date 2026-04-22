import { Layout, Eye, Monitor, Smartphone, Layers, ChevronDown, ChevronUp, Map } from 'lucide-react';
import { BiSidebar } from 'react-icons/bi';
import { HiOutlineQueueList } from 'react-icons/hi2';
import { useState } from 'react';
import type { Settings } from '../../types/settings';
import Button from '../common/Button';
import Toggle from './Toggle';
import { S } from './settingsTokens';

interface LayoutSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

export default function LayoutSettings({ settings, onChange }: LayoutSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCombinedViewToggle = () => {
    if (!settings) return;
    onChange({ ...settings, layout: { ...settings.layout, showCombinedView: !settings.layout.showCombinedView } });
  };

  const handleOpacityChange = (opacity: number) => {
    if (!settings) return;
    onChange({ ...settings, layout: { ...settings.layout, flightRowOpacity: opacity } });
  };

  const handleChartViewModeChange = (mode: 'list' | 'legacy') => {
    if (!settings) return;
    onChange({ ...settings, layout: { ...settings.layout, chartDrawerViewMode: mode } });
  };

  if (!settings) return null;

  return (
    <div className={S.card}>
      <div className={S.header}>
        <div className={S.headerInner}>
          <div className={S.headerClickable} onClick={() => setIsExpanded(!isExpanded)}>
            <div className={`${S.iconBox} ${S.iconBoxMr} bg-green-500/20`}>
              <Layout className={`${S.icon} text-green-400`} />
            </div>
            <div className="text-left min-w-0">
              <h3 className={S.title}>Layout Settings</h3>
              <p className={S.subtitle}>Configure how flight tables are displayed and their appearance</p>
            </div>
          </div>
          <Button onClick={() => setIsExpanded(!isExpanded)} variant="outline" size="sm" className={S.chevronBtn}>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className={S.content}>
          <div className="space-y-6">

            {/* Combined View */}
            <div className={S.section}>
              <div className={S.sectionHeader}>
                <div className={`${S.sectionIconBox} bg-blue-500/20`}>
                  <Monitor className={`${S.sectionIcon} text-blue-400`} />
                </div>
                <div className="flex-1">
                  <h4 className={S.sectionTitle}>Combined View (Desktop)</h4>
                  <p className={S.sectionSubtitle}>Show both departure and arrival tables on the same page for desktop users</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-4">
                <Smartphone className="h-4 w-4 text-zinc-500" />
                <Toggle checked={settings.layout.showCombinedView} onChange={handleCombinedViewToggle} activeColor="bg-green-600" />
                <Monitor className="h-4 w-4 text-zinc-500" />
              </div>
              <div className="mt-3 text-center">
                <span className={`text-sm font-medium ${settings.layout.showCombinedView ? 'text-green-400' : 'text-zinc-400'}`}>
                  {settings.layout.showCombinedView ? 'Combined view enabled' : 'Separate tabs (default)'}
                </span>
              </div>
            </div>

            {/* Flight Row Transparency */}
            <div className={S.section}>
              <div className={S.sectionHeader}>
                <div className={`${S.sectionIconBox} bg-purple-500/20`}>
                  <Layers className={`${S.sectionIcon} text-purple-400`} />
                </div>
                <div>
                  <h4 className={S.sectionTitle}>Flight Row Transparency</h4>
                  <p className={S.sectionSubtitle}>Adjust the opacity of flight strips when using background images</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <span className="text-xs text-zinc-500 w-16 text-center">0%</span>
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={settings.layout.flightRowOpacity}
                      onChange={(e) => handleOpacityChange(parseInt(e.target.value))}
                      className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer opacity-slider"
                    />
                    <div
                      className="absolute top-0 left-0 h-2 bg-gradient-to-r from-purple-500 to-purple-400 rounded-lg pointer-events-none"
                      style={{ width: `${settings.layout.flightRowOpacity}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500 w-16 text-center">100%</span>
                  <span className={`text-sm font-medium w-16 text-center px-2 py-1 rounded ${
                    settings.layout.flightRowOpacity <= 50 ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'
                  }`}>
                    {settings.layout.flightRowOpacity}%
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-xs text-zinc-400 mb-3 flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Preview:
                  </p>
                  <div className="relative rounded-lg overflow-hidden border border-zinc-700/50">
                    <div
                      className="absolute inset-0 bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900"
                      style={{
                        backgroundImage: `
                          radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
                          radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.15) 0%, transparent 50%),
                          radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.1) 0%, transparent 50%)
                        `,
                      }}
                    />
                    <div
                      className="relative bg-zinc-800 border border-zinc-700 p-3"
                      style={{ backgroundColor: `rgba(39, 39, 42, ${settings.layout.flightRowOpacity / 100})` }}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-4">
                          <span className="text-blue-400 font-mono font-medium">BAW123</span>
                          <span className="text-zinc-300">B738</span>
                          <span className="text-zinc-400">EGLL → KJFK</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">RWY</span>
                          <span className="text-zinc-400 text-xs">09:15</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className="relative bg-zinc-800 border-t border-zinc-700 p-3"
                      style={{ backgroundColor: `rgba(39, 39, 42, ${settings.layout.flightRowOpacity / 100})` }}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-4">
                          <span className="text-blue-400 font-mono font-medium">UAL456</span>
                          <span className="text-zinc-300">B777</span>
                          <span className="text-zinc-400">KJFK → EGLL</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">TAXI</span>
                          <span className="text-zinc-400 text-xs">09:22</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart Drawer View Mode */}
            <div className={S.section}>
              <div className={S.sectionHeader}>
                <div className={`${S.sectionIconBox} bg-cyan-500/20`}>
                  <Map className={`${S.sectionIcon} text-cyan-400`} />
                </div>
                <div>
                  <h4 className={S.sectionTitle}>Chart Drawer View Mode</h4>
                  <p className={S.sectionSubtitle}>Choose how charts are displayed</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleChartViewModeChange('legacy')}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    (settings.layout.chartDrawerViewMode || 'legacy') === 'legacy'
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

          <div className={`${S.infoBanner} bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border-blue-500/20`}>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-blue-300 font-medium text-sm mb-1">Layout Information</h4>
                <p className="text-blue-200/80 text-xs sm:text-sm leading-relaxed">
                  Combined view only applies to desktop screens — mobile devices will always show tabs. Flight row
                  transparency affects the visibility of flight strips when background images are enabled. Chart drawer
                  view mode controls how charts are displayed in the ACARS terminal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}