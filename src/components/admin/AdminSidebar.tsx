import { Link, useLocation } from 'react-router-dom';
import {
	BarChart3,
	Users,
	Database,
	ChevronLeft,
	ChevronRight,
	Shield,
	ChevronDown,
	Ban,
	LayoutDashboard,
	ShieldAlert
} from 'lucide-react';
import { useState, useEffect } from 'react';
import ProtectedRoute from '../ProtectedRoute';

interface AdminSidebarProps {
	collapsed?: boolean;
	onToggle?: () => void;
}

export default function AdminSidebar({
	collapsed = false,
	onToggle
}: AdminSidebarProps) {
	const location = useLocation();

	const [generalCollapsed, setGeneralCollapsed] = useState(false);
	const [usersCollapsed, setUsersCollapsed] = useState(false);
	const [showText, setShowText] = useState(!collapsed);

	useEffect(() => {
		if (!collapsed) {
			const timer = setTimeout(() => setShowText(true), 300);
			return () => clearTimeout(timer);
		} else {
			setShowText(false);
		}
	}, [collapsed]);

	const sections = [
		{
			title: 'General',
			icon: LayoutDashboard,
			collapsed: generalCollapsed,
			setCollapsed: setGeneralCollapsed,
			items: [
				{
					icon: BarChart3,
					label: 'Overview',
					path: '/admin'
				},
				{
					icon: Users,
					label: 'Users',
					path: '/admin/users'
				},
				{
					icon: Database,
					label: 'Sessions',
					path: '/admin/sessions'
				}
			]
		},
		{
			title: 'Security',
			icon: Shield,
			collapsed: usersCollapsed,
			setCollapsed: setUsersCollapsed,
			items: [
				{
					icon: Ban,
					label: 'Bans',
					path: '/admin/bans'
				},
				{
					icon: ShieldAlert,
					label: 'Audit Log',
					path: '/admin/audit',
					textColor: 'orange-400'
				}
			]
		}
	];

	const allItems = sections.flatMap((section) => section.items);

	return (
		<ProtectedRoute requireAdmin={true}>
			<div
				className={`bg-black border-r border-zinc-700/50 transition-all duration-300 h-fit-screen ${
					collapsed ? 'w-16' : 'w-64'
				} flex flex-col`}
			>
				{/* Header */}
				<div className="p-4 border-b border-zinc-700/50">
					<div className="flex items-center justify-between">
						{!collapsed && (
							<div className="flex items-center space-x-3">
								<div className="p-2 bg-blue-500/20 rounded-lg">
									<LayoutDashboard className="w-5 h-5 text-blue-400" />
								</div>
								<div
									className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${
										showText
											? 'w-auto opacity-100'
											: 'w-0 opacity-0'
									}`}
								>
									<h2 className="text-white font-semibold">
										Admin Panel
									</h2>
								</div>
							</div>
						)}
						<button
							onClick={onToggle}
							className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
						>
							{collapsed ? (
								<ChevronRight className="w-4 h-4" />
							) : (
								<ChevronLeft className="w-4 h-4" />
							)}
						</button>
					</div>
				</div>

				{/* Navigation */}
				<nav className="flex-1 p-4">
					{collapsed ? (
						<div className="space-y-1">
							{allItems.map((item) => {
								const Icon = item.icon;
								const isActive =
									location.pathname === item.path;

								return (
									<Link
										key={item.path}
										to={item.path}
										className={`
                                            flex items-center justify-center px-3 py-3 rounded-xl transition-all duration-200
                                            ${
												isActive
													? 'text-blue-400'
													: 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
											}
                                        `}
										title={item.label}
									>
										<Icon className="w-5 h-5 flex-shrink-0" />
									</Link>
								);
							})}
						</div>
					) : (
						<div className="space-y-2">
							{sections.map((section) => {
								const SectionIcon = section.icon;
								return (
									<div key={section.title}>
										<button
											onClick={() =>
												section.setCollapsed(
													!section.collapsed
												)
											}
											className="flex items-center justify-between w-full px-3 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-all duration-200"
										>
											<div className="flex items-center space-x-2">
												<SectionIcon className="w-4 h-4 flex-shrink-0" />
												<span className="font-medium">
													{section.title}
												</span>
											</div>
											{section.collapsed ? (
												<ChevronRight className="w-4 h-4" />
											) : (
												<ChevronDown className="w-4 h-4" />
											)}
										</button>
										<div
											className={`overflow-hidden transition-all duration-300 ease-in-out ${
												section.collapsed
													? 'max-h-0 opacity-0'
													: 'max-h-96 opacity-100'
											}`}
										>
											<div className="space-y-1 ml-2">
												{section.items.map((item) => {
													const Icon = item.icon;
													const isActive =
														location.pathname ===
														item.path;

													return (
														<Link
															key={item.path}
															to={item.path}
															className={`
                                                            flex items-center space-x-3 px-3 py-3 rounded-xl transition-all duration-200
                                                            ${
																isActive
																	? `text-${
																			item.textColor ||
																			'blue-400'
																	  }`
																	: 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
															}
                                                        `}
														>
															<Icon className="w-5 h-5 flex-shrink-0" />
															<div className="flex-1 min-w-0">
																<div className="font-medium">
																	{item.label}
																</div>
															</div>
														</Link>
													);
												})}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</nav>
			</div>
		</ProtectedRoute>
	);
}
