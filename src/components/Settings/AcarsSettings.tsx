import { Terminal, StickyNote, LayoutDashboard, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import type { Settings } from '../../types/settings';
import Button from '../common/Button';
import Toggle from './Toggle';
import { S } from './settingsTokens';

interface AcarsSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

export default function AcarsSettings({ settings, onChange }: AcarsSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState<'sidebar' | 'terminal' | 'notes' | null>(null);
  const [previewWidths, setPreviewWidths] = useState({ sidebar: 30, terminal: 50, notes: 20 });
  const containerRef = useRef<HTMLDivElement>(null);

  const minSidebar = 10, maxSidebar = 40;
  const minTerminal = 20, maxTerminal = 80;
  const minNotes = 10, maxNotes = 60;

 const calculatedWidths = useMemo(() => {
  if (!settings) return { sidebar: 30, terminal: 50, notes: 20 };
  const sidebarWidth = Math.max(minSidebar, Math.min(maxSidebar, settings.acars.sidebarWidth ?? 30));
  let terminalWidth = settings.acars.terminalWidth ?? 50;
  let notesWidth = settings.acars.notesWidth ?? 20;
  const notesEnabled = settings.acars.notesEnabled;
  if (notesEnabled) {
    notesWidth = Math.max(minNotes, Math.min(maxNotes, notesWidth));
    terminalWidth = 100 - sidebarWidth - notesWidth;
    terminalWidth = Math.max(minTerminal, terminalWidth);
    if (sidebarWidth + terminalWidth + notesWidth > 100) {
      notesWidth = Math.max(minNotes, 100 - sidebarWidth - terminalWidth);
    }
  } else {
    notesWidth = 0;
    terminalWidth = Math.max(minTerminal, 100 - sidebarWidth);
  }
  return { sidebar: sidebarWidth, terminal: terminalWidth, notes: notesWidth };
}, [settings]);

  useEffect(() => {
    if (!isDragging) setPreviewWidths(calculatedWidths);
  }, [calculatedWidths, isDragging]);

  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, [isDragging]);

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

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !settings) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let tempSidebar = previewWidths.sidebar;
    let tempTerminal = previewWidths.terminal;
    let tempNotes = previewWidths.notes;

    if (isDragging === 'sidebar') {
      const mouseSidebar = (x / rect.width) * 100;
      tempSidebar = Math.round(Math.max(minSidebar, Math.min(maxSidebar, mouseSidebar)) / 5) * 5;
      if (settings.acars.notesEnabled) {
        tempNotes = Math.max(minNotes, Math.min(maxNotes, previewWidths.notes));
        tempTerminal = Math.max(minTerminal, 100 - tempSidebar - tempNotes);
        if (tempSidebar + tempTerminal + tempNotes > 100) {
          tempNotes = Math.max(minNotes, 100 - tempSidebar - tempTerminal);
        }
      } else {
        tempNotes = 0;
        tempTerminal = Math.max(minTerminal, 100 - tempSidebar);
      }
    } else if (isDragging === 'terminal' && settings.acars.notesEnabled) {
      const mouseTerminal = (x / rect.width) * 100 - previewWidths.sidebar;
      tempTerminal = Math.round(Math.max(minTerminal, Math.min(maxTerminal, mouseTerminal)) / 5) * 5;
      tempSidebar = previewWidths.sidebar;
      tempNotes = Math.max(minNotes, 100 - tempSidebar - tempTerminal);
      tempTerminal = Math.max(minTerminal, 100 - tempSidebar - tempNotes);
    }
    setPreviewWidths({ sidebar: tempSidebar, terminal: tempTerminal, notes: tempNotes });
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => handleMouseMove(e);
    const onUp = () => { commitWidths(); setIsDragging(null); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [isDragging, previewWidths, settings]);

  if (!settings) return null;

  return (
    <div className={`${S.card} z-1`}>
      <div className={S.header}>
        <div className={S.headerInner}>
          <div className={S.headerClickable} onClick={() => setIsExpanded(!isExpanded)}>
            <div className={`${S.iconBox} ${S.iconBoxMr} bg-cyan-500/20`}>
              <Terminal className={`${S.icon} text-cyan-400`} />
            </div>
            <div className="text-left min-w-0">
              <h3 className={S.title}>ACARS Settings</h3>
              <p className={S.subtitle}>Configure ACARS terminal panels and default layout</p>
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

            {/* Panel Toggles */}
            <div className={S.section}>
              <div className={S.sectionHeader}>
                <div className={`${S.sectionIconBox} bg-blue-500/20`}>
                  <Eye className={`${S.sectionIcon} text-blue-400`} />
                </div>
                <div>
                  <h4 className={S.sectionTitle}>Panel Visibility</h4>
                  <p className={S.sectionSubtitle}>Choose which panels are enabled in the ACARS terminal</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className={S.toggleRow}>
                  <div className="flex items-center gap-3">
                    <StickyNote className="h-5 w-5 text-blue-400" />
                    <div>
                      <p className="text-white font-medium text-sm">Notes Panel</p>
                      <p className="text-zinc-500 text-xs">Flight notes and planning</p>
                    </div>
                  </div>
                  <Toggle
                    checked={settings.acars.notesEnabled}
                    onChange={() => onChange({ ...settings, acars: { ...settings.acars, notesEnabled: !settings.acars.notesEnabled } })}
                    activeColor="bg-blue-600"
                  />
                </div>
                <div className={S.toggleRow}>
                  <div className="flex items-center gap-3">
                    <Terminal className="h-5 w-5 text-green-400" />
                    <div>
                      <p className="text-white font-medium text-sm">Auto Redirect to ACARS</p>
                      <p className="text-zinc-500 text-xs">Automatically open ACARS after submitting flight plan (PFATC sessions only)</p>
                    </div>
                  </div>
                  <Toggle
                    checked={settings.acars.autoRedirectToAcars ?? true}
                    onChange={() => onChange({ ...settings, acars: { ...settings.acars, autoRedirectToAcars: !(settings.acars.autoRedirectToAcars ?? true) } })}
                    activeColor="bg-green-600"
                  />
                </div>
              </div>
            </div>

            {/* Interactive Preview */}
            <div className={S.section}>
              <div className={S.sectionHeader}>
                <div className={`${S.sectionIconBox} bg-cyan-500/20`}>
                  <LayoutDashboard className={`${S.sectionIcon} text-cyan-400`} />
                </div>
                <div>
                  <h4 className={S.sectionTitle}>Preview</h4>
                  <p className={S.sectionSubtitle}>Drag the divider to adjust default panel widths</p>
                </div>
              </div>
              <div
                ref={containerRef}
                className="relative bg-zinc-950 border border-zinc-700 rounded-lg overflow-hidden"
                style={{ height: '200px' }}
              >
                <div className="flex h-full">
                  <div style={{ width: `${previewWidths.sidebar}%` }} className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-r border-gray-700 flex flex-col">
                    <div className="bg-zinc-900/50 px-3 py-2 border-b border-gray-700 flex items-center gap-2">
                      <Eye className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] text-gray-300 font-mono">Sidebar</span>
                    </div>
                    <div className="flex-1 p-2 space-y-1">
                      <div className="h-1 bg-blue-500/20 rounded w-3/4" />
                      <div className="h-1 bg-cyan-500/20 rounded w-full" />
                    </div>
                  </div>
                  <div className="w-1 bg-blue-500 hover:bg-blue-400 cursor-col-resize flex-shrink-0 relative" onMouseDown={() => setIsDragging('sidebar')}>
                    <div className="absolute inset-y-0 -left-1 -right-1" />
                  </div>
                  <div style={{ width: `${previewWidths.terminal}%` }} className="bg-gradient-to-br from-gray-800 to-gray-900 border-r border-gray-700 flex flex-col">
                    <div className="bg-gray-800/50 px-3 py-2 border-b border-gray-700 flex items-center gap-2">
                      <Terminal className="w-3 h-3 text-green-400" />
                      <span className="text-[10px] text-gray-300 font-mono">Terminal</span>
                    </div>
                    <div className="flex-1 p-2 space-y-1">
                      <div className="h-1 bg-green-500/20 rounded w-3/4" />
                      <div className="h-1 bg-cyan-500/20 rounded w-full" />
                    </div>
                  </div>
                  {settings.acars.notesEnabled && (
                    <>
                      <div className="w-1 bg-blue-500 hover:bg-blue-400 cursor-col-resize flex-shrink-0 relative" onMouseDown={() => setIsDragging('terminal')}>
                        <div className="absolute inset-y-0 -left-1 -right-1" />
                      </div>
                      <div style={{ width: `${previewWidths.notes}%` }} className="bg-gradient-to-br from-blue-900 to-blue-950 flex flex-col">
                        <div className="bg-blue-900/50 px-3 py-2 border-b border-gray-700 flex items-center gap-2">
                          <StickyNote className="w-3 h-3 text-blue-400" />
                          <span className="text-[10px] text-gray-300 font-mono">Notes</span>
                        </div>
                        <div className="flex-1 p-2 space-y-1">
                          <div className="h-1 bg-blue-500/30 rounded w-full" />
                          <div className="h-1 bg-blue-500/30 rounded w-5/6" />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-2 text-center">
                Sidebar: {previewWidths.sidebar}% • Terminal: {previewWidths.terminal}%
                {settings.acars.notesEnabled && <> • Notes: {previewWidths.notes}%</>}
              </p>
            </div>
          </div>

          <div className={`${S.infoBanner} bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border-cyan-500/20`}>
            <div className="flex items-start">
              <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-cyan-300 font-medium text-sm mb-1">ACARS Information</h4>
                <p className="text-cyan-200/80 text-xs sm:text-sm leading-relaxed">
                  Panel visibility and width settings apply to the ACARS terminal interface on desktop. The Terminal
                  panel cannot be disabled. Changes take effect the next time you open an ACARS terminal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}