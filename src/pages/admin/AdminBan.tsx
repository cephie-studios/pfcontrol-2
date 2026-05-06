import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Ban,
  Users,
  Globe,
  X,
  Menu,
  Shield,
  ShieldCheck,
  ShieldX,
  MapPin,
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
  type IpLocationResult,
} from '../../utils/fetch/admin';
import Navbar from '../../components/Navbar';
import AdminSidebar from '../../components/admin/AdminSidebar';
import Button from '../../components/common/Button';
import TextInput from '../../components/common/TextInput';
import Loader from '../../components/common/Loader';
import Toast from '../../components/common/Toast';
import ErrorScreen from '../../components/common/ErrorScreen';

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
  const [loading, setLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [bans, setBans] = useState<BanRecord[]>([]);
  const [bansLoading, setBansLoading] = useState(true);
  const [bansError, setBansError] = useState<string | null>(null);
  const [ipLocations, setIpLocations] = useState<Record<string, IpLocation>>({});
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // VPN Gate state
  const [vpnGateEnabled, setVpnGateEnabled] = useState(false);
  const [vpnExceptions, setVpnExceptions] = useState<VpnException[]>([]);
  const [vpnGateLoading, setVpnGateLoading] = useState(true);
  const [vpnGateError, setVpnGateError] = useState<string | null>(null);
  const [vpnToggleLoading, setVpnToggleLoading] = useState(false);
  const [exceptionUserIdInput, setExceptionUserIdInput] = useState('');
  const [exceptionNotesInput, setExceptionNotesInput] = useState('');
  const [addExceptionLoading, setAddExceptionLoading] = useState(false);

  useEffect(() => {
    fetchBans();
    fetchVpnGateData();
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
          // ignore lookup failures
        }
      })
    );
    setIpLocations((prev) => ({ ...prev, ...results }));
  }, []);

  const fetchBans = async () => {
    try {
      setBansLoading(true);
      const data = await fetchAllBans();
      const activeBans = (data.bans as unknown as BanRecord[]).filter(
        (ban) => ban.active
      );
      setBans(activeBans);
      lookupIpLocations(activeBans);
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
      const data = await fetchVpnGate();
      setVpnGateEnabled(data.enabled);
      setVpnExceptions(data.exceptions);
    } catch (err) {
      setVpnGateError('Failed to load VPN gate data');
    } finally {
      setVpnGateLoading(false);
    }
  };

  const handleBan = async () => {
    setLoading(true);
    try {
      if (banType === 'user' && !userIdInput) throw new Error('User ID is required');
      if (banType === 'ip' && !ipInput) throw new Error('IP address is required');
      await banUser({
        userId: banType === 'user' ? userIdInput : undefined,
        ip: banType === 'ip' ? ipInput : undefined,
        username: username || '',
        reason,
        expiresAt,
      });
      setToast({ message: `Successfully banned ${banType === 'user' ? 'user' : 'IP'}`, type: 'success' });
      setUserIdInput('');
      setIpInput('');
      setReason('');
      setExpiresAt('');
      fetchBans();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to ban', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async (userIdOrIp: string) => {
    try {
      await unbanUser(userIdOrIp);
      setToast({ message: 'Successfully unbanned', type: 'success' });
      fetchBans();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to unban', type: 'error' });
    }
  };

  const handleToggleVpnGate = async () => {
    setVpnToggleLoading(true);
    try {
      const newValue = !vpnGateEnabled;
      await toggleVpnGate(newValue);
      setVpnGateEnabled(newValue);
      setToast({ message: `VPN gate ${newValue ? 'enabled' : 'disabled'}`, type: 'success' });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to toggle VPN gate', type: 'error' });
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
      await addVpnException({ userId: exceptionUserIdInput, notes: exceptionNotesInput });
      setToast({ message: 'Exception added', type: 'success' });
      setExceptionUserIdInput('');
      setExceptionNotesInput('');
      fetchVpnGateData();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to add exception', type: 'error' });
    } finally {
      setAddExceptionLoading(false);
    }
  };

  const handleRemoveException = async (exceptionUserId: string) => {
    try {
      await removeVpnException(exceptionUserId);
      setToast({ message: 'Exception removed', type: 'success' });
      fetchVpnGateData();
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Failed to remove exception', type: 'error' });
    }
  };

  const getModAvatar = (ban: BanRecord) =>
    ban.banned_by_avatar
      ? `https://cdn.discordapp.com/avatars/${ban.banned_by}/${ban.banned_by_avatar}.png`
      : '/assets/app/default/avatar.webp';

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="flex pt-16">
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
        <div className="hidden lg:block">
          <AdminSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>
        <div
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:hidden ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <AdminSidebar collapsed={false} onToggle={() => setMobileSidebarOpen(false)} />
        </div>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8">
          {/* Top row: Ban form + Active Bans list */}
          <div className="flex flex-col lg:flex-row lg:space-x-8 space-y-8 lg:space-y-0">
            {/* Left: Ban form */}
            <div className="flex-1">
              <div className="mb-8">
                <div className="flex items-center mb-4">
                  <Ban className="h-8 w-8 sm:h-10 sm:w-10 text-red-400 mr-4" />
                  <h1 className="text-5xl text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600 font-extrabold mb-2">
                    Ban User/IP
                  </h1>
                </div>
              </div>
              <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-6 max-w-lg">
                <div className="space-y-4">
                  <div>
                    <label className="block text-zinc-300 mb-2">Ban Type</label>
                    <div className="flex space-x-4">
                      <Button variant={banType === 'user' ? 'primary' : 'outline'} onClick={() => setBanType('user')} className="flex items-center space-x-2" size="sm">
                        <Users className="w-4 h-4" /><span>By User ID</span>
                      </Button>
                      <Button variant={banType === 'ip' ? 'primary' : 'outline'} onClick={() => setBanType('ip')} className="flex items-center space-x-2" size="sm">
                        <Globe className="w-4 h-4" /><span>By IP</span>
                      </Button>
                    </div>
                  </div>
                  {banType === 'user' && (
                    <div>
                      <label className="block text-zinc-300 mb-2">User ID</label>
                      <TextInput value={userIdInput} onChange={setUserIdInput} className="w-full bg-zinc-800 rounded p-2 text-white" />
                    </div>
                  )}
                  {banType === 'ip' && (
                    <div>
                      <label className="block text-zinc-300 mb-2">IP Address</label>
                      <TextInput value={ipInput} onChange={setIpInput} className="w-full bg-zinc-800 rounded p-2 text-white" />
                    </div>
                  )}
                  <div>
                    <label className="block text-zinc-300 mb-2">Reason</label>
                    <TextInput value={reason} onChange={setReason} className="w-full bg-zinc-800 rounded p-2 text-white" />
                  </div>
                  <div>
                    <label className="block text-zinc-300 mb-2">Expires At (optional)</label>
                    <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full bg-zinc-800 rounded p-2 text-white" />
                    <div className="flex space-x-2 mt-4">
                      <Button variant="outline" size="sm" onClick={() => setExpiresAt(new Date(Date.now() + 86400000).toISOString().slice(0, 16))}>24 Hours</Button>
                      <Button variant="outline" size="sm" onClick={() => setExpiresAt(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16))}>7 Days</Button>
                      <Button variant="outline" size="sm" onClick={() => setExpiresAt(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16))}>1 Month</Button>
                      <Button variant="outline" size="sm" onClick={() => setExpiresAt('')}>Clear</Button>
                    </div>
                  </div>
                  <Button onClick={handleBan} disabled={loading || !reason} className="w-full" size="sm" variant="danger">
                    {loading ? 'Banning...' : 'Ban'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right: Active Bans */}
            <div className="flex-1">
              <h1 className="text-3xl text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600 font-extrabold mb-4">
                Active Bans
              </h1>
              {bansLoading ? (
                <Loader />
              ) : bansError ? (
                <ErrorScreen title="Error loading bans" message={bansError} onRetry={fetchBans} />
              ) : (
                <div className="space-y-3">
                  {bans.map((ban) => {
                    const loc = ban.ip_address ? ipLocations[ban.ip_address] : undefined;
                    return (
                      <div key={ban.id} className="bg-zinc-900 border-2 border-zinc-700 rounded-xl p-4">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0 space-y-2">
                            {/* Banned target */}
                            <div className="flex items-center gap-2">
                              {ban.user_id ? (
                                <Users className="w-4 h-4 text-red-400 shrink-0" />
                              ) : (
                                <Globe className="w-4 h-4 text-orange-400 shrink-0" />
                              )}
                              <div>
                                <p className="text-white font-semibold text-sm leading-tight">
                                  {ban.user_id
                                    ? (ban.target_username || ban.username || ban.user_id)
                                    : ban.ip_address}
                                </p>
                                {ban.user_id && (
                                  <p className="text-zinc-500 text-xs font-mono">{ban.user_id}</p>
                                )}
                                {ban.ip_address && loc && (
                                  <p className="text-zinc-400 text-xs flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3 h-3" />
                                    {loc.country_code && (
                                      <span>
                                        {loc.country_code.toUpperCase().replace(/./g, (c) =>
                                          String.fromCodePoint(c.charCodeAt(0) + 127397)
                                        )}
                                      </span>
                                    )}
                                    {[loc.city, loc.region, loc.country].filter(Boolean).join(', ')}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Reason */}
                            <p className="text-zinc-300 text-sm">
                              <span className="text-zinc-500">Reason:</span> {ban.reason}
                            </p>

                            {/* Times */}
                            <p className="text-zinc-500 text-xs">
                              {new Date(ban.banned_at).toLocaleString()}
                              {ban.expires_at && (
                                <span className="ml-2 text-yellow-500/80">
                                  · Expires {new Date(ban.expires_at).toLocaleString()}
                                </span>
                              )}
                            </p>

                            {/* Mod who banned */}
                            <div className="flex items-center gap-2 pt-1 border-t border-zinc-700/60">
                              <img
                                src={getModAvatar(ban)}
                                alt={ban.banned_by_username || ban.banned_by}
                                className="w-5 h-5 rounded-full"
                                onError={(e) => { (e.target as HTMLImageElement).src = '/assets/app/default/avatar.webp'; }}
                              />
                              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                                <span>Banned by</span>
                                <span className="text-zinc-200 font-medium">
                                  {ban.banned_by_username || ban.banned_by}
                                </span>
                                {ban.banned_by_username && (
                                  <span className="text-zinc-600 font-mono">({ban.banned_by})</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <Button size="sm" variant="outline" onClick={() => handleUnban(ban.user_id || ban.ip_address!)} className="shrink-0">
                            <X className="w-4 h-4" />
                            Unban
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {bans.length === 0 && <div className="text-zinc-400">No active bans.</div>}
                </div>
              )}
            </div>
          </div>

          {/* VPN Gate Section */}
          <div className="border-t border-zinc-800 pt-8">
            <div className="flex items-center mb-6">
              <Shield className="h-8 w-8 sm:h-10 sm:w-10 text-orange-400 mr-4" />
              <h2 className="text-4xl text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600 font-extrabold">
                VPN Gate
              </h2>
            </div>

            {vpnGateLoading ? (
              <Loader />
            ) : vpnGateError ? (
              <ErrorScreen title="Error loading VPN gate" message={vpnGateError} onRetry={fetchVpnGateData} />
            ) : (
              <div className="flex flex-col lg:flex-row lg:space-x-8 space-y-8 lg:space-y-0">
                {/* Left: Controls */}
                <div className="flex-1 max-w-lg space-y-6">
                  {/* Gate toggle — tester gate style */}
                  <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`p-3 rounded-xl mr-4 ${vpnGateEnabled ? 'bg-orange-500/20' : 'bg-red-500/20'}`}>
                          {vpnGateEnabled ? (
                            <ShieldCheck className="h-6 w-6 text-orange-400" />
                          ) : (
                            <ShieldX className="h-6 w-6 text-red-400" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">VPN Gate</h3>
                          <p className="text-zinc-400 text-sm">
                            {vpnGateEnabled
                              ? 'VPN/proxy users are blocked unless excepted'
                              : 'All users can access the application'}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={handleToggleVpnGate}
                        disabled={vpnToggleLoading}
                        variant={vpnGateEnabled ? 'danger' : 'primary'}
                        className="px-6 shrink-0"
                      >
                        {vpnToggleLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <span className="hidden lg:inline">
                              {vpnGateEnabled ? 'Disable Gate' : 'Enable Gate'}
                            </span>
                            <span className="lg:hidden">
                              {vpnGateEnabled ? <ShieldX className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                            </span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Add Exception Form */}
                  <div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-6">
                    <h3 className="text-white font-semibold mb-4">Add VPN Exception</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-zinc-300 text-sm mb-1">
                          User ID <span className="text-red-400">*</span>
                        </label>
                        <TextInput value={exceptionUserIdInput} onChange={setExceptionUserIdInput} className="w-full bg-zinc-800 rounded p-2 text-white" />
                      </div>
                      <div>
                        <label className="block text-zinc-300 text-sm mb-1">Notes (optional)</label>
                        <TextInput value={exceptionNotesInput} onChange={setExceptionNotesInput} className="w-full bg-zinc-800 rounded p-2 text-white" />
                      </div>
                      <Button onClick={handleAddException} disabled={addExceptionLoading || !exceptionUserIdInput} className="w-full" size="sm" variant="primary">
                        {addExceptionLoading ? 'Adding...' : 'Add Exception'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Right: Exceptions List */}
                <div className="flex-1">
                  <h3 className="text-xl text-white font-semibold mb-4">
                    VPN Exceptions ({vpnExceptions.length})
                  </h3>
                  <div className="space-y-3">
                    {vpnExceptions.map((ex) => (
                      <div key={ex.user_id} className="bg-zinc-900 border-2 border-zinc-700 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-white font-medium">{ex.username}</p>
                            <p className="text-zinc-500 text-xs font-mono">{ex.user_id}</p>
                            {ex.notes && <p className="text-zinc-400 text-sm mt-1">{ex.notes}</p>}
                            <p className="text-zinc-500 text-xs mt-1">
                              Added by {ex.added_by_username}
                              {ex.created_at && ` · ${new Date(ex.created_at).toLocaleDateString()}`}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => handleRemoveException(ex.user_id)}>
                            <X className="w-4 h-4" />Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                    {vpnExceptions.length === 0 && <div className="text-zinc-400">No exceptions added.</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <button onClick={() => setMobileSidebarOpen(true)} className="lg:hidden fixed bottom-6 right-6 z-30 p-4 bg-red-600 hover:bg-red-700 rounded-full shadow-lg transition-colors">
        <Menu className="h-6 w-6 text-white" />
      </button>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
