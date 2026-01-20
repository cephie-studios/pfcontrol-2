import { User, Link2, Shield, Image, Star } from 'lucide-react';
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

  const handleDisplayControllerRatingToggle = (enabled: boolean) => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      displayControllerRatingOnProfile: enabled,
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
    <div className="space-y-3 sm:space-y-4">
      {/* Statistics */}
      <div
        className={`bg-zinc-800/50 rounded-lg sm:rounded-xl border-2 border-zinc-700/50 p-3 sm:p-5 ${settings?.displayStatsOnProfile ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : 'bg-gradient-to-r from-green-600/5 to-transparent'}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${settings?.displayStatsOnProfile ? 'bg-gradient-to-br from-yellow-500 to-yellow-500' : 'bg-gradient-to-br from-green-600 to-green-600'}`}
            >
              <User className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-white font-semibold text-sm sm:text-base truncate">
                Display Statistics on Profile
              </h4>
              <p className="text-zinc-400 text-xs sm:text-sm mt-0.5 sm:mt-1 line-clamp-2">
                Show your statistics (e.g., sessions created, time controlling,
                total flights) on your profile page.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={settings?.displayStatsOnProfile ?? true}
              onChange={(e) => handleDisplayStatsToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 sm:w-11 sm:h-6 bg-red-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
      </div>

      {/* Controller Rating */}
      <div
        className={`bg-zinc-800/50 rounded-lg sm:rounded-xl border-2 border-zinc-700/50 p-3 sm:p-5 ${settings?.displayControllerRatingOnProfile ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : 'bg-gradient-to-r from-green-600/5 to-transparent'}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${settings?.displayControllerRatingOnProfile ? 'bg-gradient-to-br from-yellow-500 to-yellow-500' : 'bg-gradient-to-br from-green-600 to-green-600'}`}
            >
              <Star className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-white font-semibold text-sm sm:text-base truncate">
                Display Controller Rating on Profile
              </h4>
              <p className="text-zinc-400 text-xs sm:text-sm mt-0.5 sm:mt-1 line-clamp-2">
                Show your average controller rating and total ratings on your
                profile page.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={settings?.displayControllerRatingOnProfile ?? true}
              onChange={(e) =>
                handleDisplayControllerRatingToggle(e.target.checked)
              }
              className="sr-only peer"
            />
            <div className="w-9 h-5 sm:w-11 sm:h-6 bg-red-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
      </div>

      {/* Linked Accounts */}
      <div
        className={`bg-zinc-800/50 rounded-lg sm:rounded-xl border-2 border-zinc-700/50 p-3 sm:p-5 ${settings?.displayLinkedAccountsOnProfile ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : 'bg-gradient-to-r from-green-600/5 to-transparent'}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${settings?.displayLinkedAccountsOnProfile ? 'bg-gradient-to-br from-yellow-500 to-yellow-500' : 'bg-gradient-to-br from-green-600 to-green-600'}`}
            >
              <Link2 className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-white font-semibold text-sm sm:text-base truncate">
                Display Linked Accounts on Profile
              </h4>
              <p className="text-zinc-400 text-xs sm:text-sm mt-0.5 sm:mt-1 line-clamp-2">
                Show your linked accounts (e.g., Roblox, VATSIM) on your profile
                page.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={settings?.displayLinkedAccountsOnProfile ?? true}
              onChange={(e) =>
                handleDisplayLinkedAccountsToggle(e.target.checked)
              }
              className="sr-only peer"
            />
            <div className="w-9 h-5 sm:w-11 sm:h-6 bg-red-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
      </div>

      {/* Background Image */}
      <div
        className={`bg-zinc-800/50 rounded-lg sm:rounded-xl border-2 border-zinc-700/50 p-3 sm:p-5 ${settings?.displayBackgroundOnProfile ? 'bg-gradient-to-r from-yellow-500/5 to-transparent' : 'bg-gradient-to-r from-green-600/5 to-transparent'}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${settings?.displayBackgroundOnProfile ? 'bg-gradient-to-br from-yellow-500 to-yellow-500' : 'bg-gradient-to-br from-green-600 to-green-600'}`}
            >
              <Image className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-white font-semibold text-sm sm:text-base truncate">
                Display Background Image on Profile
              </h4>
              <p className="text-zinc-400 text-xs sm:text-sm mt-0.5 sm:mt-1 line-clamp-2">
                Show your selected background image in your profile header.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={settings?.displayBackgroundOnProfile ?? true}
              onChange={(e) => handleDisplayBackgroundToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 sm:w-11 sm:h-6 bg-red-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
      </div>

      {/* Hide from Leaderboard */}
      <div
        className={`bg-zinc-800/50 rounded-lg sm:rounded-xl border-2 border-zinc-700/50 p-3 sm:p-5 ${settings?.hideFromLeaderboard ? 'bg-gradient-to-r from-green-600/5 to-transparent' : 'bg-gradient-to-r from-yellow-500/5 to-transparent'}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${settings?.hideFromLeaderboard ? 'bg-gradient-to-br from-green-600 to-green-600' : 'bg-gradient-to-br from-yellow-500 to-yellow-500'}`}
            >
              <Shield className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-white font-semibold text-sm sm:text-base truncate">
                Hide from Leaderboard
              </h4>
              <p className="text-zinc-400 text-xs sm:text-sm mt-0.5 sm:mt-1 line-clamp-2">
                Opt out of appearing in the homepage leaderboard rankings.
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox"
              checked={settings?.hideFromLeaderboard ?? false}
              onChange={(e) =>
                handleHideFromLeaderboardToggle(e.target.checked)
              }
              className="sr-only peer"
            />
            <div className="w-9 h-5 sm:w-11 sm:h-6 bg-red-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
