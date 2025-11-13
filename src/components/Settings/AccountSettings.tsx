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
    <div className="bg-zinc-800/50 backdrop-blur-sm rounded-2xl border-2 border-zinc-800 p-6 z-1">
      <div className="flex items-center mb-6">
        <div className="p-2 bg-blue-500/20 rounded-lg mr-3">
          <Link2 className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-white">
            Account Settings
          </h3>
          <p className="text-sm text-zinc-400">
            Manage your account preferences and connections
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Settings Section */}
        <div className="space-y-4">
          <div className="flex items-center">
            <h3 className="text-lg font-semibold text-white">Settings</h3>
          </div>
          {/* Restart Tutorial */}
          <div className="bg-zinc-800/50 rounded-xl border-2 border-zinc-700/50 p-5 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center">
                <RotateCcw className="w-7 h-7 text-white" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-base">
                  Restart Tutorial
                </h4>
                <p className="text-zinc-400 text-sm mt-1">
                  Restart the guided tutorial to learn PFControl features again.
                </p>
              </div>
            </div>
            <Button
              onClick={handleRestartTutorial}
              variant="outline"
              size="sm"
              className="border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/20 hover:border-yellow-600"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restart
            </Button>
          </div>
        </div>

        {/* Bio Section */}
        <div className="bg-zinc-800/50 rounded-xl border-2 border-zinc-700/50 p-5">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <h4 className="text-white font-semibold text-base">Biography</h4>
              <p className="text-zinc-400 text-sm mt-1">
                Add a personal description to your profile (max 500 characters).
              </p>
            </div>
          </div>
          <textarea
            value={settings?.bio ?? ''}
            onChange={(e) => handleBioChange(e.target.value)}
            placeholder="Tell others about yourself, your aviation interests, or anything you'd like to share..."
            maxLength={500}
            rows={5}
            className="w-full px-4 py-3 bg-zinc-900/50 border-2 border-zinc-700 rounded-lg text-white placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-zinc-500">
              Your biography is always visible to others on your profile
            </p>
            <p className="text-xs text-zinc-400">
              {(settings?.bio ?? '').length}/500
            </p>
          </div>
        </div>

        {/* Privacy Settings Section - Collapsible */}
        <div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl overflow-hidden">
          <div className="w-full p-4 sm:p-6 border-b border-zinc-700/50">
            <div className="flex items-center justify-between gap-3">
              <div
                className="flex items-center flex-1 min-w-0 cursor-pointer"
                onClick={() => setIsPrivacyExpanded(!isPrivacyExpanded)}
              >
                <div className="p-2 bg-purple-500/20 rounded-lg mr-3 sm:mr-4 flex-shrink-0">
                  <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
                </div>
                <div className="text-left min-w-0">
                  <h3 className="text-lg sm:text-xl font-semibold text-white">
                    Privacy Settings
                  </h3>
                  <p className="text-zinc-400 text-xs sm:text-sm mt-1 hidden sm:block">
                    Control what information is displayed on your profile
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setIsPrivacyExpanded(!isPrivacyExpanded)}
                variant="outline"
                size="sm"
                className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 p-2"
              >
                {isPrivacyExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
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
            <div className="p-6">
              <PrivacySettings settings={settings} onChange={onChange} />
            </div>
          </div>
        </div>

        {/* Account Connections Section */}
        <div className="space-y-4">
          <div className="flex items-center">
            <h3 className="text-lg font-semibold text-white">
              Account Connections
            </h3>
          </div>
          <div className="space-y-4">
            {/* Roblox Account */}
            <div className="bg-zinc-800/50 rounded-xl border-2 border-zinc-700/50 p-5 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <SiRoblox className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h4 className="text-white font-semibold text-base">
                    Roblox Account
                  </h4>
                  {user?.robloxUsername ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-green-400 text-sm font-medium">
                        Connected
                      </span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-zinc-300 text-sm">
                        @{user.robloxUsername}
                      </span>
                    </div>
                  ) : (
                    <p className="text-zinc-400 text-sm mt-1">
                      Link your Roblox account
                    </p>
                  )}
                </div>
              </div>

              <div>
                {user?.robloxUsername ? (
                  <Button
                    onClick={() => setShowRobloxConfirm(true)}
                    variant="outline"
                    size="sm"
                    className="border-red-700/50 text-red-400 hover:bg-red-900/20 hover:border-red-600"
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    Unlink
                  </Button>
                ) : (
                  <Button
                    onClick={handleLinkRoblox}
                    variant="primary"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 border-blue-600"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Link Account
                  </Button>
                )}
              </div>
            </div>

            {/* VATSIM Account */}
            <div className="bg-zinc-800/50 rounded-xl border-2 border-zinc-700/50 p-5 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                  <img
                    src="/assets/images/vatsim.webp"
                    alt="VATSIM"
                    className="w-8 h-8"
                  />
                </div>
                <div>
                  <h4 className="text-white font-semibold text-base">
                    VATSIM Account
                  </h4>
                  {isVatsimLinked ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-green-400 text-sm font-medium">
                        Connected
                      </span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-zinc-300 text-sm">
                        {user?.vatsimCid}
                      </span>
                    </div>
                  ) : (
                    <p className="text-zinc-400 text-sm mt-1">
                      Link your VATSIM account to show controller rating on your
                      profile
                    </p>
                  )}
                </div>
              </div>
              <div>
                {isVatsimLinked ? (
                  <Button
                    onClick={() => setShowVatsimConfirm(true)}
                    variant="outline"
                    size="sm"
                    className="border-red-700/50 text-red-400 hover:bg-red-900/20 hover:border-red-600"
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    Unlink
                  </Button>
                ) : (
                  <Button
                    onClick={handleLinkVatsim}
                    variant="primary"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Link Account
                  </Button>
                )}
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
