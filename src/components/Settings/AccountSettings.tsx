import { useState } from 'react';
import { useAuth } from '../../hooks/auth/useAuth';
import {
  Link2,
  ExternalLink,
  UserX,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Shield,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { SiRoblox } from 'react-icons/si';
import { updateTutorialStatus } from '../../utils/fetch/auth';
import Button from '../common/Button';
import { useNavigate } from 'react-router-dom';
import type { Settings } from '../../types/settings';
import PrivacySettings from './PrivacySettings';
import ConfirmationDialog from '../common/ConfirmationDialog';

interface AccountSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

export default function AccountSettings({
  settings,
  onChange,
}: AccountSettingsProps) {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState(false);
  const [showVatsimConfirm, setShowVatsimConfirm] = useState(false);
  const [showRobloxConfirm, setShowRobloxConfirm] = useState(false);
  const isVatsimLinked = !!(
    user?.vatsimCid ||
    user?.vatsimRatingShort ||
    user?.vatsimRatingLong
  );

  const handleLinkRoblox = () => {
    window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/roblox`;
  };

  const handleLinkVatsim = () => {
    window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/vatsim?force=1`;
  };

  const handleUnlinkVatsim = async () => {
    setShowVatsimConfirm(false);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/auth/vatsim/unlink`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      if (res.ok) {
        await refreshUser();
      } else {
        alert('Failed to unlink VATSIM account');
      }
    } catch (e) {
      console.error('Unlink VATSIM error:', e);
      alert('Failed to unlink VATSIM account');
    }
  };

  const handleUnlinkRoblox = async () => {
    setShowRobloxConfirm(false);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/auth/roblox/unlink`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (res.ok) {
        await refreshUser();
      } else {
        alert('Failed to unlink Roblox account');
      }
    } catch (error) {
      console.error('Error unlinking Roblox:', error);
      alert('Failed to unlink Roblox account');
    }
  };

  const handleRestartTutorial = async () => {
    try {
      const success = await updateTutorialStatus(false);
      if (success) {
        await refreshUser();
        navigate('/?tutorial=true');
      } else {
        console.error('Failed to reset tutorial.');
      }
    } catch (error) {
      console.error('Error resetting tutorial:', error);
    }
  };

  const handleBioChange = (bio: string) => {
    if (!settings) return;
    const updatedSettings = {
      ...settings,
      bio,
    };
    onChange(updatedSettings);
  };

  return (
    <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl border-2 border-zinc-800 p-4 sm:p-6 z-1">
      <div className="flex items-center mb-4 sm:mb-6">
        <div className="p-2 bg-blue-500/20 rounded-lg mr-3 flex-shrink-0">
          <Link2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg md:text-xl font-semibold text-white truncate">
            Account Settings
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Manage your account preferences and connections
          </p>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* Settings Section */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center">
            <h3 className="text-base sm:text-lg font-semibold text-white">
              Settings
            </h3>
          </div>
          {/* Restart Tutorial */}
          <div className="bg-zinc-800/50 rounded-lg sm:rounded-xl border-2 border-zinc-700/50 p-3 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                  <RotateCcw className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-white font-semibold text-sm sm:text-base truncate">
                    Restart Tutorial
                  </h4>
                  <p className="text-zinc-400 text-xs sm:text-sm mt-0.5 sm:mt-1 line-clamp-2">
                    Restart the guided tutorial to learn PFControl features
                    again.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleRestartTutorial}
                variant="outline"
                size="sm"
                className="border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/20 hover:border-yellow-600 text-xs whitespace-nowrap flex-shrink-0"
              >
                <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Restart</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Bio Section */}
        <div className="bg-zinc-800/50 rounded-lg sm:rounded-xl border-2 border-zinc-700/50 p-3 sm:p-5">
          <div className="flex items-center space-x-3 sm:space-x-4 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-white font-semibold text-sm sm:text-base truncate">
                Biography
              </h4>
              <p className="text-zinc-400 text-xs sm:text-sm mt-0.5 sm:mt-1 line-clamp-2">
                Add a personal description to your profile (max 500 characters).
              </p>
            </div>
          </div>
          <textarea
            value={settings?.bio ?? ''}
            onChange={(e) => handleBioChange(e.target.value)}
            placeholder="Tell others about yourself, your aviation interests, or anything you'd like to share..."
            maxLength={500}
            rows={6}
            className="w-full px-3 py-2 sm:px-4 sm:py-3 bg-zinc-900/50 border-2 border-zinc-700 rounded-lg text-white placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-zinc-500 line-clamp-1">
              Your biography is always visible to others on your profile
            </p>
            <p className="text-xs text-zinc-400 flex-shrink-0">
              {(settings?.bio ?? '').length}/500
            </p>
          </div>
        </div>

        {/* Privacy Settings Section - Collapsible */}
        <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="w-full p-3 sm:p-4 md:p-6 border-b border-zinc-700/50">
            <div className="flex items-center justify-between gap-3">
              <div
                className="flex items-center flex-1 min-w-0 cursor-pointer"
                onClick={() => setIsPrivacyExpanded(!isPrivacyExpanded)}
              >
                <div className="p-2 bg-purple-500/20 rounded-lg mr-3 flex-shrink-0">
                  <Shield className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-purple-400" />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold text-white truncate">
                    Privacy Settings
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm mt-0.5 md:mt-1 line-clamp-1 sm:line-clamp-none">
                    Control what information is displayed on your profile
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setIsPrivacyExpanded(!isPrivacyExpanded)}
                variant="outline"
                size="sm"
                className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 p-2 flex-shrink-0"
              >
                {isPrivacyExpanded ? (
                  <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" />
                ) : (
                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Expandable Content */}
          <div
            className={`transition-all duration-300 ease-in-out ${
              isPrivacyExpanded
                ? 'max-h-[1000px] opacity-100'
                : 'max-h-0 opacity-0 overflow-hidden'
            }`}
          >
            <div className="p-3 sm:p-4 md:p-6">
              <PrivacySettings settings={settings} onChange={onChange} />
            </div>
          </div>
        </div>

        {/* Account Connections Section */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center">
            <h3 className="text-base sm:text-lg font-semibold text-white">
              Account Connections
            </h3>
          </div>
          <div className="space-y-3 sm:space-y-4">
            {/* Roblox Account */}
            <div className="bg-zinc-800/50 rounded-lg sm:rounded-xl border-2 border-zinc-700/50 p-3 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                    <SiRoblox className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-white font-semibold text-sm sm:text-base truncate">
                      Roblox Account
                    </h4>
                    {user?.robloxUsername ? (
                      <div className="flex items-center space-x-1 sm:space-x-2 mt-0.5 sm:mt-1">
                        <span className="text-green-400 text-xs sm:text-sm font-medium">
                          Connected
                        </span>
                        <span className="text-zinc-500 hidden sm:inline">
                          •
                        </span>
                        <span className="text-zinc-300 text-xs sm:text-sm truncate">
                          @{user.robloxUsername}
                        </span>
                      </div>
                    ) : (
                      <p className="text-zinc-400 text-xs sm:text-sm mt-0.5 sm:mt-1 line-clamp-1">
                        Link your Roblox account
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {user?.robloxUsername ? (
                    <Button
                      onClick={() => setShowRobloxConfirm(true)}
                      variant="outline"
                      size="sm"
                      className="border-red-700/50 text-red-400 hover:bg-red-900/20 hover:border-red-600 text-xs whitespace-nowrap"
                    >
                      <UserX className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Unlink</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={handleLinkRoblox}
                      variant="primary"
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 border-blue-600 text-xs whitespace-nowrap"
                    >
                      <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Link Account</span>
                      <span className="sm:hidden">Link</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* VATSIM Account */}
            <div className="bg-zinc-800/50 rounded-lg sm:rounded-xl border-2 border-zinc-700/50 p-3 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                    <img
                      src="/assets/images/vatsim.webp"
                      alt="VATSIM"
                      className="w-6 h-6 sm:w-8 sm:h-8"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-white font-semibold text-sm sm:text-base truncate">
                      VATSIM Account
                    </h4>
                    {isVatsimLinked ? (
                      <div className="flex items-center space-x-1 sm:space-x-2 mt-0.5 sm:mt-1">
                        <span className="text-green-400 text-xs sm:text-sm font-medium">
                          Connected
                        </span>
                        <span className="text-zinc-500 hidden sm:inline">
                          •
                        </span>
                        <span className="text-zinc-300 text-xs sm:text-sm truncate">
                          {user?.vatsimCid}
                        </span>
                      </div>
                    ) : (
                      <p className="text-zinc-400 text-xs sm:text-sm mt-0.5 sm:mt-1 line-clamp-2">
                        Link your VATSIM account to show controller rating on
                        your profile
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {isVatsimLinked ? (
                    <Button
                      onClick={() => setShowVatsimConfirm(true)}
                      variant="outline"
                      size="sm"
                      className="border-red-700/50 text-red-400 hover:bg-red-900/20 hover:border-red-600 text-xs whitespace-nowrap"
                    >
                      <UserX className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Unlink</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={handleLinkVatsim}
                      variant="primary"
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-xs whitespace-nowrap"
                    >
                      <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Link Account</span>
                      <span className="sm:hidden">Link</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={showVatsimConfirm}
        onConfirm={handleUnlinkVatsim}
        onCancel={() => setShowVatsimConfirm(false)}
        title="Unlink VATSIM Account"
        description="Are you sure you want to unlink your VATSIM account? Your controller rating will no longer be displayed on your profile."
        confirmText="Unlink"
        cancelText="Cancel"
        variant="danger"
        icon={<AlertTriangle size={24} />}
      />

      <ConfirmationDialog
        isOpen={showRobloxConfirm}
        onConfirm={handleUnlinkRoblox}
        onCancel={() => setShowRobloxConfirm(false)}
        title="Unlink Roblox Account"
        description="Are you sure you want to unlink your Roblox account? You will need to link it again to use Roblox-related features."
        confirmText="Unlink"
        cancelText="Cancel"
        variant="danger"
        icon={<AlertTriangle size={24} />}
      />
    </div>
  );
}
