import { Terminal, StickyNote, PanelLeft, type LucideIcon } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import type { Settings } from '../../types/settings';
import SettingsSection from './SettingsSection';
import SettingsGroup from './SettingsGroup';
import SettingsRow from './SettingsRow';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

function PreviewPanel({
  icon: Icon,
  title,
  width,
  className,
}: {
  icon: LucideIcon;
  title: string;
  width: number;
  className?: string;
}) {
  return (
    <div
      style={{ width: `${width}%` }}
      className={cn('flex min-w-0 flex-col overflow-hidden', className)}
    >
      <div className="flex items-center gap-1.5 border-b px-2.5 py-2">
        <Icon className="size-3.5 shrink-0 text-blue-400" />
        <span className="truncate text-xs text-muted-foreground">{title}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div className="h-1.5 w-3/4 rounded-full bg-muted" />
        <div className="h-1.5 w-full rounded-full bg-muted" />
        <div className="h-1.5 w-1/2 rounded-full bg-muted" />
      </div>
    </div>
  );
}

function PreviewDivider({ onMouseDown }: { onMouseDown: () => void }) {
  return (
    <div
      aria-hidden="true"
      onMouseDown={onMouseDown}
      className="relative w-1 shrink-0 cursor-col-resize bg-primary transition-colors hover:bg-blue-400"
    >
      <div className="absolute inset-y-0 -right-1.5 -left-1.5" />
    </div>
  );
}

interface AcarsSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

export default function AcarsSettings({
  settings,
  onChange,
}: AcarsSettingsProps) {
  const [isDragging, setIsDragging] = useState<
    'sidebar' | 'terminal' | 'notes' | null
  >(null);
  const [previewWidths, setPreviewWidths] = useState({
    sidebar: 30,
    terminal: 50,
    notes: 20,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  const minSidebar = 10,
    maxSidebar = 40;
  const minTerminal = 20,
    maxTerminal = 80;
  const minNotes = 10,
    maxNotes = 60;

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
        autoRedirectToAcars: !(settings.acars.autoRedirectToAcars ?? true),
      },
    };
    onChange(updatedSettings);
  };

  useEffect(() => {
    if (!isDragging) {
      setPreviewWidths(calculatedWidths);
    }
  }, [calculatedWidths, isDragging]);

  const handleSidebarWidthChange = (width: number) => {
    if (!settings) return;
    console.log('Saving sidebarWidth', width);
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

      if (settings.acars.notesEnabled) {
        tempNotes = Math.max(minNotes, Math.min(maxNotes, previewWidths.notes));
        tempTerminal = 100 - tempSidebar - tempNotes;
        tempTerminal = Math.max(minTerminal, tempTerminal);
        if (tempSidebar + tempTerminal + tempNotes > 100) {
          tempNotes = 100 - tempSidebar - tempTerminal;
          tempNotes = Math.max(minNotes, tempNotes);
        }
      } else {
        tempNotes = 0;
        tempTerminal = 100 - tempSidebar;
        tempTerminal = Math.max(minTerminal, tempTerminal);
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

  const commitWidths = () => {
    if (!settings) return;
    onChange({
      ...settings,
      acars: {
        ...settings.acars,
        sidebarWidth: previewWidths.sidebar,
        terminalWidth: previewWidths.terminal,
        notesWidth: settings.acars.notesEnabled
          ? previewWidths.notes
          : settings.acars.notesWidth,
      },
    });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      commitWidths();
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

  useEffect(() => {
    console.log(
      'Rendered with settings.sidebarWidth',
      settings?.acars.sidebarWidth
    );
  }, [settings]);

  if (!settings) return null;

  const notesEnabled = settings.acars.notesEnabled;

  return (
    <SettingsSection title="ACARS" icon={Terminal}>
      <SettingsGroup>
        <SettingsRow
          label="Notes panel"
          description="Show the flight notes panel in the ACARS terminal."
          htmlFor="acars-notes-enabled"
        >
          <Switch
            id="acars-notes-enabled"
            checked={notesEnabled}
            onCheckedChange={handleNotesToggle}
          />
        </SettingsRow>
        <SettingsRow
          label="Open ACARS after filing"
          description="Open ACARS after submitting a flight plan. Network sessions only."
          htmlFor="acars-auto-redirect"
        >
          <Switch
            id="acars-auto-redirect"
            checked={settings.acars.autoRedirectToAcars ?? true}
            onCheckedChange={handleAutoRedirectToggle}
          />
        </SettingsRow>
        <SettingsRow
          label="Default panel widths"
          description="Drag the dividers to resize. Applies on desktop the next time you open ACARS."
          stacked
        >
          <div className="flex w-full min-w-0 flex-col gap-2">
            <div
              ref={containerRef}
              className="flex h-44 w-full overflow-hidden rounded-xl border bg-background"
            >
              <PreviewPanel
                icon={PanelLeft}
                title="Sidebar"
                width={previewWidths.sidebar}
                className="bg-card"
              />
              <PreviewDivider onMouseDown={() => handleMouseDown('sidebar')} />
              <PreviewPanel
                icon={Terminal}
                title="Terminal"
                width={previewWidths.terminal}
              />
              {notesEnabled ? (
                <>
                  <PreviewDivider
                    onMouseDown={() => handleMouseDown('terminal')}
                  />
                  <PreviewPanel
                    icon={StickyNote}
                    title="Notes"
                    width={previewWidths.notes}
                    className="bg-card"
                  />
                </>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              Sidebar {previewWidths.sidebar}%, Terminal{' '}
              {previewWidths.terminal}%
              {notesEnabled ? `, Notes ${previewWidths.notes}%` : null}
            </p>
          </div>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>
  );
}
