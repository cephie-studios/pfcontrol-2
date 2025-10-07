import { useAuth } from '../../hooks/auth/useAuth';
import { Link2, ExternalLink, UserX } from 'lucide-react';
import { SiRoblox } from "react-icons/si";
import Button from '../common/Button';

export default function AccountSettings() {
    const { user, refreshUser } = useAuth();

    const handleLinkRoblox = () => {
        window.location.href = `${import.meta.env.VITE_SERVER_URL}/api/auth/roblox`;
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
                    credentials: 'include'
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
        <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl border-2 border-zinc-800 p-6">
            <div className="flex items-center mb-6">
                <div className="p-2 bg-blue-500/20 rounded-lg mr-3">
                    <Link2 className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Account Connections</h2>
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
                                    Link your Roblox account to track flights in your logbook
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
            </div>
        </div>
    );
}
