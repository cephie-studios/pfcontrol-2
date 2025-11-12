import { User, Link2, Shield, Image } from 'lucide-react';
import type { Settings } from '../../types/settings';

interface PrivacySettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

export default function PrivacySettings({
  settings,
  onChange,
}: PrivacySettingsProps) {
  const handleDisplayStatsToggle = (enabled: boolean) => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      displayStatsOnProfile: enabled,
    };
    onChange(updatedSettings);
  };

  const handleDisplayLinkedAccountsToggle = (enabled: boolean) => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      displayLinkedAccountsOnProfile: enabled,
    };
    onChange(updatedSettings);
  };

  const handleHideFromLeaderboardToggle = (enabled: boolean) => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      hideFromLeaderboard: enabled,
    };
    onChange(updatedSettings);
  };

  const handleDisplayBackgroundToggle = (enabled: boolean) => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      displayBackgroundOnProfile: enabled,
    };
    onChange(updatedSettings);
  };

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div
        className={`bg-zinc-800/50 rounded-xl border-2 border-zinc-700/50 p-5 flex items-center justify-between ${settings?.displayStatsOnProfile ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : 'bg-gradient-to-r from-green-600/5 to-transparent'}`}
      >
        <div className="flex items-center space-x-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${settings?.displayStatsOnProfile ? 'bg-gradient-to-br from-yellow-500 to-yellow-500' : 'bg-gradient-to-br from-green-600 to-green-600'}`}
          >
            <User className="w-7 h-7 text-white" />
          </div>
          <div>
            <h4 className="text-white font-semibold text-base">
              Display Statistics on Profile
            </h4>
            <p className="text-zinc-400 text-sm mt-1">
              Show your statistics (e.g., sessions created, time controlling,
              total flights) on your profile page.
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings?.displayStatsOnProfile ?? true}
            onChange={(e) => handleDisplayStatsToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-red-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
        </label>
      </div>

      {/* Linked Accounts */}
      <div
        className={`bg-zinc-800/50 rounded-xl border-2 border-zinc-700/50 p-5 flex items-center justify-between ${settings?.displayLinkedAccountsOnProfile ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : 'bg-gradient-to-r from-green-600/5 to-transparent'}`}
      >
        <div className="flex items-center space-x-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${settings?.displayLinkedAccountsOnProfile ? 'bg-gradient-to-br from-yellow-500 to-yellow-500' : 'bg-gradient-to-br from-green-600 to-green-600'}`}
          >
            <Link2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h4 className="text-white font-semibold text-base">
              Display Linked Accounts on Profile
            </h4>
            <p className="text-zinc-400 text-sm mt-1">
              Show your linked accounts (e.g., Roblox, VATSIM) on your profile
              page.
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings?.displayLinkedAccountsOnProfile ?? true}
            onChange={(e) =>
              handleDisplayLinkedAccountsToggle(e.target.checked)
            }
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-red-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
        </label>
      </div>

      {/* Background Image */}
      <div
        className={`bg-zinc-800/50 rounded-xl border-2 border-zinc-700/50 p-5 flex items-center justify-between ${settings?.displayBackgroundOnProfile ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : 'bg-gradient-to-r from-green-600/5 to-transparent'}`}
      >
        <div className="flex items-center space-x-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${settings?.displayBackgroundOnProfile ? 'bg-gradient-to-br from-yellow-500 to-yellow-500' : 'bg-gradient-to-br from-green-600 to-green-600'}`}
          >
            <Image className="w-7 h-7 text-white" />
          </div>
          <div>
            <h4 className="text-white font-semibold text-base">
              Display Background Image on Profile
            </h4>
            <p className="text-zinc-400 text-sm mt-1">
              Show your selected background image in your profile header.
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings?.displayBackgroundOnProfile ?? true}
            onChange={(e) => handleDisplayBackgroundToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-red-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
        </label>
      </div>

      {/* Hide from Leaderboard */}
      <div
        className={`bg-zinc-800/50 rounded-xl border-2 border-zinc-700/50 p-5 flex items-center justify-between ${settings?.hideFromLeaderboard ? 'bg-gradient-to-r from-green-600/5 to-transparent' : 'bg-gradient-to-r from-yellow-500/5 to-transparent'}`}
      >
        <div className="flex items-center space-x-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${settings?.hideFromLeaderboard ? 'bg-gradient-to-br from-green-600 to-green-600' : 'bg-gradient-to-br from-yellow-500 to-yellow-500'}`}
          >
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h4 className="text-white font-semibold text-base">
              Hide from Leaderboard
            </h4>
            <p className="text-zinc-400 text-sm mt-1">
              Opt out of appearing in the homepage leaderboard rankings.
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings?.hideFromLeaderboard ?? false}
            onChange={(e) => handleHideFromLeaderboardToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-red-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
        </label>
      </div>
    </div>
  );
}
