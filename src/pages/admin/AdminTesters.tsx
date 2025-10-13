import { useState, useEffect } from 'react';
import {
	Users,
	Search,
	Trash2,
	Shield,
	ShieldCheck,
	Calendar,
	User,
	Check,
	ShieldX,
	Menu
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import AdminSidebar from '../../components/admin/AdminSidebar';
import Loader from '../../components/common/Loader';
import Button from '../../components/common/Button';
import Toast from '../../components/common/Toast';
import ErrorScreen from '../../components/common/ErrorScreen';
import {
	fetchTesters,
	addTester,
	removeTester,
	updateTesterSettings,
	type Tester
} from '../../utils/fetch/testers';
import { getTesterSettings } from '../../utils/fetch/data';

export default function AdminTesters() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
	const [testers, setTesters] = useState<Tester[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [totalTesters, setTotalTesters] = useState(0);
	const [addingTester, setAddingTester] = useState(false);
	const [removingTester, setRemovingTester] = useState<string | null>(null);
	const [newTesterUserId, setNewTesterUserId] = useState('');
	const [newTesterNotes, setNewTesterNotes] = useState('');
	const [gateEnabled, setGateEnabled] = useState(true);
	const [updatingGate, setUpdatingGate] = useState(false);

	const [toast, setToast] = useState<{
		message: string;
		type: 'success' | 'error' | 'info';
	} | null>(null);

	const fetchTestersData = async () => {
		try {
			setLoading(true);
			setError(null);

			const [testersData, settings] = await Promise.all([
				fetchTesters(currentPage, 50, searchTerm),
				getTesterSettings()
			]);

			setTesters(testersData.testers);
			setTotalPages(testersData.pagination.pages);
			setTotalTesters(testersData.pagination.total);
			setGateEnabled(settings.tester_gate_enabled);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Failed to fetch testers'
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchTestersData();
	}, [currentPage, searchTerm]);

	const handleAddTester = async () => {
		if (!newTesterUserId.trim()) {
			setToast({ message: 'User ID is required', type: 'error' });
			return;
		}

		try {
			setAddingTester(true);
			await addTester(newTesterUserId.trim(), newTesterNotes.trim());

			setToast({ message: 'Tester added successfully', type: 'success' });
			setNewTesterUserId('');
			setNewTesterNotes('');
			fetchTestersData();
		} catch (err) {
			setToast({
				message:
					err instanceof Error ? err.message : 'Failed to add tester',
				type: 'error'
			});
		} finally {
			setAddingTester(false);
		}
	};

	const handleRemoveTester = async (userId: string) => {
		try {
			setRemovingTester(userId);
			await removeTester(userId);

			setToast({
				message: 'Tester removed successfully',
				type: 'success'
			});
			fetchTestersData();
		} catch (err) {
			setToast({
				message:
					err instanceof Error
						? err.message
						: 'Failed to remove tester',
				type: 'error'
			});
		} finally {
			setRemovingTester(null);
		}
	};

	const handleToggleGate = async () => {
		try {
			setUpdatingGate(true);
			await updateTesterSettings({ tester_gate_enabled: !gateEnabled });
			setGateEnabled(!gateEnabled);

			setToast({
				message: `Tester gate ${!gateEnabled ? 'enabled' : 'disabled'}`,
				type: 'success'
			});
		} catch (err) {
			setToast({
				message:
					err instanceof Error
						? err.message
						: 'Failed to update settings',
				type: 'error'
			});
		} finally {
			setUpdatingGate(false);
		}
	};

	return (
		<div className="min-h-screen bg-black text-white">
			<Navbar />
			<div className="flex pt-16">
				{/* Mobile Sidebar Overlay */}
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

				<div className="flex-1 p-4 sm:p-6 lg:p-8">
					{/* Header */}
					<div className="mb-6 sm:mb-8">
						<div className="flex items-center mb-4">
							<div className="p-2 sm:p-3 bg-purple-500/20 rounded-xl mr-3 sm:mr-4">
								<Shield className="h-6 w-6 sm:h-8 sm:w-8 text-purple-400" />
							</div>
							<div>
								<h1
									className="text-3xl sm:text-4xl lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600 font-extrabold mb-2"
									style={{ lineHeight: 1.4 }}
								>
									Tester Management
								</h1>
							</div>
						</div>

						{/* Tester Gate Control */}
						<div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-6 mb-6">
							<div className="flex items-center justify-between">
								<div className="flex items-center">
									<div
										className={`p-3 rounded-xl mr-4 ${
											gateEnabled
												? 'bg-green-500/20'
												: 'bg-red-500/20'
										}`}
									>
										{gateEnabled ? (
											<ShieldCheck className="h-6 w-6 text-green-400" />
										) : (
											<ShieldX className="h-6 w-6 text-red-400" />
										)}
									</div>
									<div>
										<h3 className="text-lg font-semibold text-white">
											Tester Gate
										</h3>
										<p className="text-zinc-400 text-sm">
											{gateEnabled
												? 'Only approved testers can access the application'
												: 'All users can access the application'}
										</p>
									</div>
								</div>
								<Button
									onClick={handleToggleGate}
									disabled={updatingGate}
									variant={gateEnabled ? 'danger' : 'primary'}
									className="px-6"
								>
									{updatingGate ? (
										<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
									) : gateEnabled ? (
										'Disable Gate'
									) : (
										'Enable Gate'
									)}
								</Button>
							</div>
						</div>
					</div>

					<div className="flex flex-col md:flex-row gap-8 w-full mb-8">
						{/* Add Tester Form */}
						<div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-6 flex-[2] min-w-0">
							<div className="mb-4">
								<h3 className="text-xl font-semibold text-white">
									Add New Tester
								</h3>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-zinc-400 mb-2">
										User ID
									</label>
									<input
										type="text"
										value={newTesterUserId}
										onChange={(e) =>
											setNewTesterUserId(e.target.value)
										}
										placeholder="Enter Discord User ID"
										className="w-full px-4 py-3 bg-zinc-800 border-2 border-zinc-700 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition-colors"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-400 mb-2">
										Notes (Optional)
									</label>
									<input
										type="text"
										value={newTesterNotes}
										onChange={(e) =>
											setNewTesterNotes(e.target.value)
										}
										placeholder="Any notes about this tester"
										className="w-full px-4 py-3 bg-zinc-800 border-2 border-zinc-700 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition-colors"
									/>
								</div>
							</div>
							<div className="flex gap-3 mt-4">
								<Button
									onClick={handleAddTester}
									disabled={addingTester}
									className="flex items-center bg-green-600 hover:bg-green-700 border-green-600"
								>
									{addingTester ? (
										<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
									) : (
										<Check className="h-4 w-4 mr-2" />
									)}
									Add Tester
								</Button>
							</div>
						</div>

						{/* Stats */}
						<div className="grid grid-cols-1 gap-6 flex-1 min-w-0">
							<div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl p-6 flex flex-col justify-center">
								<div className="flex items-center justify-center mb-6">
									<div className="p-4 bg-blue-500/20 rounded-xl">
										<Users className="h-8 w-8 text-blue-400" />
									</div>
								</div>
								<div className="text-center">
									<h3 className="text-4xl font-bold text-white mb-2">
										{totalTesters}
									</h3>
									<p className="text-zinc-400 text-lg">
										Total Testers
									</p>
								</div>
							</div>
						</div>
					</div>

					<div className="mb-4">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 h-5 w-5" />
							<input
								type="text"
								placeholder="Search testers by username or ID..."
								value={searchTerm}
								onChange={(e) => {
									setSearchTerm(e.target.value);
									setCurrentPage(1);
								}}
								className="w-full pl-10 pr-4 py-3 bg-zinc-800 border-2 border-zinc-700 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition-colors"
							/>
						</div>
					</div>

					{/* Content */}
					{loading ? (
						<div className="flex justify-center py-12">
							<Loader />
						</div>
					) : error ? (
						<ErrorScreen
							title="Error loading testers"
							message={error}
							onRetry={fetchTestersData}
						/>
					) : (
						<>
							{/* Testers Table */}
							<div className="bg-zinc-900 border-2 border-zinc-700/50 rounded-2xl overflow-hidden">
								<div className="overflow-x-auto">
									<table className="w-full min-w-[800px]">
									<thead className="bg-zinc-800">
										<tr>
											<th className="px-6 py-4 text-left text-zinc-400 font-medium">
												Tester
											</th>
											<th className="px-6 py-4 text-left text-zinc-400 font-medium">
												Added By
											</th>
											<th className="px-6 py-4 text-left text-zinc-400 font-medium">
												Date Added
											</th>
											<th className="px-6 py-4 text-left text-zinc-400 font-medium">
												Notes
											</th>
											<th className="px-6 py-4 text-left text-zinc-400 font-medium">
												Actions
											</th>
										</tr>
									</thead>
									<tbody>
										{testers.length === 0 ? (
											<tr>
												<td
													colSpan={5}
													className="px-6 py-12 text-center text-zinc-500"
												>
													<Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
													<p className="text-lg">
														No testers found
													</p>
													<p className="text-sm">
														Add some testers to get
														started
													</p>
												</td>
											</tr>
										) : (
											testers.map((tester) => (
												<tr
													key={tester.id}
													className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
												>
													<td className="px-6 py-4">
														<div className="flex items-center">
															{tester.avatar ? (
																<img
																	src={`https://cdn.discordapp.com/avatars/${tester.user_id}/${tester.avatar}.png`}
																	alt={tester.username}
																	className="w-10 h-10 rounded-full mr-3"
																/>
															) : (
																<div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center mr-3">
																	<User className="w-5 h-5 text-zinc-400" />
																</div>
															)}
															<div>
																<span className="text-white font-medium">
																	{
																		tester.username
																	}
																</span>
																<p className="text-xs text-zinc-500 font-mono">
																	{
																		tester.user_id
																	}
																</p>
															</div>
														</div>
													</td>
													<td className="px-6 py-4 text-zinc-300">
														{
															tester.added_by_username
														}
													</td>
													<td className="px-6 py-4 text-zinc-300">
														<div className="flex items-center">
															<Calendar className="w-4 h-4 mr-2 text-zinc-500" />
															{new Date(
																tester.created_at
															).toLocaleDateString()}
														</div>
													</td>
													<td className="px-6 py-4 text-zinc-300">
														{tester.notes || '-'}
													</td>
													<td className="px-6 py-4">
														<Button
															onClick={() =>
																handleRemoveTester(
																	tester.user_id
																)
															}
															disabled={
																removingTester ===
																tester.user_id
															}
															variant="danger"
															size="sm"
															className="flex items-center"
														>
															{removingTester ===
															tester.user_id ? (
																<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
															) : (
																<Trash2 className="w-4 h-4" />
															)}
														</Button>
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
								</div>
							</div>

							{/* Pagination */}
							{totalPages > 1 && (
								<div className="flex justify-center mt-8 space-x-2">
									{Array.from(
										{ length: totalPages },
										(_, i) => i + 1
									).map((page) => (
										<button
											key={page}
											onClick={() => setCurrentPage(page)}
											className={`px-4 py-2 rounded-lg transition-colors ${
												currentPage === page
													? 'bg-blue-600 text-white'
													: 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
											}`}
										>
											{page}
										</button>
									))}
								</div>
							)}
						</>
					)}
				</div>
			</div>

			{/* Floating Mobile Menu Button */}
			<button
				onClick={() => setMobileSidebarOpen(true)}
				className="lg:hidden fixed bottom-6 right-6 z-30 p-4 bg-purple-600 hover:bg-purple-700 rounded-full shadow-lg transition-colors"
			>
				<Menu className="h-6 w-6 text-white" />
			</button>

			{/* Toast */}
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
