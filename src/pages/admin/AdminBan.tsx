import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Ban, Users, Globe, X, Menu } from 'lucide-react';
import { banUser, unbanUser, fetchAllBans } from '../../utils/fetch/admin';
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
  reason: string;
  banned_by: string;
  banned_at: string;
  expires_at?: string;
  active: boolean;
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
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  useEffect(() => {
    fetchBans();
  }, []);

  const fetchBans = async () => {
    try {
      setBansLoading(true);
      const data = await fetchAllBans();
      setBans(
        (data.bans as unknown as BanRecord[]).filter((ban) => ban.active)
      );
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

  const handleBan = async () => {
    setLoading(true);
    try {
      if (banType === 'user' && !userIdInput) {
        throw new Error('User ID is required');
      }
      if (banType === 'ip' && !ipInput) {
        throw new Error('IP address is required');
      }
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
      fetchBans();
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
      setToast({
        message: 'Successfully unbanned',
        type: 'success',
      });
      fetchBans();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to unban',
        type: 'error',
      });
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="flex pt-16">
        {/* Mobile Overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <AdminSidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Mobile Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 lg:hidden ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <AdminSidebar
            collapsed={false}
            onToggle={() => setMobileSidebarOpen(false)}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row lg:space-x-8 space-y-8 lg:space-y-0">
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
                {/* Ban Type Toggle */}
                <div>
                  <label className="block text-zinc-300 mb-2">Ban Type</label>
                  <div className="flex space-x-4">
                    <Button
                      variant={banType === 'user' ? 'primary' : 'outline'}
                      onClick={() => setBanType('user')}
                      className="flex items-center space-x-2"
                      size="sm"
                    >
                      <Users className="w-4 h-4" />
                      <span>By User ID</span>
                    </Button>
                    <Button
                      variant={banType === 'ip' ? 'primary' : 'outline'}
                      onClick={() => setBanType('ip')}
                      className="flex items-center space-x-2"
                      size="sm"
                    >
                      <Globe className="w-4 h-4" />
                      <span>By IP</span>
                    </Button>
                  </div>
                </div>

                {banType === 'user' && (
                  <>
                    <div>
                      <label className="block text-zinc-300 mb-2">
                        User ID
                      </label>
                      <TextInput
                        value={userIdInput}
                        onChange={setUserIdInput}
                        className="w-full bg-zinc-800 rounded p-2 text-white"
                      />
                    </div>
                  </>
                )}

                {banType === 'ip' && (
                  <div>
                    <label className="block text-zinc-300 mb-2">
                      IP Address
                    </label>
                    <TextInput
                      value={ipInput}
                      onChange={setIpInput}
                      className="w-full bg-zinc-800 rounded p-2 text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-zinc-300 mb-2">Reason</label>
                  <TextInput
                    value={reason}
                    onChange={setReason}
                    className="w-full bg-zinc-800 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 mb-2">
                    Expires At (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full bg-zinc-800 rounded p-2 text-white"
                  />
                  <div className="flex space-x-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const future = new Date(
                          Date.now() + 24 * 60 * 60 * 1000
                        );
                        setExpiresAt(future.toISOString().slice(0, 16));
                      }}
                    >
                      24 Hours
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const future = new Date(
                          Date.now() + 7 * 24 * 60 * 60 * 1000
                        );
                        setExpiresAt(future.toISOString().slice(0, 16));
                      }}
                    >
                      7 Days
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const future = new Date(
                          Date.now() + 30 * 24 * 60 * 60 * 1000
                        );
                        setExpiresAt(future.toISOString().slice(0, 16));
                      }}
                    >
                      1 Month
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpiresAt('')}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={handleBan}
                  disabled={loading || !reason}
                  className="w-full"
                  size="sm"
                  variant="danger"
                >
                  {loading ? 'Banning...' : 'Ban'}
                </Button>
              </div>
            </div>
          </div>

          {/* Right: Ban List */}
          <div className="flex-1">
            <h1 className="text-3xl text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600 font-extrabold mb-2">
              Active Bans
            </h1>
            {bansLoading ? (
              <Loader />
            ) : bansError ? (
              <ErrorScreen
                title="Error loading bans"
                message={bansError}
                onRetry={fetchBans}
              />
            ) : (
              <div className="space-y-4">
                {bans.map((ban) => (
                  <div
                    key={ban.id}
                    className="bg-zinc-900 border-2 border-zinc-700 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white font-medium">
                          {ban.user_id
                            ? `User: ${ban.username || ban.user_id}`
                            : `IP: ${ban.ip_address}`}
                        </p>
                        <p className="text-zinc-400 text-sm">
                          Reason: {ban.reason}
                        </p>
                        <p className="text-zinc-400 text-sm">
                          Banned: {new Date(ban.banned_at).toLocaleString()}
                          {ban.expires_at &&
                            ` | Expires: ${new Date(
                              ban.expires_at
                            ).toLocaleString()}`}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleUnban(ban.user_id || ban.ip_address!)
                        }
                      >
                        <X className="w-4 h-4" />
                        Unban
                      </Button>
                    </div>
                  </div>
                ))}
                {bans.length === 0 && (
                  <div className="text-zinc-400">No active bans.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-30 p-4 bg-red-600 hover:bg-red-700 rounded-full shadow-lg transition-colors"
      >
        <Menu className="h-6 w-6 text-white" />
      </button>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
