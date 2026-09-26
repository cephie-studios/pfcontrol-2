import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router';
import {
  Ban,
  Globe,
  MapPin,
  ShieldCheck,
  Trash2,
  Undo2,
  User,
  UserCheck,
} from 'lucide-react';
import {
  banUser,
  unbanUser,
  fetchAllBans,
  fetchVpnGate,
  toggleVpnGate,
  addVpnException,
  removeVpnException,
  fetchIpLocation,
  type VpnException,
} from '../../utils/fetch/admin';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminPage from '../../components/admin/AdminPage';
import AdminSection from '../../components/admin/AdminSection';
import AdminTable from '../../components/admin/AdminTable';
import AdminToggleSwitch from '../../components/admin/AdminToggleSwitch';
import AdminTextInput from '../../components/admin/AdminTextInput';
import AdminDurationPresets from '../../components/admin/AdminDurationPresets';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoading,
} from '../../components/admin/AdminStates';
import type { AdminDurationPresetId } from '../../components/admin/adminDurationPresetConfig';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface BanRecord {
  id: number;
  user_id?: string;
  ip_address?: string;
  username?: string;
  target_username?: string;
  reason: string;
  banned_by: string;
  banned_by_username?: string;
  banned_by_avatar?: string;
  banned_at: string;
  expires_at?: string;
  active: boolean;
}

interface IpLocation {
  country?: string;
  country_code?: string;
  city?: string;
  region?: string;
}

