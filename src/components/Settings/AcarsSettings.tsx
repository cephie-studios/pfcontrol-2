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
  const [isDragging, setIsDragging] = useState<
    'sidebar' | 'terminal' | 'notes' | null
  >(null);
  const [previewWidths, setPreviewWidths] = useState({
    sidebar: 15,
    terminal: 70,
    notes: 15,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  const minSidebar = 10, //side bar size bar is diasbled
    maxSidebar = 40;
  const minTerminal = 20,
    maxTerminal = 80;
  const minNotes = 10,
    maxNotes = 60;

  const calculatedWidths = useMemo(() => {
    if (!settings) return { sidebar: 15, terminal: 70, notes: 15 };

    let sidebarWidth = settings.acars.sidebarWidth ?? 15;
    let terminalWidth = settings.acars.terminalWidth ?? 70;
    let notesWidth = settings.acars.notesWidth ?? 15;
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

    return {
      sidebar: sidebarWidth,
      terminal: terminalWidth,
      notes: notesWidth,
    };
  }, [settings]);

  useEffect(() => {
    setPreviewWidths(calculatedWidths);
  }, [calculatedWidths]);

  const handleNotesToggle = () => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      acars: {
        ...settings.acars,
        notesEnabled: !settings.acars.notesEnabled,
      },
    };
    onChange(updatedSettings);
  };

  const handleAutoRedirectToggle = () => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      acars: {
        ...settings.acars,
        autoRedirectToAcars: !settings.acars.autoRedirectToAcars,
      },
    };
    onChange(updatedSettings);
  };

  const handleSidebarWidthChange = (width: number) => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      acars: {
        ...settings.acars,
        sidebarWidth: width,
      },
    };
    onChange(updatedSettings);
  };

  const handleTerminalWidthChange = (width: number) => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      acars: {
        ...settings.acars,
        terminalWidth: width,
      },
    };
    onChange(updatedSettings);
  };

  const handleNotesWidthChange = (width: number) => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      acars: {
        ...settings.acars,
        notesWidth: width,
      },
    };
    onChange(updatedSettings);
  };

  const handleMouseDown = (divider: 'sidebar' | 'terminal' | 'notes') => {
    setIsDragging(divider);
  };

  const handleMouseMove = (
    e: MouseEvent | React.MouseEvent<HTMLDivElement>
  ) => {
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
      tempSidebar =
        Math.round(
          Math.max(minSidebar, Math.min(maxSidebar, mouseSidebar)) / 5
        ) * 5;
      tempNotes = Math.max(minNotes, Math.min(maxNotes, previewWidths.notes));
      tempTerminal = 100 - tempSidebar - tempNotes;
      tempTerminal = Math.max(minTerminal, tempTerminal);
      if (tempSidebar + tempTerminal + tempNotes > 100) {
        tempNotes = 100 - tempSidebar - tempTerminal;
        tempNotes = Math.max(minNotes, tempNotes);
      }
    } else if (isDragging === 'terminal' && settings.acars.notesEnabled) {
      const sidebar = previewWidths.sidebar;
      const mouseTerminal = (x / rect.width) * 100 - sidebar;
      tempTerminal =
        Math.round(
          Math.max(minTerminal, Math.min(maxTerminal, mouseTerminal)) / 5
        ) * 5;
      tempSidebar = previewWidths.sidebar;
      tempNotes = 100 - tempSidebar - tempTerminal;
      tempNotes = Math.max(minNotes, tempNotes);
      tempTerminal = 100 - tempSidebar - tempNotes;
      tempTerminal = Math.max(minTerminal, tempTerminal);
    }

    setPreviewWidths({
      sidebar: tempSidebar,
      terminal: tempTerminal,
      notes: tempNotes,
    });
  };

  const handleMouseUp = () => {
    if (isDragging && settings) {
      handleSidebarWidthChange(previewWidths.sidebar);
      handleTerminalWidthChange(previewWidths.terminal);
      handleNotesWidthChange(previewWidths.notes);
    }
    setIsDragging(null);
  };

  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, [isDragging]);

  // Global mouse event listeners for dragging outside the container
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      handleMouseMove(e);
    };

    const handleGlobalMouseUp = () => {
      handleMouseUp();
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, previewWidths, settings]);

  if (!settings) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl overflow-hidden z-1">
      {/* Header */}
      <div className="w-full p-4 sm:p-6 border-b border-zinc-700/50">
        <div className="flex items-center justify-between gap-3">
          <div
            className="flex items-center flex-1 min-w-0 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="p-2 bg-cyan-500/20 rounded-lg mr-3 sm:mr-4 flex-shrink-0">
              <Terminal className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-400" />
            </div>
            <div className="text-left min-w-0">
              <h3 className="text-lg sm:text-xl font-semibold text-white">
                ACARS Settings
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm mt-1 hidden sm:block">
                Configure ACARS terminal panels and default layout
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
            {/* Panel Toggles */}
            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-5">
              <div className="flex items-start mb-4">
                <div className="p-2 bg-blue-500/20 rounded-lg mr-4 mt-0.5">
                  <Eye className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">
                    Panel Visibility
                  </h4>
                  <p className="text-zinc-400 text-sm">
                    Choose which panels are enabled in the ACARS terminal
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                {/* Notes Toggle */}
                <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-700/30">
                  <div className="flex items-center">
                    <StickyNote className="h-5 w-5 text-blue-400 mr-3" />
                    <div>
                      <p className="text-white font-medium text-sm">
                        Notes Panel
                      </p>
                      <p className="text-zinc-500 text-xs">
                        Flight notes and planning
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleNotesToggle}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.acars.notesEnabled
                        ? 'bg-blue-600'
                        : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.acars.notesEnabled
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Auto Redirect to ACARS Toggle */}
                <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-700/30">
                  <div className="flex items-center">
                    <Terminal className="h-5 w-5 text-green-400 mr-3" />
                    <div>
                      <p className="text-white font-medium text-sm">
                        Auto Redirect to ACARS
                      </p>
                      <p className="text-zinc-500 text-xs">
                        Automatically open ACARS after submitting flight plan
                        (PFATC sessions only)
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleAutoRedirectToggle}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      (settings.acars.autoRedirectToAcars ?? true)
                        ? 'bg-green-600'
                        : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        (settings.acars.autoRedirectToAcars ?? true)
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Visual Preview */}
            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-5">
              <div className="flex items-start mb-4">
                <div className="p-2 bg-cyan-500/20 rounded-lg mr-4 mt-0.5">
                  <LayoutDashboard className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">Preview</h4>
                  <p className="text-zinc-400 text-sm">
                    Drag the divider to adjust default panel widths
                  </p>
                </div>
              </div>

              <div
                ref={containerRef}
                className="relative bg-zinc-950 border border-zinc-700 rounded-lg overflow-hidden"
                style={{ height: '200px' }}
              >
                <div className="flex h-full">
                  {/* Sidebar */}
                  <div
                    style={{ width: `${previewWidths.sidebar}%` }}
                    className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-r border-gray-700 flex flex-col"
                  >
                    <div className="bg-zinc-900/50 px-3 py-2 border-b border-gray-700 flex items-center gap-2">
                      <Eye className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] text-gray-300 font-mono">
                        Sidebar
                      </span>
                    </div>
                    <div className="flex-1 p-2 space-y-1">
                      <div className="h-1 bg-blue-500/20 rounded w-3/4"></div>
                      <div className="h-1 bg-cyan-500/20 rounded w-full"></div>
                    </div>
                  </div>
                  {/* Terminal */}
                  <div
                    style={{ width: `${previewWidths.terminal}%` }}
                    className="bg-gradient-to-br from-gray-800 to-gray-900 border-r border-gray-700 flex flex-col"
                  >
                    <div className="bg-gray-800/50 px-3 py-2 border-b border-gray-700 flex items-center gap-2">
                      <Terminal className="w-3 h-3 text-green-400" />
                      <span className="text-[10px] text-gray-300 font-mono">
                        Terminal
                      </span>
                    </div>
                    <div className="flex-1 p-2 space-y-1">
                      <div className="h-1 bg-green-500/20 rounded w-3/4"></div>
                      <div className="h-1 bg-cyan-500/20 rounded w-full"></div>
                    </div>
                  </div>
                  {/* Terminal Divider */}
                  {settings.acars.notesEnabled && (
                    <div
                      className="w-1 bg-blue-500 hover:bg-blue-400 cursor-col-resize flex-shrink-0 relative group"
                      onMouseDown={() => handleMouseDown('terminal')}
                    >
                      <div className="absolute inset-y-0 -left-1 -right-1" />
                    </div>
                  )}
                  {/* Notes */}
                  {settings.acars.notesEnabled && (
                    <div
                      style={{ width: `${previewWidths.notes}%` }}
                      className="bg-gradient-to-br from-blue-900 to-blue-950 flex flex-col"
                    >
                      <div className="bg-blue-900/50 px-3 py-2 border-b border-gray-700 flex items-center gap-2">
                        <StickyNote className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px] text-gray-300 font-mono">
                          Notes
                        </span>
                      </div>
                      <div className="flex-1 p-2 space-y-1">
                        <div className="h-1 bg-blue-500/30 rounded w-full"></div>
                        <div className="h-1 bg-blue-500/30 rounded w-5/6"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-2 text-center">
                Sidebar: {previewWidths.sidebar}% • Terminal:{' '}
                {previewWidths.terminal}%
                {settings.acars.notesEnabled ? (
                  <> • Notes: {previewWidths.notes}%</>
                ) : null}
              </p>
            </div>
          </div>

          {/* Info Section */}
          <div className="mt-6 p-4 bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-500/20 rounded-lg">
            <div className="flex items-start">
              <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
              <div>
                <h4 className="text-cyan-300 font-medium text-sm mb-1">
                  ACARS Information
                </h4>
                <p className="text-cyan-200/80 text-xs sm:text-sm leading-relaxed">
                  Panel visibility and width settings apply to the ACARS
                  terminal interface on desktop. The Terminal panel cannot be
                  disabled. Changes take effect the next time you open an ACARS
                  terminal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
