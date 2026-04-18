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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  const isVatsimLinked = !!(user?.vatsimCid);

  const handleLinkRoblox = () => window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/roblox`;
  const handleLinkVatsim = () => window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/vatsim?force=1`;

  const handleUnlink = async (provider: string, setter: (val: boolean) => void) => {
    setter(false);
    try {
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/auth/${provider}/unlink`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) await refreshUser();
    } catch (e) {
      console.error(`Unlink ${provider} error:`, e);
    }
  };

  const handleRestartTutorial = async () => {
    const success = await updateTutorialStatus(false);
    if (success) {
      await refreshUser();
      navigate('/?tutorial=true');
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 pb-2 border-b border-zinc-800/50">
        <div className="p-2.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <Link2 className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white leading-tight">Account Settings</h3>
          <p className="text-xs text-zinc-500">Manage your profile and external connections</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Settings Group */}
        <div className="grid gap-4">
          {/* Biography */}
          <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-4 sm:p-5">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20 flex-shrink-0">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div className="min-w-0">
                <h4 className="text-white font-semibold text-sm">Biography</h4>
                <p className="text-zinc-500 text-xs mt-0.5">Describe yourself for your public profile</p>
              </div>
            </div>
            <textarea
              value={settings?.bio ?? ''}
              onChange={(e) => onChange({ ...settings!, bio: e.target.value })}
              placeholder="Tell us about yourself..."
              maxLength={500}
              rows={4}
              className="w-full px-4 py-3 bg-zinc-950/50 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-all text-sm resize-none"
            />
            <div className="flex justify-end mt-2">
              <span className="text-[10px] text-zinc-600 font-mono">{(settings?.bio ?? '').length}/500</span>
            </div>
          </div>

          {/* Restart Tutorial */}
          <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 overflow-hidden">
              <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center border border-yellow-500/20 flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="truncate">
                <h4 className="text-white font-semibold text-sm">Guided Tutorial</h4>
                <p className="text-zinc-500 text-xs truncate">Reset the app onboarding experience</p>
              </div>
            </div>
            <Button onClick={handleRestartTutorial} variant="outline" size="sm" className="border-zinc-700 text-zinc-300">
              Restart
            </Button>
          </div>
        </div>

        {/* Account Connections Group */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Connections</h3>
          
          <div className="grid gap-3">
            {/* Roblox */}
            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                  <SiRoblox className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold text-sm">Roblox</h4>
                  <p className="text-xs text-zinc-500">{user?.robloxUsername ? `@${user.robloxUsername}` : 'Connect your account'}</p>
                </div>
              </div>
              <Button onClick={user?.robloxUsername ? () => setShowRobloxConfirm(true) : handleLinkRoblox} variant={user?.robloxUsername ? "outline" : "primary"} size="sm">
                {user?.robloxUsername ? 'Unlink' : 'Connect'}
              </Button>
            </div>

            {/* VATSIM */}
            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-zinc-200">
                  <img src="/assets/images/vatsim.webp" alt="VATSIM" className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-white font-semibold text-sm">VATSIM</h4>
                  <p className="text-xs text-zinc-500">{isVatsimLinked ? user?.vatsimCid : 'Sync controller ratings'}</p>
                </div>
              </div>
              <Button onClick={isVatsimLinked ? () => setShowVatsimConfirm(true) : handleLinkVatsim} variant={isVatsimLinked ? "outline" : "primary"} size="sm">
                {isVatsimLinked ? 'Unlink' : 'Connect'}
              </Button>
            </div>
          </div>
        </div>

        {/* Privacy Section */}
        <div className="bg-zinc-950/30 border border-zinc-800 rounded-xl overflow-hidden">
          <button 
            onClick={() => setIsPrivacyExpanded(!isPrivacyExpanded)}
            className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/40 transition-colors"
          >
            <div className="flex items-center gap-4">
              <Shield className="h-5 w-5 text-purple-400" />
              <span className="text-white font-semibold text-sm">Privacy Controls</span>
            </div>
            {isPrivacyExpanded ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
          </button>
          {isPrivacyExpanded && (
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
              <PrivacySettings settings={settings} onChange={onChange} />
            </div>
          )}
        </div>

        {/* Support & Community */}
        <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center border border-indigo-500/20">
                <SiDiscord className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm">Community Discord</h4>
                <p className="text-xs text-zinc-500">Get support and updates</p>
              </div>
            </div>
            <Button onClick={() => window.open('https://cephie.app/discord', '_blank')} variant="outline" size="sm" className="border-zinc-700 text-zinc-300">
              Join
            </Button>
        </div>

        {/* Danger Zone */}
        <div className="pt-2">
           <div className="bg-red-500/5 border border-red-900/20 rounded-lg p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <AlertTriangle className="text-red-500 w-5 h-5 flex-shrink-0" />
                <div>
                  <h4 className="text-red-400 font-bold text-sm">Delete Account</h4>
                  <p className="text-zinc-500 text-[11px]">Permanently wipe all your data.</p>
                </div>
              </div>
              <Button onClick={() => setShowDeleteConfirm(true)} variant="danger" size="sm">Delete</Button>
           </div>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={showVatsimConfirm}
        onConfirm={() => handleUnlink('vatsim', setShowVatsimConfirm)}
        onCancel={() => setShowVatsimConfirm(false)}
        title="Unlink VATSIM"
        description="Are you sure? Your ratings will be removed from your profile."
        variant="danger"
      />

      <ConfirmationDialog
        isOpen={showRobloxConfirm}
        onConfirm={() => handleUnlink('roblox', setShowRobloxConfirm)}
        onCancel={() => setShowRobloxConfirm(false)}
        title="Unlink Roblox"
        description="This will disable Roblox-specific features until re-linked."
        variant="danger"
      />

      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onConfirm={() => {/* implement delete logic */}}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Permanently Delete Account?"
        description="This action cannot be undone. All your data will be permanently removed."
        variant="danger"
      />
    </div>
  );
}