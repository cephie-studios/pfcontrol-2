import { useState, useEffect } from 'react';
import {
	ShieldAlert,
	Search,
	Filter,
	Calendar,
	User,
	Eye,
	Clock
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import AdminSidebar from '../../components/admin/AdminSidebar';
import Loader from '../../components/common/Loader';
import ProtectedRoute from '../../components/ProtectedRoute';
import Dropdown from '../../components/common/Dropdown';
import {
	fetchAuditLogs,
	type AuditLogsResponse,
	type AuditLog
} from '../../utils/fetch/admin';
import Button from '../../components/common/Button';

export default function AdminAudit() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [logs, setLogs] = useState<AuditLog[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [limit] = useState(50);
	const [totalPages, setTotalPages] = useState(1);

	// Filter states
	const [adminFilter, setAdminFilter] = useState('');
	const [actionTypeFilter, setActionTypeFilter] = useState('');
	const [targetUserFilter, setTargetUserFilter] = useState('');
	const [dateFromFilter, setDateFromFilter] = useState('');
	const [dateToFilter, setDateToFilter] = useState('');

	// Modal state
	const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
	const [showDetails, setShowDetails] = useState(false);

	const actionTypeOptions = [
		{ value: '', label: 'All Actions' },
		{ value: 'ADMIN_DASHBOARD_ACCESSED', label: 'Dashboard Access' },
		{ value: 'ADMIN_USERS_ACCESSED', label: 'Users Page Access' },
		{ value: 'ADMIN_SESSIONS_ACCESSED', label: 'Sessions Access' },
		{ value: 'ADMIN_SYSTEM_INFO_ACCESSED', label: 'System Info Access' },
		{ value: 'ADMIN_AUDIT_LOGS_ACCESSED', label: 'Audit Logs Access' },
		{ value: 'IP_ADDRESS_VIEWED', label: 'IP Address Revealed' }
	];

	useEffect(() => {
		fetchLogs();
	}, [
		page,
		adminFilter,
		actionTypeFilter,
		targetUserFilter,
		dateFromFilter,
		dateToFilter
	]);

	const fetchLogs = async () => {
		try {
			setLoading(true);
			setError(null);

			const filters = {
				adminId: adminFilter || undefined,
				actionType: actionTypeFilter || undefined,
				targetUserId: targetUserFilter || undefined,
				dateFrom: dateFromFilter || undefined,
				dateTo: dateToFilter || undefined
			};

			const data: AuditLogsResponse = await fetchAuditLogs(
				page,
				limit,
				filters
			);
			setLogs(data.logs);
			setTotalPages(data.pagination.pages);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: 'Failed to fetch audit logs'
			);
		} finally {
			setLoading(false);
		}
	};

	const handleAdminFilterChange = (
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		setAdminFilter(e.target.value);
		setPage(1);
	};

	const handleTargetUserFilterChange = (
		e: React.ChangeEvent<HTMLInputElement>
	) => {
		setTargetUserFilter(e.target.value);
		setPage(1);
	};

	const handleActionTypeChange = (value: string) => {
		setActionTypeFilter(value);
		setPage(1);
	};

	const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setDateFromFilter(e.target.value);
		setPage(1);
	};

	const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setDateToFilter(e.target.value);
		setPage(1);
	};

	const handleViewDetails = (log: AuditLog) => {
		setSelectedLog(log);
		setShowDetails(true);
	};

	const closeDetailsModal = () => {
		setShowDetails(false);
		setSelectedLog(null);
	};

	const clearFilters = () => {
		setAdminFilter('');
		setActionTypeFilter('');
		setTargetUserFilter('');
		setDateFromFilter('');
		setDateToFilter('');
		setPage(1);
	};

	const formatActionType = (actionType: string) => {
		switch (actionType) {
			case 'ADMIN_DASHBOARD_ACCESSED':
				return 'Dashboard Access';
			case 'ADMIN_USERS_ACCESSED':
				return 'Users Page Access';
			case 'ADMIN_SESSIONS_ACCESSED':
				return 'Sessions Access';
			case 'ADMIN_SYSTEM_INFO_ACCESSED':
				return 'System Info Access';
			case 'ADMIN_AUDIT_LOGS_ACCESSED':
				return 'Audit Logs Access';
			case 'IP_ADDRESS_VIEWED':
				return 'IP Address Revealed';
			default:
				return actionType;
		}
	};

	const getActionIcon = (actionType: string) => {
		switch (actionType) {
			case 'IP_ADDRESS_VIEWED':
				return <Eye className="w-4 h-4 text-orange-400" />;
			case 'ADMIN_DASHBOARD_ACCESSED':
				return <ShieldAlert className="w-4 h-4 text-blue-400" />;
			case 'ADMIN_USERS_ACCESSED':
				return <User className="w-4 h-4 text-green-400" />;
			default:
				return <ShieldAlert className="w-4 h-4 text-zinc-400" />;
		}
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	};

	return (
		<ProtectedRoute requireAdmin={true}>
			<div className="min-h-screen bg-black text-white">
				<Navbar />
				<div className="flex pt-16">
					<AdminSidebar
						collapsed={sidebarCollapsed}
						onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
					/>
					<div className="flex-1 p-8">
						{/* Header */}
						<div className="mb-8">
							<div className="flex items-center mb-4">
								<div className="p-3 bg-orange-500/20 rounded-xl mr-4">
									<ShieldAlert className="h-8 w-8 text-orange-400" />
								</div>
								<h1
									className="text-5xl text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 font-extrabold mb-2"
									style={{ lineHeight: 1.4 }}
								>
									Audit Log
								</h1>
							</div>

							{/* Filters */}
							<div className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
									{/* Admin Filter */}
									<div className="relative">
										<User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
										<input
											type="text"
											placeholder="Filter by admin username..."
											value={adminFilter}
											onChange={handleAdminFilterChange}
											className="w-full pl-10 pr-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
										/>
									</div>

									{/* Target User Filter */}
									<div className="relative">
										<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
										<input
											type="text"
											placeholder="Filter by target user..."
											value={targetUserFilter}
											onChange={
												handleTargetUserFilterChange
											}
											className="w-full pl-10 pr-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
										/>
									</div>

									{/* Action Type Filter */}
									<div className="relative">
										<Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400 z-10 ml-3" />
										<Dropdown
											size="sm"
											options={actionTypeOptions}
											value={actionTypeFilter}
											onChange={handleActionTypeChange}
											placeholder="Filter by action..."
											className="pl-10"
										/>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									{/* Date From */}
									<div className="relative">
										<Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
										<input
											type="datetime-local"
											placeholder="From date..."
											value={dateFromFilter}
											onChange={handleDateFromChange}
											className="w-full pl-10 pr-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
										/>
									</div>

									{/* Date To */}
									<div className="relative">
										<Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
										<input
											type="datetime-local"
											placeholder="To date..."
											value={dateToFilter}
											onChange={handleDateToChange}
											className="w-full pl-10 pr-4 py-2 bg-zinc-900 border-2 border-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
										/>
									</div>

									{/* Clear Filters */}
									<Button
										onClick={clearFilters}
										variant="outline"
										size="sm"
										className="h-10"
									>
										Clear Filters
									</Button>
								</div>
							</div>
						</div>

						{loading ? (
							<div className="flex justify-center py-12">
								<Loader />
							</div>
						) : error ? (
							<div className="text-center py-12">
								<div className="text-red-400 mb-2">
									Error loading audit logs
								</div>
								<div className="text-zinc-400 text-sm">
									{error}
								</div>
								<button
									onClick={fetchLogs}
									className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
								>
									Retry
								</button>
							</div>
						) : (
							<>
								{/* Audit Logs Table */}
								<div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl overflow-hidden">
									<table className="w-full">
										<thead className="bg-zinc-800">
											<tr>
												<th className="px-6 py-4 text-left text-zinc-400 font-medium">
													Action
												</th>
												<th className="px-6 py-4 text-left text-zinc-400 font-medium">
													Admin
												</th>
												<th className="px-6 py-4 text-left text-zinc-400 font-medium">
													Target User
												</th>
												<th className="px-6 py-4 text-left text-zinc-400 font-medium">
													Timestamp
												</th>
												<th className="px-6 py-4 text-left text-zinc-400 font-medium">
													IP Address
												</th>
												<th className="px-6 py-4 text-left text-zinc-400 font-medium">
													Details
												</th>
											</tr>
										</thead>
										<tbody>
											{logs.map((log) => (
												<tr
													key={log.id}
													className="border-t border-zinc-700/50 hover:bg-zinc-800/50"
												>
													<td className="px-6 py-4">
														<div className="flex items-center space-x-3">
															{getActionIcon(
																log.action_type
															)}
															<span className="text-white font-medium">
																{formatActionType(
																	log.action_type
																)}
															</span>
														</div>
													</td>
													<td className="px-6 py-4 text-zinc-300">
														<div className="flex flex-col">
															<span className="font-medium">
																{
																	log.admin_username
																}
															</span>
															<span className="text-xs text-zinc-500">
																{log.admin_id}
															</span>
														</div>
													</td>
													<td className="px-6 py-4 text-zinc-300">
														{log.target_username ? (
															<div className="flex flex-col">
																<span className="font-medium">
																	{
																		log.target_username
																	}
																</span>
																<span className="text-xs text-zinc-500">
																	{
																		log.target_user_id
																	}
																</span>
															</div>
														) : (
															<span className="text-zinc-500">
																-
															</span>
														)}
													</td>
													<td className="px-6 py-4 text-zinc-300">
														<div className="flex items-center space-x-2">
															<Clock className="w-4 h-4 text-zinc-500" />
															<span className="text-sm">
																{formatDate(
																	log.timestamp
																)}
															</span>
														</div>
													</td>
													<td className="px-6 py-4 text-zinc-300">
														<span className="font-mono text-sm">
															{log.ip_address ||
																'N/A'}
														</span>
													</td>
													<td className="px-6 py-4">
														<Button
															size="sm"
															variant="ghost"
															onClick={() =>
																handleViewDetails(
																	log
																)
															}
															className="flex items-center space-x-2"
														>
															<Eye className="w-4 h-4" />
															<span>View</span>
														</Button>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>

								{logs.length === 0 && (
									<div className="text-center py-12 text-zinc-400">
										No audit logs found with the current
										filters.
									</div>
								)}

								{/* Pagination */}
								{totalPages > 1 && (
									<div className="flex justify-center mt-8 space-x-2">
										<Button
											onClick={() =>
												setPage(Math.max(1, page - 1))
											}
											disabled={page === 1}
											variant="outline"
											size="sm"
										>
											Previous
										</Button>
										<span className="text-zinc-400 py-2">
											Page {page} of {totalPages}
										</span>
										<Button
											onClick={() =>
												setPage(
													Math.min(
														totalPages,
														page + 1
													)
												)
											}
											disabled={page === totalPages}
											variant="outline"
											size="sm"
										>
											Next
										</Button>
									</div>
								)}
							</>
						)}

						{/* Details Modal */}
						{showDetails && selectedLog && (
							<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
								<div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
									<div className="flex items-center justify-between mb-6">
										<div className="flex items-center space-x-3">
											{getActionIcon(
												selectedLog.action_type
											)}
											<h2 className="text-xl font-bold text-white">
												Audit Log Details
											</h2>
										</div>
										<Button
											variant="outline"
											size="sm"
											onClick={closeDetailsModal}
										>
											Close
										</Button>
									</div>

									<div className="space-y-4">
										{/* Basic Info */}
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div className="bg-zinc-800 rounded-lg p-4">
												<h3 className="text-sm font-medium text-zinc-400 mb-2">
													Action
												</h3>
												<p className="text-white">
													{formatActionType(
														selectedLog.action_type
													)}
												</p>
											</div>
											<div className="bg-zinc-800 rounded-lg p-4">
												<h3 className="text-sm font-medium text-zinc-400 mb-2">
													Timestamp
												</h3>
												<p className="text-white">
													{formatDate(
														selectedLog.timestamp
													)}
												</p>
											</div>
											<div className="bg-zinc-800 rounded-lg p-4">
												<h3 className="text-sm font-medium text-zinc-400 mb-2">
													Admin
												</h3>
												<p className="text-white">
													{selectedLog.admin_username}
												</p>
												<p className="text-xs text-zinc-500">
													{selectedLog.admin_id}
												</p>
											</div>
											<div className="bg-zinc-800 rounded-lg p-4">
												<h3 className="text-sm font-medium text-zinc-400 mb-2">
													IP Address
												</h3>
												<p className="text-white font-mono">
													{selectedLog.ip_address ||
														'N/A'}
												</p>
											</div>
										</div>

										{/* Target User */}
										{selectedLog.target_username && (
											<div className="bg-zinc-800 rounded-lg p-4">
												<h3 className="text-sm font-medium text-zinc-400 mb-2">
													Target User
												</h3>
												<p className="text-white">
													{
														selectedLog.target_username
													}
												</p>
												<p className="text-xs text-zinc-500">
													{selectedLog.target_user_id}
												</p>
											</div>
										)}

										{/* User Agent */}
										{selectedLog.user_agent && (
											<div className="bg-zinc-800 rounded-lg p-4">
												<h3 className="text-sm font-medium text-zinc-400 mb-2">
													User Agent
												</h3>
												<p className="text-white text-sm break-all">
													{selectedLog.user_agent}
												</p>
											</div>
										)}

										{/* Details */}
										<div className="bg-zinc-800 rounded-lg p-4">
											<h3 className="text-sm font-medium text-zinc-400 mb-2">
												Additional Details
											</h3>
											<pre className="text-sm text-zinc-300 whitespace-pre-wrap">
												{JSON.stringify(
													selectedLog.details,
													null,
													2
												)}
											</pre>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</ProtectedRoute>
	);
}
