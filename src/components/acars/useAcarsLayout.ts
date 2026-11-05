import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/auth/useAuth';
import { useSettings } from '../../hooks/settings/useSettings';
import type { AcarsSettings } from '../../types/settings';
import { resolveAcarsLayout } from '../../utils/acarsLayout';

type LayoutPatch = Partial<
  Pick<
    AcarsSettings,
    'notesEnabled' | 'sidebarWidth' | 'terminalWidth' | 'notesWidth'
  >
>;

const GUEST_KEY = 'acarsLayout';

function readGuestLayout(): LayoutPatch {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) || '{}');
  } catch {
    return {};
  }
}

export function useAcarsLayout() {
  const { user } = useAuth();
  const { settings, updateSettings } = useSettings();
  const [local, setLocal] = useState<LayoutPatch>(() =>
    user ? {} : readGuestLayout()
  );

  const acars = { ...settings?.acars, ...local };

  const save = (patch: LayoutPatch) => {
    const next = { ...local, ...patch };
    setLocal(next);
    if (user && settings) {
      updateSettings({
        ...settings,
        acars: { ...settings.acars, ...next },
      }).catch(() => toast.error('Could not save your ACARS layout'));
      return;
    }
    try {
      localStorage.setItem(GUEST_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable; the layout still applies until the page closes
    }
  };

  return {
    layout: resolveAcarsLayout(acars),
    notesEnabled: acars.notesEnabled ?? true,
    notesWidth: acars.notesWidth,
    save,
  };
}
