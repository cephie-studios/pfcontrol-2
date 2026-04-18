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

// DESIGN TOKENS (Apply these to all 6 components)
const TOKENS = {
  container: "bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden",
  header: "w-full p-5 border-b border-zinc-800 flex items-center justify-between gap-3 cursor-pointer hover:bg-zinc-800/30 transition-colors",
  iconBox: "p-2.5 rounded-lg flex-shrink-0", // Standardized size
  section: "bg-zinc-800/40 border border-zinc-700/30 rounded-lg p-5", // Nested cards
  title: "text-lg font-semibold text-zinc-100",
  description: "text-zinc-400 text-sm mt-0.5",
  label: "text-white font-medium mb-1",
  toggleContainer: "relative w-12 h-6 bg-zinc-700 rounded-full transition-colors", // Unified toggle size
};

interface LayoutSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

export default function LayoutSettings({ settings, onChange }: LayoutSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!settings) return null;

  const updateLayout = (updates: Partial<Settings['layout']>) => {
    onChange({
      ...settings,
      layout: { ...settings.layout, ...updates }
    });
  };

  return (
    <div className={TOKENS.container}>
      {/* Header - Unified with other sections */}
      <div className={TOKENS.header} onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center min-w-0">
          <div className={`${TOKENS.iconBox} bg-green-500/10 mr-4`}>
            <Layout className="h-5 w-5 text-green-500" />
          </div>
          <div className="min-w-0">
            <h3 className={TOKENS.title}>Layout Settings</h3>
            <p className={`${TOKENS.description} hidden sm:block`}>
              Manage interface scaling and flight table visibility
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-zinc-500">
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </Button>
      </div>

      <div className={`transition-all duration-300 ${isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="p-5 space-y-4">
          
          {/* Section 1: Combined View */}
          <div className={TOKENS.section}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`${TOKENS.iconBox} bg-blue-500/10`}>
                  <Monitor className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h4 className={TOKENS.label}>Combined View</h4>
                  <p className="text-zinc-400 text-xs">Side-by-side arrivals and departures</p>
                </div>
              </div>
              
              <button 
                onClick={() => updateLayout({ showCombinedView: !settings.layout.showCombinedView })}
                className={`relative w-11 h-6 rounded-full transition-colors ${settings.layout.showCombinedView ? 'bg-green-600' : 'bg-zinc-700'}`}
              >
                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.layout.showCombinedView ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Section 2: Transparency Slider */}
          <div className={TOKENS.section}>
            <div className="flex items-center gap-4 mb-4">
              <div className={`${TOKENS.iconBox} bg-purple-500/10`}>
                <Layers className="h-5 w-5 text-purple-500" />
              </div>
              <h4 className={TOKENS.label}>Row Transparency</h4>
            </div>
            
            <input
              type="range"
              min="0"
              max="100"
              value={settings.layout.flightRowOpacity}
              onChange={(e) => updateLayout({ flightRowOpacity: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex justify-between mt-2 text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
              <span>Transparent</span>
              <span className="text-purple-400">{settings.layout.flightRowOpacity}%</span>
              <span>Opaque</span>
            </div>
          </div>

          {/* Section 3: View Mode Selection */}
          <div className={TOKENS.section}>
            <div className="flex items-center gap-4 mb-4">
              <div className={`${TOKENS.iconBox} bg-cyan-500/10`}>
                <Map className="h-5 w-5 text-cyan-500" />
              </div>
              <h4 className={TOKENS.label}>Chart Drawer Mode</h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'legacy', label: 'Legacy', icon: BiSidebar },
                { id: 'list', label: 'List View', icon: HiOutlineQueueList }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => updateLayout({ chartDrawerViewMode: mode.id as any })}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border transition-all ${
                    (settings.layout.chartDrawerViewMode || 'legacy') === mode.id
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                  }`}
                >
                  <mode.icon className="text-lg" />
                  <span className="text-sm font-medium">{mode.label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}