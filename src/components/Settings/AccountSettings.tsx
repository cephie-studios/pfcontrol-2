import { useAuth } from '../../hooks/auth/useAuth';
import { Link2, ExternalLink, UserX, TowerControl } from 'lucide-react';
import { SiRoblox } from 'react-icons/si';
import Button from '../common/Button';

export default function AccountSettings() {
    const { user, refreshUser } = useAuth();
    const isVatsimLinked = !!(
        user?.vatsimCid || user?.vatsimRatingShort || user?.vatsimRatingLong
    );

    const handleLinkRoblox = () => {
        window.location.href = `${
            import.meta.env.VITE_SERVER_URL
        }/api/auth/roblox`;
    };

    const handleLinkVatsim = () => {
        // Always force VATSIM to show the login/consent screen when linking
        window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/vatsim?force=1`;
    };

    const handleUnlinkVatsim = async () => {
        if (!confirm('Unlink your VATSIM account?')) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/auth/vatsim/unlink`, {
                method: 'POST',
                credentials: 'include',
            });
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
        if (!confirm('Are you sure you want to unlink your Roblox account?')) {
            return;
        }

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

    return (
        <div className="bg-zinc-800/50 backdrop-blur-sm rounded-2xl border-2 border-zinc-800 p-6">
            <div className="flex items-center mb-6">
                <div className="p-2 bg-blue-500/20 rounded-lg mr-3">
                    <Link2 className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">
                        Account Connections
                    </h2>
                    <p className="text-sm text-zinc-400">
                        Link your accounts to enable additional features
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Roblox Account */}
                <div className="bg-zinc-800/50 rounded-xl border-2 border-zinc-700/50 p-5 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                            <SiRoblox className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold text-base">
                                Roblox Account
                            </h3>
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
                                    Link your Roblox account to track flights in
                                    your logbook
                                </p>
                            )}
                        </div>
                    </div>

                    <div>
                        {user?.robloxUsername ? (
                            <Button
                                onClick={handleUnlinkRoblox}
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
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                            <TowerControl className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold text-base">VATSIM Account</h3>
                            {isVatsimLinked ? (
                                <div className="flex items-center space-x-2 mt-1">
                                    <span className="text-green-400 text-sm font-medium">Connected</span>
                                    <span className="text-zinc-500">•</span>
                                    <span className="text-zinc-300 text-sm">{user?.vatsimRatingShort || user?.vatsimRatingLong || `CID ${user?.vatsimCid}`}</span>
                                </div>
                            ) : (
                                <p className="text-zinc-400 text-sm mt-1">Link your VATSIM account to show controller rating on your profile</p>
                            )}
                        </div>
                    </div>
                    <div>
                        {isVatsimLinked ? (
                            <Button onClick={handleUnlinkVatsim} variant="outline" size="sm" className="border-red-700/50 text-red-400 hover:bg-red-900/20 hover:border-red-600">
                                <UserX className="w-4 h-4 mr-2" />
                                Unlink
                            </Button>
                        ) : (
                            <Button onClick={handleLinkVatsim} variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Link Account
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
