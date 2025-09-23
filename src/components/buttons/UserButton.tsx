import { useState, useRef, useEffect } from 'react';
import { User, LogOut, Settings, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/auth/useAuth';

interface CustomUserButtonProps {
	className?: string;
	isMobile?: boolean;
}

export default function CustomUserButton({
	className = '',
	isMobile = false
}: CustomUserButtonProps) {
	const { user, isLoading, login, logout } = useAuth();
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsDropdownOpen(false);
			}
		};

		if (isDropdownOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isDropdownOpen]);

	if (isLoading) {
		return (
			<div className={`${isMobile ? 'w-full mt-2' : ''} ${className}`}>
				<div className="bg-gray-700 animate-pulse rounded-full px-4 py-2 h-10"></div>
			</div>
		);
	}

	if (!user) {
		const baseClasses = isMobile
			? 'w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2 rounded-full font-medium transition-all duration-300'
			: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2 rounded-full font-medium transition-all duration-300 shadow-lg hover:shadow-xl';

		return (
			<button onClick={login} className={`${baseClasses} ${className}`}>
				Sign In with Discord
			</button>
		);
	}

	if (isMobile) {
		return (
			<div className={`w-full mt-2 space-y-2 ${className}`}>
				<div className="flex items-center space-x-3 px-3 py-2 bg-gray-700 rounded-lg">
					{user.avatar ? (
						<img
							src={user.avatar}
							alt={user.username}
							className="w-8 h-8 rounded-full"
						/>
					) : (
						<div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
							<User className="w-5 h-5 text-white" />
						</div>
					)}
					<div className="flex-1">
						<p className="text-white font-medium text-sm">
							{user.username}
						</p>
						{user.isAdmin && (
							<p className="text-blue-400 text-xs">Admin</p>
						)}
					</div>
				</div>
				<button
					onClick={logout}
					className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300"
				>
					<LogOut className="w-4" />
					<span>Sign Out</span>
				</button>
			</div>
		);
	}

	return (
		<div className={`relative ${className}`} ref={dropdownRef}>
			<button
				onClick={() => setIsDropdownOpen(!isDropdownOpen)}
				className="flex items-center space-x-3 bg-gray-800/70 backdrop-blur-sm border border-blue-600 hover:border-blue-500 text-white px-4 py-2 rounded-full font-medium transition-all duration-300 shadow-lg hover:shadow-xl hover:bg-gray-700/70"
			>
				{user.avatar ? (
					<img
						src={user.avatar}
						alt={user.username}
						className="w-8 h-8 rounded-full ring-2 ring-blue-500/30"
					/>
				) : (
					<div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center">
						<User className="w-5 h-5 text-white" />
					</div>
				)}
				<span className="hidden md:block font-semibold">
					{user.username}
				</span>
				<ChevronDown
					className={`w-4 h-4 text-blue-400 transition-transform duration-200 ${
						isDropdownOpen ? 'rotate-180' : ''
					}`}
				/>
			</button>

			{isDropdownOpen && (
				<div className="absolute right-0 mt-2 w-64 bg-gray-800/90 backdrop-blur-md border border-blue-600 rounded-2xl shadow-2xl py-2 z-50 animate-in slide-in-from-top-1 duration-200">
					<div className="px-4 py-3 border-b border-gray-700/50">
						<div className="flex items-center space-x-3">
							{user.avatar ? (
								<img
									src={user.avatar}
									alt={user.username}
									className="w-10 h-10 rounded-full ring-2 ring-blue-500/30"
								/>
							) : (
								<div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center">
									<User className="w-6 h-6 text-white" />
								</div>
							)}
							<div className="flex-1">
								<p className="text-white font-semibold text-sm">
									{user.username}
								</p>
								{user.isAdmin && (
									<div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 mt-1">
										Administrator
									</div>
								)}
							</div>
						</div>
					</div>

					<div className="py-1">
						<button
							onClick={() => {
								setIsDropdownOpen(false);
								// Add profile/settings functionality here
							}}
							className="w-full flex items-center space-x-3 px-4 py-3 text-gray-300 hover:bg-blue-600/20 hover:text-white transition-all duration-200 group"
						>
							<Settings className="w-4 h-4 group-hover:rotate-45 transition-transform duration-200" />
							<span className="font-medium">Settings</span>
						</button>

						<button
							onClick={() => {
								setIsDropdownOpen(false);
								logout();
							}}
							className="w-full flex items-center space-x-3 px-4 py-3 text-red-400 hover:bg-red-600/20 hover:text-red-300 transition-all duration-200 group"
						>
							<LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
							<span className="font-medium">Sign Out</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
