import { User, Link2, Shield, Image, Star } from 'lucide-react';
import type { Settings } from '../../types/settings';
import Toggle from './Toggle';
import { S } from './settingsTokens';

interface PrivacySettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

interface PrivacyRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function PrivacyRow({ icon, title, description, checked, onChange }: PrivacyRowProps) {
  return (
    <div className={S.toggleRow}>
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <div className="p-2 bg-zinc-700/50 rounded-lg flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-white font-medium text-sm truncate">{title}</h4>
          <p className="text-zinc-400 text-xs mt-0.5 line-clamp-2">{description}</p>
        </div>
      </div>
      <div className="ml-4 flex-shrink-0">
        <Toggle checked={checked} onChange={onChange} activeColor="bg-green-600" />
      </div>
    </div>
  );
}

export default function PrivacySettings({ settings, onChange }: PrivacySettingsProps) {
  if (!settings) return null;

  return (
    <div className="space-y-3">
      <PrivacyRow
        icon={<User className="w-5 h-5 text-zinc-300" />}
        title="Display Statistics on Profile"
        description="Show your statistics (e.g., sessions created, time controlling, total flights) on your profile page."
        checked={settings.displayStatsOnProfile ?? true}
        onChange={(checked) => onChange({ ...settings, displayStatsOnProfile: checked })}
      />
      <PrivacyRow
        icon={<Star className="w-5 h-5 text-zinc-300" />}
        title="Display Controller Rating on Profile"
        description="Show your average controller rating and total ratings on your profile page."
        checked={settings.displayControllerRatingOnProfile ?? true}
        onChange={(checked) => onChange({ ...settings, displayControllerRatingOnProfile: checked })}
      />
      <PrivacyRow
        icon={<Link2 className="w-5 h-5 text-zinc-300" />}
        title="Display Linked Accounts on Profile"
        description="Show your linked accounts (e.g., Roblox, VATSIM) on your profile page."
        checked={settings.displayLinkedAccountsOnProfile ?? true}
        onChange={(checked) => onChange({ ...settings, displayLinkedAccountsOnProfile: checked })}
      />
      <PrivacyRow
        icon={<Image className="w-5 h-5 text-zinc-300" />}
        title="Display Background Image on Profile"
        description="Show your selected background image in your profile header."
        checked={settings.displayBackgroundOnProfile ?? true}
        onChange={(checked) => onChange({ ...settings, displayBackgroundOnProfile: checked })}
      />
      <PrivacyRow
        icon={<Shield className="w-5 h-5 text-zinc-300" />}
        title="Hide from Leaderboard"
        description="Opt out of appearing in the homepage leaderboard rankings."
        checked={settings.hideFromLeaderboard ?? false}
        onChange={(checked) => onChange({ ...settings, hideFromLeaderboard: checked })}
      />
    </div>
  );
}