export default function AdminBan() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const userId = params.get('userId') || '';
  const username = params.get('username') || '';
  const reasonParam = params.get('reason') || '';
  const [banType, setBanType] = useState<'user' | 'ip'>('user');
  const [userIdInput, setUserIdInput] = useState(userId);
  const [ipInput, setIpInput] = useState('');
  const [reason, setReason] = useState(reasonParam);
  const [expiresAt, setExpiresAt] = useState('');
  const [durationPreset, setDurationPreset] =
    useState<AdminDurationPresetId | null>(null);
  const [loading, setLoading] = useState(false);

  const [bans, setBans] = useState<BanRecord[]>([]);
  const [bansLoading, setBansLoading] = useState(true);
  const [bansError, setBansError] = useState<string | null>(null);
  const [ipLocations, setIpLocations] = useState<Record<string, IpLocation>>(
    {}
  );
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const [vpnGateEnabled, setVpnGateEnabled] = useState(false);
  const [vpnExceptions, setVpnExceptions] = useState<VpnException[]>([]);
  const [vpnGateLoading, setVpnGateLoading] = useState(true);
  const [vpnGateError, setVpnGateError] = useState<string | null>(null);
  const [vpnToggleLoading, setVpnToggleLoading] = useState(false);
  const [exceptionUserIdInput, setExceptionUserIdInput] = useState('');
  const [exceptionNotesInput, setExceptionNotesInput] = useState('');
  const [addExceptionLoading, setAddExceptionLoading] = useState(false);

  useEffect(() => {
    void fetchBans();
    void fetchVpnGateData();
  }, []);

  const lookupIpLocations = useCallback(async (banList: BanRecord[]) => {
    const ipsToLookup = banList
      .filter((b) => b.ip_address)
      .map((b) => b.ip_address!);

    if (ipsToLookup.length === 0) return;

    const results: Record<string, IpLocation> = {};
    await Promise.allSettled(
      ipsToLookup.map(async (ip) => {
        try {
          const data = await fetchIpLocation(ip);
          if (data.country || data.city || data.country_code) {
            results[ip] = data;
          }
        } catch {
          /* IP lookup failed for this address */
        }
      })
    );
    setIpLocations((prev) => ({ ...prev, ...results }));
  }, []);

  const fetchBans = async () => {
    try {
      setBansLoading(true);
      setBansError(null);
      const data = await fetchAllBans();
      const activeBans = (data.bans as unknown as BanRecord[]).filter(
        (ban) => ban.active
      );
      setBans(activeBans);
      void lookupIpLocations(activeBans);
    } catch (err) {
      setBansError('Failed to load bans');
      setToast({
        message: err instanceof Error ? err.message : 'Failed to load bans',
        type: 'error',
      });
    } finally {
      setBansLoading(false);
    }
  };

  const fetchVpnGateData = async () => {
    try {
      setVpnGateLoading(true);
      setVpnGateError(null);
      const data = await fetchVpnGate();
      setVpnGateEnabled(data.enabled);
      setVpnExceptions(data.exceptions);
    } catch {
      setVpnGateError('Failed to load VPN gate data');
    } finally {
      setVpnGateLoading(false);
    }
  };

  const handleBan = async () => {
    setLoading(true);
    try {
      if (banType === 'user' && !userIdInput)
        throw new Error('User ID is required');
      if (banType === 'ip' && !ipInput)
        throw new Error('IP address is required');
      await banUser({
        userId: banType === 'user' ? userIdInput : undefined,
        ip: banType === 'ip' ? ipInput : undefined,
        username: username || '',
        reason,
        expiresAt,
      });
      setToast({
        message: `Successfully banned ${banType === 'user' ? 'user' : 'IP'}`,
        type: 'success',
      });
      setUserIdInput('');
      setIpInput('');
      setReason('');
      setExpiresAt('');
      setDurationPreset(null);
      void fetchBans();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to ban',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async (userIdOrIp: string) => {
    try {
      await unbanUser(userIdOrIp);
      setToast({ message: 'Successfully unbanned', type: 'success' });
      void fetchBans();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to unban',
        type: 'error',
      });
    }
  };

  const handleToggleVpnGate = async () => {
    setVpnToggleLoading(true);
    try {
      const newValue = !vpnGateEnabled;
      await toggleVpnGate(newValue);
      setVpnGateEnabled(newValue);
      setToast({
        message: `VPN gate ${newValue ? 'enabled' : 'disabled'}`,
        type: 'success',
      });
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to toggle VPN gate',
        type: 'error',
      });
    } finally {
      setVpnToggleLoading(false);
    }
  };

  const handleAddException = async () => {
    if (!exceptionUserIdInput) {
      setToast({ message: 'User ID is required', type: 'error' });
      return;
    }
    setAddExceptionLoading(true);
    try {
      await addVpnException({
        userId: exceptionUserIdInput,
        notes: exceptionNotesInput,
      });
      setToast({ message: 'Exception added', type: 'success' });
      setExceptionUserIdInput('');
      setExceptionNotesInput('');
      void fetchVpnGateData();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to add exception',
        type: 'error',
      });
    } finally {
      setAddExceptionLoading(false);
    }
  };

  const handleRemoveException = async (exceptionUserId: string) => {
    try {
      await removeVpnException(exceptionUserId);
      setToast({ message: 'Exception removed', type: 'success' });
      void fetchVpnGateData();
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : 'Failed to remove exception',
        type: 'error',
      });
    }
  };

  const getModAvatar = (ban: BanRecord) =>
    ban.banned_by_avatar
      ? `https://cdn.discordapp.com/avatars/${ban.banned_by}/${ban.banned_by_avatar}.png`
      : '/assets/app/default/avatar.webp';

  const presetExpiry = (
    ms: number,
    presetId: Exclude<AdminDurationPresetId, 'permanent'>
  ) => {
    setDurationPreset(presetId);
    setExpiresAt(new Date(Date.now() + ms).toISOString().slice(0, 16));
  };

  return (
    <AdminLayout toast={toast} onToastClose={() => setToast(null)}>
      <AdminPage title="Bans & access" icon={Ban}>
        <AdminSection title="Create ban">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Ban type</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                value={banType}
                onValueChange={(v) => {
                  if (v) setBanType(v as 'user' | 'ip');
                }}
                aria-label="Ban type"
                className="w-full sm:w-auto"
              >
                <ToggleGroupItem value="user" className="flex-1 sm:flex-none">
                  <User />
                  User ID
                </ToggleGroupItem>
                <ToggleGroupItem value="ip" className="flex-1 sm:flex-none">
                  <Globe />
                  IP address
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {banType === 'user' ? (
                <AdminTextInput
                  className="sm:col-span-2"
                  label="User ID"
                  value={userIdInput}
                  onChange={setUserIdInput}
                  placeholder="Discord user ID"
                  inputClassName="font-mono"
                />
              ) : (
                <AdminTextInput
                  className="sm:col-span-2"
                  label="IP address"
                  value={ipInput}
                  onChange={setIpInput}
                  placeholder="e.g. 203.0.113.42"
                  inputClassName="font-mono"
                />
              )}
              <AdminTextInput
                className="sm:col-span-2"
                label="Reason"
                value={reason}
                onChange={setReason}
                placeholder="Reason for ban"
                required
              />
              <AdminTextInput
                label="Expires at (optional)"
                type="datetime-local"
                value={expiresAt}
                onChange={(value) => {
                  setExpiresAt(value);
                  setDurationPreset(value.trim() ? null : 'permanent');
                }}
              />
              <AdminDurationPresets
                activePreset={durationPreset}
                onPreset={presetExpiry}
                onPermanent={() => {
                  setDurationPreset('permanent');
                  setExpiresAt('');
                }}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => void handleBan()}
                variant="destructive"
                disabled={loading || !reason}
                className="w-full sm:w-auto"
              >
                <Ban />
                {loading ? 'Banning…' : 'Apply ban'}
              </Button>
            </div>
          </div>
        </AdminSection>

        <AdminSection
          title="Active bans"
          description={
            bansLoading
              ? undefined
              : `${bans.length} active ${bans.length === 1 ? 'ban' : 'bans'}`
          }
        >
          {bansLoading ? (
            <AdminLoading label="Loading bans…" />
          ) : bansError ? (
            <AdminErrorState
              title="Error loading bans"
              message={bansError}
              onRetry={fetchBans}
            />
          ) : bans.length === 0 ? (
            <AdminEmptyState icon={ShieldCheck} title="No active bans" />
          ) : (
            <AdminTable minWidth="900px">
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Banned</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Moderator</TableHead>
                  <TableHead className="w-16 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bans.map((ban) => {
                  const loc = ban.ip_address
                    ? ipLocations[ban.ip_address]
                    : undefined;
                  const isUser = Boolean(ban.user_id);
                  return (
                    <TableRow key={ban.id}>
                      <TableCell className="align-top">
                        <div className="min-w-0">
                          <p
                            className={cn(
                              'truncate font-medium',
                              !isUser && 'font-mono text-xs'
                            )}
                          >
                            {isUser
                              ? ban.target_username ||
                                ban.username ||
                                ban.user_id
                              : ban.ip_address}
                          </p>
                          {isUser && (
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              {ban.user_id}
                            </p>
                          )}
                          {ban.ip_address && loc && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="size-3 shrink-0" />
                              {[loc.city, loc.region, loc.country]
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs align-top whitespace-normal">
                        <p className="line-clamp-2">{ban.reason}</p>
                      </TableCell>
                      <TableCell className="align-top text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {new Date(ban.banned_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="align-top text-xs whitespace-nowrap tabular-nums">
                        {ban.expires_at
                          ? new Date(ban.expires_at).toLocaleString()
                          : 'Never'}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex min-w-0 items-center gap-2">
                          <img
                            src={getModAvatar(ban)}
                            alt=""
                            className="size-6 shrink-0 rounded-full"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                '/assets/app/default/avatar.webp';
                            }}
                          />
                          <span className="truncate text-xs">
                            {ban.banned_by_username || ban.banned_by}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Unban"
                              onClick={() =>
                                void handleUnban(ban.user_id || ban.ip_address!)
                              }
                            >
                              <Undo2 />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Unban</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </AdminTable>
          )}
        </AdminSection>

        <AdminSection
          title="VPN gate"
          actions={
            !vpnGateLoading && !vpnGateError ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {vpnGateEnabled ? 'Enabled' : 'Disabled'}
                </span>
                <AdminToggleSwitch
                  checked={vpnGateEnabled}
                  onChange={() => void handleToggleVpnGate()}
                  disabled={vpnToggleLoading}
                  aria-label="Toggle VPN gate"
                />
              </div>
            ) : undefined
          }
        >
          {vpnGateLoading ? (
            <AdminLoading label="Loading VPN gate…" />
          ) : vpnGateError ? (
            <AdminErrorState
              title="Error loading VPN gate"
              message={vpnGateError}
              onRetry={fetchVpnGateData}
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="grid content-start gap-4">
                <h3 className="text-sm font-medium">Add exception</h3>
                <AdminTextInput
                  label="User ID"
                  value={exceptionUserIdInput}
                  onChange={setExceptionUserIdInput}
                  placeholder="Discord user ID"
                  inputClassName="font-mono"
                  required
                />
                <AdminTextInput
                  label="Notes (optional)"
                  value={exceptionNotesInput}
                  onChange={setExceptionNotesInput}
                  placeholder="Optional note"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={() => void handleAddException()}
                    disabled={addExceptionLoading || !exceptionUserIdInput}
                    className="w-full sm:w-auto"
                  >
                    {addExceptionLoading ? 'Adding…' : 'Add exception'}
                  </Button>
                </div>
              </div>

              <div className="grid content-start gap-4">
                <h3 className="text-sm font-medium">
                  Exceptions{' '}
                  <span className="text-muted-foreground tabular-nums">
                    {vpnExceptions.length}
                  </span>
                </h3>
                {vpnExceptions.length === 0 ? (
                  <AdminEmptyState
                    icon={UserCheck}
                    title="No exceptions yet"
                    className="py-8"
                  />
                ) : (
                  <ul className="max-h-80 divide-y overflow-y-auto rounded-2xl border">
                    {vpnExceptions.map((ex) => (
                      <li
                        key={ex.user_id}
                        className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="grid min-w-0 gap-0.5">
                          <p className="truncate text-sm font-medium">
                            {ex.username}
                          </p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {ex.user_id}
                          </p>
                          {ex.notes && <p className="text-xs">{ex.notes}</p>}
                          <p className="text-xs text-muted-foreground">
                            by {ex.added_by_username}
                          </p>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Remove exception"
                              onClick={() =>
                                void handleRemoveException(ex.user_id)
                              }
                              className="shrink-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove exception</TooltipContent>
                        </Tooltip>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </AdminSection>
      </AdminPage>
    </AdminLayout>
  );
}
