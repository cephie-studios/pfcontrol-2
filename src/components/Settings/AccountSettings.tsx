import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  CircleCheck,
  CircleDashed,
  ExternalLink,
  GraduationCap,
  Link2,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  Unlink,
  UserRound,
} from 'lucide-react';
import { SiDiscord, SiRoblox } from 'react-icons/si';
import { useAuth } from '../../hooks/auth/useAuth';
import { toast } from 'sonner';
import { updateTutorialStatus } from '../../utils/fetch/auth';
import type { Settings } from '../../types/settings';
import PrivacySettings from './PrivacySettings';
import SettingsSection from './SettingsSection';
import SettingsGroup from './SettingsGroup';
import SettingsRow from './SettingsRow';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { minDuration } from '@/lib/minDuration';
import { useChartfoxStatus } from '../../hooks/useChartfox';
import { chartfoxConnectUrl } from '../../utils/fetch/charts';
import { CHARTFOX_LOGO_URL } from '../../utils/chartCatalog';

interface AccountSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

const LINK_ERROR_MESSAGES: Record<string, string> = {
  roblox_auth_failed: 'Failed to link Roblox account',
  vatsim_auth_failed: 'Failed to link VATSIM account',
  vatsim_token_failed: 'Failed to link VATSIM account',
  vatsim_link_failed: 'Failed to link VATSIM account',
  vatsim_missing_code: 'Failed to link VATSIM account',
  vatsim_not_configured: 'VATSIM linking is currently unavailable',
  chartfox_auth_failed: 'Failed to connect ChartFox',
};

