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
import { SiRoblox, SiDiscord } from 'react-icons/si';
import { updateTutorialStatus } from '../../utils/fetch/auth';
import Button from '../common/Button';
import { useNavigate } from 'react-router-dom';
import type { Settings } from '../../types/settings';
import PrivacySettings from './PrivacySettings';
import ConfirmationDialog from '../common/ConfirmationDialog';
import { S } from './settingsTokens';

interface AccountSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

export default function AccountSettings({ settings, onChange }: AccountSettingsProps) {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState(false);
  const [showVatsimConfirm, setShowVatsimConfirm] = useState(false);
  const [showRobloxConfirm, setShowRobloxConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  const isVatsimLinked = !!(user?.vatsimCid || user?.vatsimRatingShort || user?.vatsimRatingLong);

  const handleLinkRoblox = () => { window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/roblox`; };
  const handleLinkVatsim = () => { window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/vatsim?force=1`; };

  const handleUnlinkVatsim = async () => {
    setShowVatsimConfirm(false);
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/auth/vatsim/unlink`, { method: 'POST', credentials: 'include' });
      if (res.ok) await refreshUser();
      else alert('Failed to unlink VATSIM account');
    } catch (e) {
      console.error('Unlink VATSIM error:', e);
      alert('Failed to unlink VATSIM account');
    }
  };

  const handleUnlinkRoblox = async () => {
    setShowRobloxConfirm(false);
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/auth/roblox/unlink`, { method: 'POST', credentials: 'include' });
      if (res.ok) await refreshUser();
      else alert('Failed to unlink Roblox account');
    } catch (error) {
      console.error('Error unlinking Roblox:', error);
      alert('Failed to unlink Roblox account');
    }
  };

  const handleRestartTutorial = async () => {
    try {
      const success = await updateTutorialStatus(false);
      if (success) { await refreshUser(); navigate('/?tutorial=true'); }
      else console.error('Failed to reset tutorial.');
    } catch (error) {
      console.error('Error resetting tutorial:', error);
    }
  };

  const handleBioChange = (bio: string) => {
    if (!settings) return;
    onChange({ ...settings, bio });
  };

  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    setDeleteInProgress(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/auth/delete-account`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/';
      } else {
        const error = await res.json();
        alert(`Failed to delete account: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again.');
    } finally {
      setDeleteInProgress(false);
    }
  };

  const handleJoinDiscord = () => { window.open('https://cephie.app/discord', '_blank'); };

  return (
    <div className={S.card}>
      {/* Header */}
      <div className={S.header}>
        <div className="flex items-center gap-4">
          <div className={`${S.iconBox} bg-blue-500/20`}>
            <Link2 className={`${S.icon} text-blue-400`} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className={S.title}>Account Settings</h3>
            <p className="text-zinc-400 text-xs sm:text-sm mt-0.5">Manage your account preferences and connections</p>
          </div>
        </div>
      </div>

      <div className={S.content}>
        <div className="space-y-6">

          {/* Settings Section */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-white">Settings</h3>
            <div className={S.section}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="p-2 bg-yellow-500/20 rounded-lg flex-shrink-0">
                    <RotateCcw className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-white font-medium text-sm truncate">Restart Tutorial</h4>
                    <p className="text-zinc-400 text-xs mt-0.5 line-clamp-2">Restart the guided tutorial to learn PFControl features again.</p>
                  </div>
                </div>
                <Button
                  onClick={handleRestartTutorial}
                  variant="outline"
                  size="sm"
                  className="border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/20 hover:border-yellow-600 text-xs whitespace-nowrap flex-shrink-0"
                >
                  <RotateCcw className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Restart</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Bio Section */}
          <div className={S.section}>
            <div className="flex items-center gap-4 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg flex-shrink-0">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-white font-medium text-sm truncate">Biography</h4>
                <p className="text-zinc-400 text-xs mt-0.5">Add a personal description to your profile (max 500 characters).</p>
              </div>
            </div>
            <textarea
              value={settings?.bio ?? ''}
              onChange={(e) => handleBioChange(e.target.value)}
              placeholder="Tell others about yourself, your aviation interests, or anything you'd like to share..."
              maxLength={500}
              rows={6}
              className="w-full px-3 py-2 sm:px-4 sm:py-3 bg-zinc-900/50 border border-zinc-700 rounded-lg text-white placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-zinc-500">Your biography is always visible to others on your profile</p>
              <p className="text-xs text-zinc-400 flex-shrink-0">{(settings?.bio ?? '').length}/500</p>
            </div>
          </div>

          {/* Privacy Settings - Collapsible */}
          <div className={S.card}>
            <div className={S.header}>
              <div className={S.headerInner}>
                <div className={S.headerClickable} onClick={() => setIsPrivacyExpanded(!isPrivacyExpanded)}>
                  <div className={`${S.iconBox} ${S.iconBoxMr} bg-purple-500/20`}>
                    <Shield className={`${S.icon} text-purple-400`} />
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <h3 className={S.title}>Privacy Settings</h3>
                    <p className={S.subtitle}>Control what information is displayed on your profile</p>
                  </div>
                </div>
                <Button onClick={() => setIsPrivacyExpanded(!isPrivacyExpanded)} variant="outline" size="sm" className={S.chevronBtn}>
                  {isPrivacyExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className={`transition-all duration-300 ease-in-out ${isPrivacyExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
              <div className={S.content}>
                <PrivacySettings settings={settings} onChange={onChange} />
              </div>
            </div>
          </div>

          {/* Account Connections */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-white">Account Connections</h3>
            <div className="space-y-3">

              {/* Roblox */}
              <div className={S.section}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="p-2 bg-blue-500/20 rounded-lg flex-shrink-0">
                      <SiRoblox className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-white font-medium text-sm truncate">Roblox Account</h4>
                      {user?.robloxUsername ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-green-400 text-xs font-medium">Connected</span>
                          <span className="text-zinc-500 hidden sm:inline">•</span>
                          <span className="text-zinc-300 text-xs truncate">@{user.robloxUsername}</span>
                        </div>
                      ) : (
                        <p className="text-zinc-400 text-xs mt-0.5">Link your Roblox account</p>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {user?.robloxUsername ? (
                      <Button onClick={() => setShowRobloxConfirm(true)} variant="outline" size="sm" className="border-red-700/50 text-red-400 hover:bg-red-900/20 hover:border-red-600 text-xs whitespace-nowrap">
                        <UserX className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Unlink</span>
                      </Button>
                    ) : (
                      <Button onClick={handleLinkRoblox} variant="primary" size="sm" className="bg-blue-600 hover:bg-blue-700 border-blue-600 text-xs whitespace-nowrap">
                        <ExternalLink className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Link Account</span>
                        <span className="sm:hidden">Link</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* VATSIM */}
              <div className={S.section}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="p-2 bg-white rounded-lg flex-shrink-0">
                      <img src="/assets/images/vatsim.webp" alt="VATSIM" className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-white font-medium text-sm truncate">VATSIM Account</h4>
                      {isVatsimLinked ? (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-green-400 text-xs font-medium">Connected</span>
                          <span className="text-zinc-500 hidden sm:inline">•</span>
                          <span className="text-zinc-300 text-xs truncate">{user?.vatsimCid}</span>
                        </div>
                      ) : (
                        <p className="text-zinc-400 text-xs mt-0.5 line-clamp-2">Link your VATSIM account to show controller rating on your profile</p>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {isVatsimLinked ? (
                      <Button onClick={() => setShowVatsimConfirm(true)} variant="outline" size="sm" className="border-red-700/50 text-red-400 hover:bg-red-900/20 hover:border-red-600 text-xs whitespace-nowrap">
                        <UserX className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Unlink</span>
                      </Button>
                    ) : (
                      <Button onClick={handleLinkVatsim} variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-xs whitespace-nowrap">
                        <ExternalLink className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Link Account</span>
                        <span className="sm:hidden">Link</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-white">Support</h3>
            <div className="space-y-3">
              <div className={S.section}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="p-2 bg-indigo-500/20 rounded-lg flex-shrink-0">
                      <SiDiscord className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-white font-medium text-sm truncate">Join Our Discord</h4>
                      <p className="text-zinc-400 text-xs mt-0.5 line-clamp-2">Get support, report bugs, or suggest new features to improve PFControl.</p>
                    </div>
                  </div>
                  <Button onClick={handleJoinDiscord} variant="primary" size="sm" className="bg-indigo-600 hover:bg-indigo-700 border-indigo-600 text-xs whitespace-nowrap flex-shrink-0">
                    <ExternalLink className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Join Discord</span>
                    <span className="sm:hidden">Join</span>
                  </Button>
                </div>
              </div>

              {/* Delete Account */}
              <div className={S.section}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="p-2 bg-red-500/20 rounded-lg flex-shrink-0">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-red-400 font-medium text-sm truncate">Delete Account</h4>
                      <p className="text-zinc-400 text-xs mt-0.5 line-clamp-2">Permanently delete your account and all associated data. This action cannot be undone.</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowDeleteConfirm(true)}
                    variant="danger"
                    size="sm"
                    disabled={deleteInProgress}
                    className="text-xs whitespace-nowrap flex-shrink-0"
                  >
                    {deleteInProgress ? (
                      <>
                        <div className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-white" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Delete Account</span>
                        <span className="sm:hidden">Delete</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete Account"
        description="Are you sure you want to permanently delete your account? This will delete all your sessions, settings, and data. This action cannot be undone."
        confirmText="Delete My Account"
        cancelText="Cancel"
        variant="danger"
        icon={<AlertTriangle size={24} />}
      />
    </div>
  );
}