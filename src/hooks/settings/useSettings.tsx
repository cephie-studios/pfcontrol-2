import { useContext, createContext } from 'react';
import type { Settings } from '../../types/settings';

export interface SettingsContextType {
  settings: Settings | null;
  updateSettings: (newSettings: Settings) => Promise<void>;
  loading: boolean;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