function LinkStatus({ linked, text }: { linked: boolean; text: string }) {
  const Icon = linked ? CircleCheck : CircleDashed;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Icon
        aria-hidden
        className={
          linked
            ? 'size-4 shrink-0 text-emerald-400'
            : 'size-4 shrink-0 text-muted-foreground'
        }
      />
      <span className="truncate">{text}</span>
    </span>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: () => void;
};

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent variant="danger" className="shadcn-scope">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function AccountSettings({
  settings,
  onChange,
}: AccountSettingsProps) {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledLinkParams = useRef(false);
  const [showVatsimConfirm, setShowVatsimConfirm] = useState(false);
  const [vatsimRefreshing, setVatsimRefreshing] = useState(false);
  const [showRobloxConfirm, setShowRobloxConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [showChartfoxConfirm, setShowChartfoxConfirm] = useState(false);
  const [unlinking, setUnlinking] = useState<
    'vatsim' | 'roblox' | 'chartfox' | null
  >(null);
  const chartfox = useChartfoxStatus(!!user);
  const { refresh: refreshChartfox } = chartfox;
  const [restartingTutorial, setRestartingTutorial] = useState(false);
  const isVatsimLinked = !!(
    user?.vatsimCid ||
    user?.vatsimRatingShort ||
    user?.vatsimRatingLong
  );

  useEffect(() => {
    if (handledLinkParams.current) return;
    const linked = searchParams.get('vatsim_linked') === 'true';
    const chartfoxLinked = searchParams.get('chartfox_linked') === 'true';
    const error = searchParams.get('error');
    if (!linked && !chartfoxLinked && !error) return;
    handledLinkParams.current = true;

    if (linked) {
      toast.success('VATSIM account linked');
      refreshUser();
    }
    if (chartfoxLinked) {
      toast.success('ChartFox connected');
      refreshChartfox();
    }
    if (error) {
      toast.error(LINK_ERROR_MESSAGES[error] ?? 'Failed to link account');
    }

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('vatsim_linked');
        next.delete('chartfox_linked');
        next.delete('error');
        return next;
      },
      { replace: true }
    );
  }, [searchParams, setSearchParams, refreshUser, refreshChartfox]);

  const handleLinkRoblox = () => {
    window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/roblox`;
  };

  const handleLinkVatsim = () => {
    window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/vatsim?force=1`;
  };

  const handleRefreshVatsim = async () => {
    setVatsimRefreshing(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/auth/vatsim/refresh`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      if (res.ok) {
        const data = await res.json();
        await refreshUser();
        toast.success(
          data.changed
            ? `VATSIM rating updated to ${data.ratingShort ?? 'unknown'}`
            : 'VATSIM rating is already up to date'
        );
      } else if (res.status === 429) {
        toast.error('Please wait a moment before refreshing again');
      } else {
        toast.error('Failed to refresh VATSIM rating');
      }
    } catch (e) {
      console.error('Refresh VATSIM error:', e);
      toast.error('Failed to refresh VATSIM rating');
    } finally {
      setVatsimRefreshing(false);
    }
  };

  const handleUnlinkVatsim = async () => {
    setShowVatsimConfirm(false);
    setUnlinking('vatsim');
    try {
      const res = await minDuration(
        fetch(`${import.meta.env.VITE_SERVER_URL}/api/auth/vatsim/unlink`, {
          method: 'POST',
          credentials: 'include',
        })
      );
      if (res.ok) {
        await refreshUser();
      } else {
        toast.error('Failed to unlink VATSIM account');
      }
    } catch (e) {
      console.error('Unlink VATSIM error:', e);
      toast.error('Failed to unlink VATSIM account');
    } finally {
      setUnlinking(null);
    }
  };

  const handleUnlinkRoblox = async () => {
    setShowRobloxConfirm(false);
    setUnlinking('roblox');
    try {
      const res = await minDuration(
        fetch(`${import.meta.env.VITE_SERVER_URL}/api/auth/roblox/unlink`, {
          method: 'POST',
          credentials: 'include',
        })
      );

      if (res.ok) {
        await refreshUser();
      } else {
        toast.error('Failed to unlink Roblox account');
      }
    } catch (error) {
      console.error('Error unlinking Roblox:', error);
      toast.error('Failed to unlink Roblox account');
    } finally {
      setUnlinking(null);
    }
  };

  const handleUnlinkChartfox = async () => {
    setShowChartfoxConfirm(false);
    setUnlinking('chartfox');
    try {
      const ok = await minDuration(chartfox.disconnect());
      if (!ok) toast.error('Failed to disconnect ChartFox');
    } finally {
      setUnlinking(null);
    }
  };

  const handleRestartTutorial = async () => {
    setRestartingTutorial(true);
    try {
      const success = await minDuration(updateTutorialStatus(false));
      if (success) {
        await refreshUser();
        navigate('/?tutorial=true');
      } else {
        console.error('Failed to reset tutorial.');
      }
    } catch (error) {
      console.error('Error resetting tutorial:', error);
    } finally {
      setRestartingTutorial(false);
    }
  };

  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    setDeleteInProgress(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/auth/delete-account`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (res.ok) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/';
      } else {
        const error = await res.json();
        toast.error(
          `Failed to delete account: ${error.message || 'Unknown error'}`
        );
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account. Please try again.');
    } finally {
      setDeleteInProgress(false);
    }
  };

  const handleJoinDiscord = () => {
    window.open('https://cephie.app/discord', '_blank');
  };

  const vatsimStatus = isVatsimLinked
    ? [
        user?.vatsimCid ? `Linked as ${user.vatsimCid}` : 'Linked',
        user?.vatsimRatingShort ? `(${user.vatsimRatingShort})` : null,
      ]
        .filter(Boolean)
        .join(' ')
    : 'Not linked';

  return (
    <SettingsSection title="Account" icon={UserRound}>
      {user ? (
        <SettingsGroup>
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar size="lg">
                {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
                <AvatarFallback>
                  {user.username.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-medium">{user.username}</p>
                <p className="text-sm text-muted-foreground">
                  Bio, stats visibility and customization are edited on your
                  profile.
                </p>
              </div>
            </div>
            <Button variant="outline" asChild className="sm:shrink-0">
              <Link to={`/user/${encodeURIComponent(user.username)}`}>
                <UserRound />
                View profile
              </Link>
            </Button>
          </div>
        </SettingsGroup>
      ) : null}

      <SettingsGroup title="Linked accounts">
        <SettingsRow
          icon={<SiRoblox />}
          label="Roblox"
          description={
            <LinkStatus
              linked={!!user?.robloxUsername}
              text={
                user?.robloxUsername
                  ? `Linked as @${user.robloxUsername}`
                  : 'Not linked'
              }
            />
          }
        >
          {user?.robloxUsername ? (
            <Button
              variant="outline"
              onClick={() => setShowRobloxConfirm(true)}
              disabled={unlinking === 'roblox'}
            >
              {unlinking === 'roblox' ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Unlink />
              )}
              Unlink
            </Button>
          ) : (
            <Button onClick={handleLinkRoblox}>
              <Link2 />
              Link
            </Button>
          )}
        </SettingsRow>
        <SettingsRow
          icon={
            <img
              src="/assets/images/vatsim.webp"
              alt=""
              className="size-full rounded-full object-cover"
            />
          }
          label="VATSIM"
          description={
            <LinkStatus linked={isVatsimLinked} text={vatsimStatus} />
          }
        >
          {isVatsimLinked ? (
            <>
              <Button
                variant="outline"
                onClick={handleRefreshVatsim}
                disabled={vatsimRefreshing}
              >
                <RefreshCw className={vatsimRefreshing ? 'animate-spin' : ''} />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowVatsimConfirm(true)}
                disabled={unlinking === 'vatsim'}
              >
                {unlinking === 'vatsim' ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Unlink />
                )}
                Unlink
              </Button>
            </>
          ) : (
            <Button onClick={handleLinkVatsim}>
              <Link2 />
              Link
            </Button>
          )}
        </SettingsRow>
        {user && chartfox.configured && (
          <SettingsRow
            icon={
              <img
                src={CHARTFOX_LOGO_URL}
                alt=""
                className="size-full rounded-lg object-cover"
              />
            }
            label="ChartFox"
            description={
              <LinkStatus
                linked={chartfox.linked}
                text={
                  chartfox.linked
                    ? chartfox.name
                      ? `Connected as ${chartfox.name}`
                      : 'Connected'
                    : 'Not connected'
                }
              />
            }
          >
            {chartfox.linked ? (
              <Button
                variant="outline"
                onClick={() => setShowChartfoxConfirm(true)}
                disabled={unlinking === 'chartfox'}
              >
                {unlinking === 'chartfox' ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Unlink />
                )}
                Disconnect
              </Button>
            ) : (
              <Button
                onClick={() => {
                  window.location.href = chartfoxConnectUrl('redirect');
                }}
              >
                <Link2 />
                Connect
              </Button>
            )}
          </SettingsRow>
        )}
      </SettingsGroup>

      <PrivacySettings settings={settings} onChange={onChange} />

      <SettingsGroup title="Help">
        <SettingsRow
          icon={<GraduationCap className="text-blue-400" />}
          label="Tutorial"
          description="Walk through the PFControl features again."
        >
          <Button
            variant="outline"
            onClick={handleRestartTutorial}
            disabled={restartingTutorial}
          >
            {restartingTutorial ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RotateCcw />
            )}
            Restart
          </Button>
        </SettingsRow>
        <SettingsRow
          icon={<SiDiscord className="text-[#5865F2]" />}
          label="Discord"
          description="Get support, report bugs or suggest features."
        >
          <Button variant="outline" onClick={handleJoinDiscord}>
            <ExternalLink />
            Join Discord
          </Button>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Danger zone">
        <SettingsRow
          icon={<Trash2 className="text-destructive" />}
          label="Delete account"
          description="Permanently deletes your sessions, settings and data."
        >
          <Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteInProgress}
          >
            {deleteInProgress ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Trash2 />
            )}
            {deleteInProgress ? 'Deleting…' : 'Delete account'}
          </Button>
        </SettingsRow>
      </SettingsGroup>

      <ConfirmDialog
        open={showRobloxConfirm}
        onOpenChange={setShowRobloxConfirm}
        title="Unlink Roblox account?"
        description="You will need to link it again to use Roblox-related features."
        confirmText="Unlink"
        onConfirm={handleUnlinkRoblox}
      />

      <ConfirmDialog
        open={showVatsimConfirm}
        onOpenChange={setShowVatsimConfirm}
        title="Unlink VATSIM account?"
        description="Your controller rating will no longer be shown on your profile."
        confirmText="Unlink"
        onConfirm={handleUnlinkVatsim}
      />

      <ConfirmDialog
        open={showChartfoxConfirm}
        onOpenChange={setShowChartfoxConfirm}
        title="Disconnect ChartFox?"
        description="Real-world charts from ChartFox will no longer be shown in the chart viewer."
        confirmText="Disconnect"
        onConfirm={handleUnlinkChartfox}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete account?"
        description="This permanently deletes all your sessions, settings and data. This cannot be undone."
        confirmText="Delete my account"
        onConfirm={handleDeleteAccount}
      />
    </SettingsSection>
  );
}
