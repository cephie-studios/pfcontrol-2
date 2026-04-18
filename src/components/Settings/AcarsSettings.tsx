import {
  Terminal,
  StickyNote,
  LayoutDashboard,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import type { Settings } from '../../types/settings';
import Button from '../common/Button';

interface AcarsSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

export default function AcarsSettings({
  settings,
  onChange,
}: AcarsSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState<'sidebar' | 'terminal' | 'notes' | null>(null);
  const [previewWidths, setPreviewWidths] = useState({ sidebar: 30, terminal: 50, notes: 20 });

  const containerRef = useRef<HTMLDivElement>(null);

  const minSidebar = 10, maxSidebar = 40;
  const minTerminal = 20, maxTerminal = 80;
  const minNotes = 10, maxNotes = 60;

  const calculatedWidths = useMemo(() => {
    if (!settings) return { sidebar: 30, terminal: 50, notes: 20 };

    let sidebarWidth = settings.acars.sidebarWidth ?? 30;
    let terminalWidth = settings.acars.terminalWidth ?? 50;
    let notesWidth = settings.acars.notesWidth ?? 20;
    const notesEnabled = settings.acars.notesEnabled;

    sidebarWidth = Math.max(minSidebar, Math.min(maxSidebar, sidebarWidth));
    if (notesEnabled) {
      notesWidth = Math.max(minNotes, Math.min(maxNotes, notesWidth));
      terminalWidth = 100 - sidebarWidth - notesWidth;
      terminalWidth = Math.max(minTerminal, terminalWidth);
      if (sidebarWidth + terminalWidth + notesWidth > 100) {
        notesWidth = 100 - sidebarWidth - terminalWidth;
        notesWidth = Math.max(minNotes, notesWidth);
      }
    } else {
      notesWidth = 0;
      terminalWidth = 100 - sidebarWidth;
      terminalWidth = Math.max(minTerminal, terminalWidth);
    }

    return { sidebar: sidebarWidth, terminal: terminalWidth, notes: notesWidth };
  }, [settings]);

  useEffect(() => {
    setPreviewWidths(calculatedWidths);
  }, [calculatedWidths]);

  const handleNotesToggle = () => {
    if (!settings) return;
    onChange({
      ...settings,
      acars: { ...settings.acars, notesEnabled: !settings.acars.notesEnabled },
    });
  };

  const handleAutoRedirectToggle = () => {
    if (!settings) return;
    onChange({
      ...settings,
      acars: { ...settings.acars, autoRedirectToAcars: !settings.acars.autoRedirectToAcars },
    });
  };

  const handleMouseDown = (divider: 'sidebar' | 'terminal' | 'notes') => setIsDragging(divider);

  const handleMouseMove = (e: MouseEvent | React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !settings || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    let tempSidebar = previewWidths.sidebar;
    let tempTerminal = previewWidths.terminal;
    let tempNotes = previewWidths.notes;

    if (isDragging === 'sidebar') {
      const mouseSidebar = (x / rect.width) * 100;
      tempSidebar = Math.round(Math.max(minSidebar, Math.min(maxSidebar, mouseSidebar)) / 5) * 5;

      if (settings.acars.notesEnabled) {
        tempNotes = Math.max(minNotes, Math.min(maxNotes, previewWidths.notes));
        tempTerminal = 100 - tempSidebar - tempNotes;
        tempTerminal = Math.max(minTerminal, tempTerminal);
      } else {
        tempNotes = 0;
        tempTerminal = 100 - tempSidebar;
      }
    } else if (isDragging === 'terminal' && settings.acars.notesEnabled) {
      const sidebar = previewWidths.sidebar;
      const mouseTerminal = (x / rect.width) * 100 - sidebar;
      tempTerminal = Math.round(Math.max(minTerminal, Math.min(maxTerminal, mouseTerminal)) / 5) * 5;
      tempNotes = Math.max(minNotes, 100 - sidebar - tempTerminal);
      tempTerminal = 100 - sidebar - tempNotes;
    }

    setPreviewWidths({ sidebar: tempSidebar, terminal: tempTerminal, notes: tempNotes });
  };

  const commitWidths = () => {
    if (!settings) return;
    onChange({
      ...settings,
      acars: {
        ...settings.acars,
        sidebarWidth: previewWidths.sidebar,
        terminalWidth: previewWidths.terminal,
        notesWidth: settings.acars.notesEnabled ? previewWidths.notes : settings.acars.notesWidth,
      },
    });
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const handleGlobalMouseUp = () => {
      commitWidths();
      setIsDragging(null);
    };
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, previewWidths]);

  if (!settings) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-6">
      {/* Header */}
      <div 
        className="w-full p-4 sm:p-6 border-b border-zinc-800 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 flex-shrink-0">
            <Terminal className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-white truncate">ACARS Settings</h3>
            <p className="text-zinc-400 text-xs sm:text-sm mt-0.5">Configure terminal panels and default layout</p>
          </div>
        </div>
        <div className="p-2 text-zinc-500">
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Panel Toggles */}
          <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-4 sm:p-5">
            <div className="flex items-start mb-4 gap-4">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 flex-shrink-0">
                <Eye size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-medium text-sm sm:text-base">Panel Visibility</h4>
                <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">Choose which panels are enabled in the terminal</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { 
                  id: 'notes', 
                  label: 'Notes Panel', 
                  desc: 'Flight notes and planning', 
                  icon: StickyNote, 
                  color: 'text-blue-400',
                  enabled: settings.acars.notesEnabled,
                  toggle: handleNotesToggle 
                },
                { 
                  id: 'redirect', 
                  label: 'Auto Redirect', 
                  desc: 'Automatically open ACARS after filing', 
                  icon: Terminal, 
                  color: 'text-green-400',
                  enabled: settings.acars.autoRedirectToAcars ?? true,
                  toggle: handleAutoRedirectToggle 
                }
              ].map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    <div>
                      <p className="text-white text-sm font-medium">{item.label}</p>
                      <p className="text-zinc-500 text-[11px]">{item.desc}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={item.enabled} onChange={item.toggle} />
                    <div className="w-10 h-5 bg-zinc-700 peer-checked:bg-blue-600 rounded-full transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 shadow-inner"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Preview Section */}
          <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-4 sm:p-5">
            <div className="flex items-start mb-4 gap-4">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 flex-shrink-0">
                <LayoutDashboard size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-medium text-sm sm:text-base">Layout Preview</h4>
                <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">Drag dividers to set default widths</p>
              </div>
            </div>

            <div 
              ref={containerRef}
              className="relative bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden h-32 flex"
            >
              {/* Sidebar Preview */}
              <div style={{ width: `${previewWidths.sidebar}%` }} className="bg-zinc-900 border-r border-zinc-800 p-2 overflow-hidden">
                <div className="h-2 bg-zinc-800 rounded w-1/2 mb-2" />
                <div className="space-y-1">
                  <div className="h-1 bg-zinc-800/50 rounded w-full" />
                  <div className="h-1 bg-zinc-800/50 rounded w-3/4" />
                </div>
              </div>
              
              <div 
                className="w-1 bg-blue-600/50 hover:bg-blue-500 cursor-col-resize transition-colors z-10"
                onMouseDown={() => handleMouseDown('sidebar')}
              />

              {/* Terminal Preview */}
              <div style={{ width: `${previewWidths.terminal}%` }} className="bg-zinc-950 p-2 overflow-hidden">
                <div className="h-2 bg-zinc-800 rounded w-1/3 mb-2" />
                <div className="space-y-1">
                  <div className="h-1 bg-green-500/10 rounded w-full" />
                  <div className="h-1 bg-green-500/10 rounded w-full" />
                </div>
              </div>

              {settings.acars.notesEnabled && (
                <>
                  <div 
                    className="w-1 bg-blue-600/50 hover:bg-blue-500 cursor-col-resize transition-colors z-10"
                    onMouseDown={() => handleMouseDown('terminal')}
                  />
                  <div style={{ width: `${previewWidths.notes}%` }} className="bg-zinc-900 border-l border-zinc-800 p-2 overflow-hidden">
                    <div className="h-2 bg-zinc-800 rounded w-1/2 mb-2" />
                    <div className="h-full bg-blue-500/5 rounded" />
                  </div>
                </>
              )}
            </div>
            
            <div className="mt-3 flex justify-center gap-4 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
               <span>SB: {previewWidths.sidebar}%</span>
               <span>TRM: {previewWidths.terminal}%</span>
               {settings.acars.notesEnabled && <span>NTS: {previewWidths.notes}%</span>}
            </div>
          </div>

          {/* Info Section */}
          <div className="p-4 bg-cyan-500/5 border border-cyan-500/10 rounded-lg flex gap-3">
            <div className="w-1 h-1 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
            <p className="text-cyan-200/60 text-xs leading-relaxed">
              Panel width settings apply to desktop view. The Terminal panel cannot be disabled. 
              Changes take effect on next terminal session.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
