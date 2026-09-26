import { useId } from 'react';
import { Trophy } from 'lucide-react';
import type { Settings } from '../../types/settings';
import { Switch } from '@/components/ui/switch';
import SettingsGroup from './SettingsGroup';
import SettingsRow from './SettingsRow';

interface PrivacySettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

export default function PrivacySettings({
  settings,
  onChange,
}: PrivacySettingsProps) {
  const hideFromLeaderboardId = useId();

  const handleHideFromLeaderboardToggle = (enabled: boolean) => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      hideFromLeaderboard: enabled,
    };
    onChange(updatedSettings);
  };

  return (
    <SettingsGroup title="Privacy">
      <SettingsRow
        icon={<Trophy className="text-amber-400" />}
        label="Hide from leaderboard"
        description="Opt out of the homepage leaderboard rankings."
        htmlFor={hideFromLeaderboardId}
      >
        <Switch
          id={hideFromLeaderboardId}
          checked={settings?.hideFromLeaderboard ?? false}
          onCheckedChange={handleHideFromLeaderboardToggle}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}
