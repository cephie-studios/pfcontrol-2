import { useState, useEffect, useRef } from 'react';
import {
	Info,
	MessageCircle,
	Settings,
	Wifi,
	WifiOff,
	RefreshCw
} from 'lucide-react';
import { io } from 'socket.io-client';
import { createSessionUsersSocket } from '../../sockets/sessionUsersSocket';
import { useAuth } from '../../hooks/auth/useAuth';
import type { Position, SessionUser } from '../../types/session';
import WindDisplay from './WindDisplay';
import Button from '../common/Button';
import RunwayDropdown from '../dropdowns/RunwayDropdown';
import Dropdown from '../common/Dropdown';
import FrequencyDisplay from './FrequencyDisplay';
import ChatSidebar from './ChatSidebar';

interface ToolbarProps {
	sessionId?: string;
	accessId?: string;
	icao: string | null;
}

export default function Toolbar({ icao, sessionId, accessId }: ToolbarProps) {
	const [runway, setRunway] = useState('');
	const [position, setPosition] = useState<Position | null>(null);
	const [chatOpen, setChatOpen] = useState(false);
	const [activeUsers, setActiveUsers] = useState<SessionUser[]>([]);
	const [connectionStatus, setConnectionStatus] = useState<
		'Connected' | 'Reconnecting' | 'Disconnected'
	>('Disconnected');
	const [tooltipUser, setTooltipUser] = useState<SessionUser | null>(null);
	const socketRef = useRef<ReturnType<typeof io> | null>(null);
	const { user } = useAuth();

	const handleRunwayChange = (selectedRunway: string) => {
		setRunway(selectedRunway);
	};

	const handlePositionChange = (selectedPosition: string) => {
		setPosition(selectedPosition as Position);
	};

	const getAvatarUrl = (userId: string, avatar: string | null) => {
		if (!avatar) return '/assets/app/default/avatar.webp';
		return avatar;
	};

	useEffect(() => {
		if (!sessionId || !accessId || !user) return;

		socketRef.current = createSessionUsersSocket(
			sessionId,
			accessId,
			{
				userId: user.userId,
				username: user.username,
				avatar: user.avatar
			},
			(users: SessionUser[]) => setActiveUsers(users),
			() => setConnectionStatus('Connected'),
			() => setConnectionStatus('Disconnected'),
			() => setConnectionStatus('Reconnecting'),
			() => setConnectionStatus('Connected')
		);

		return () => {
			if (socketRef.current) {
				socketRef.current.disconnect();
			}
		};
	}, [sessionId, accessId, user]);

	const getStatusColor = () => {
		switch (connectionStatus) {
			case 'Connected':
				return 'text-green-500';
			case 'Reconnecting':
				return 'text-yellow-500';
			case 'Disconnected':
				return 'text-red-500';
		}
	};

	const getStatusIcon = () => {
		switch (connectionStatus) {
			case 'Connected':
				return <Wifi className="w-5 h-5 text-green-500" />;
			case 'Reconnecting':
				return (
					<RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />
				);
			case 'Disconnected':
				return <WifiOff className="w-5 h-5 text-red-500" />;
		}
	};

	return (
		<div
			className="
                toolbar
                flex items-center justify-between w-full px-4 py-2
                gap-2
                lg:flex-row lg:gap-4 lg:items-center
                md:flex-col md:items-start md:gap-3
                sm:flex-col sm:items-start sm:gap-2
            "
		>
			<div
				className="
                    wind-frequency-group
                    flex items-center gap-4
                    lg:gap-4
                    md:gap-3
                    sm:gap-2
                "
			>
				<WindDisplay icao={icao} size="small" />
				<FrequencyDisplay airportIcao={icao ?? ''} />
			</div>

			<div className="flex flex-col items-center gap-1 flex-1 relative">
				<div className="relative flex">
					{activeUsers.slice(0, 5).map((user, index) => (
						<img
							key={user.id}
							src={getAvatarUrl(user.id, user.avatar)}
							alt={user.username}
							className="w-8 h-8 rounded-full border-2 border-white shadow-md cursor-pointer"
							onError={(e) => {
								e.currentTarget.src =
									'/assets/app/default/avatar.webp';
							}}
							onMouseEnter={() => setTooltipUser(user)}
							onMouseLeave={() => setTooltipUser(null)}
							style={{
								position: 'relative',
								left: `${index * -10}px`,
								zIndex: 10 - index
							}}
						/>
					))}
					{activeUsers.length > 5 && (
						<div
							className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs font-bold"
							style={{ position: 'relative', left: '-50px' }}
						>
							+{activeUsers.length - 5}
						</div>
					)}
				</div>
				{tooltipUser && (
					<div className="absolute top-[-40px] left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded shadow-lg z-50">
						{tooltipUser.username}
					</div>
				)}
				<div className="flex items-center gap-1">
					{getStatusIcon()}
					<span className={`text-xs ${getStatusColor()}`}>
						{connectionStatus}
					</span>
				</div>
			</div>

			<div
				className="
                    flex items-center gap-4
                    lg:gap-4
                    md:gap-3
                    sm:gap-2
                    flex-wrap
                "
			>
				<Dropdown
					options={[
						{ value: 'ALL', label: 'All' },
						{ value: 'DEL', label: 'Delivery' },
						{ value: 'GND', label: 'Ground' },
						{ value: 'TWR', label: 'Tower' },
						{ value: 'APP', label: 'Approach' }
					]}
					value={position || ''}
					onChange={handlePositionChange}
					placeholder="Select Position"
					disabled={!icao}
					size="sm"
					className="min-w-[100px]"
				/>

				<RunwayDropdown
					airportIcao={icao ?? ''}
					onChange={handleRunwayChange}
					value={runway}
					size="sm"
				/>

				<Button
					className="flex items-center gap-2 px-4 py-2"
					aria-label="Settings"
					size="sm"
					variant="outline"
				>
					<Info className="w-5 h-5" />
					<span className="hidden sm:inline font-medium">ATIS</span>
				</Button>

				<Button
					className="flex items-center gap-2 px-4 py-2"
					aria-label="Settings"
					size="sm"
					onClick={() => setChatOpen(!chatOpen)}
				>
					<MessageCircle className="w-5 h-5" />
					<span className="hidden sm:inline font-medium">Chat</span>
				</Button>

				<ChatSidebar
					sessionId={sessionId ?? ''}
					accessId={accessId ?? ''}
					open={chatOpen}
					onClose={() => setChatOpen(false)}
				/>

				<Button
					className="flex items-center gap-2 px-4 py-2"
					aria-label="Settings"
					size="sm"
				>
					<Settings className="w-5 h-5" />
					<span className="hidden sm:inline font-medium">
						Settings
					</span>
				</Button>
			</div>
		</div>
	);
}
