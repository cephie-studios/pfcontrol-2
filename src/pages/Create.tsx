import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../hooks/auth/useAuth';
import { createSession } from '../utils/fetch/sessions';
import Navbar from '../components/Navbar';
import AirportDropdown from '../components/dropdowns/AirportDropdown';
import RunwayDropdown from '../components/dropdowns/RunwayDropdown';
import Checkbox from '../components/common/Checkbox';
import Button from '../components/common/Button';
import WindDisplay from '../components/tools/WindDisplay';

export default function Create() {
	const navigate = useNavigate();
	const [selectedAirport, setSelectedAirport] = useState<string>('');
	const [selectedRunway, setSelectedRunway] = useState<string>('');
	const [isPFATCNetwork, setIsPFATCNetwork] = useState<boolean>(false);
	const [isCreating, setIsCreating] = useState<boolean>(false);
	const [error, setError] = useState<string>('');

	const { user } = useAuth();

	const handleCreateSession = async () => {
		if (!selectedAirport || !selectedRunway) {
			setError('Please select both airport and runway');
			return;
		}

		setIsCreating(true);
		setError('');

		try {
			const newSession = await createSession({
				airportIcao: selectedAirport,
				activeRunway: selectedRunway,
				isPFATC: isPFATCNetwork,
				createdBy: user?.userId || 'unknown'
			});
			navigate(
				`/view/${newSession.sessionId}?accessId=${newSession.accessId}`
			);
		} catch {
			console.error('Error creating session:');
			setError('Failed to create session');
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-black to-slate-900 text-white relative">
			<div className="relative z-10">
				<Navbar />
				<div className="max-w-xl mx-auto py-12 px-4 pt-40">
					<h2
						className="text-6xl font-extrabold bg-gradient-to-br from-blue-400 to-blue-900 bg-clip-text text-transparent mb-6 text-center"
						style={{ lineHeight: 1.4 }}
					>
						Create Session
					</h2>

					<div className="bg-gray-800/70 backdrop-blur-sm border border-gray-700 rounded-lg p-6 space-y-6">
						{error && (
							<div className="p-3 bg-red-900/40 backdrop-blur-sm border border-red-700 rounded-md flex items-center text-sm">
								<AlertCircle className="h-5 w-5 mr-2 text-red-400" />
								{error}
							</div>
						)}

						<div className="space-y-2">
							<label className="block text-sm font-medium text-gray-300">
								Select Airport{' '}
								<span className="text-red-400">*</span>
							</label>
							<AirportDropdown
								value={selectedAirport}
								onChange={(airport) => {
									setSelectedAirport(airport);
									setSelectedRunway('');
									setError('');
								}}
								disabled={isCreating}
							/>
						</div>

						<div className="space-y-2">
							<label className="block text-sm font-medium text-gray-300">
								Select Departure Runway{' '}
								<span className="text-red-400">*</span>
							</label>
							<RunwayDropdown
								airportIcao={selectedAirport}
								value={selectedRunway}
								onChange={(runway) => {
									setSelectedRunway(runway);
									setError('');
								}}
								disabled={isCreating || !selectedAirport}
							/>
						</div>

						{selectedAirport && (
							<WindDisplay icao={selectedAirport} />
						)}

						<div className="border-t border-gray-700 pt-6">
							<Checkbox
								checked={isPFATCNetwork}
								onChange={setIsPFATCNetwork}
								label="I am controlling on the PFATC Network"
								className="text-gray-300"
							/>
							{isPFATCNetwork && (
								<div className="mt-3 p-3 bg-blue-900/40 backdrop-blur-sm border border-blue-500/50 rounded-md">
									<div className="flex items-start space-x-2">
										<div className="flex-shrink-0 mt-0.5">
											<Info className="h-4 w-4 text-blue-400" />
										</div>
										<div className="text-sm">
											<p className="text-blue-200 font-medium mb-1">
												PFATC Network Session
											</p>
											<p className="text-blue-300">
												All submitted flights will be
												publicly viewable on the PFATC
												Network Overview page.
											</p>
										</div>
									</div>
								</div>
							)}
						</div>

						<div className="border-t border-gray-700 pt-4">
							<Button
								onClick={handleCreateSession}
								disabled={
									!selectedAirport ||
									!selectedRunway ||
									isCreating
								}
								className={`w-full ${
									!selectedAirport ||
									!selectedRunway ||
									isCreating
										? 'opacity-50 cursor-not-allowed'
										: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
								}`}
							>
								{isCreating ? (
									<span className="flex items-center justify-center">
										<svg
											className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
										>
											<circle
												className="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												strokeWidth="4"
											></circle>
											<path
												className="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											></path>
										</svg>
										Creating Session...
									</span>
								) : (
									'Create Session'
								)}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
