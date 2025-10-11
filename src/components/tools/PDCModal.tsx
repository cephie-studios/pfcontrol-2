import { useEffect, useState } from 'react';
import { X, Copy, CheckCircle, Loader, Info, Plane } from 'lucide-react';
import { useData } from '../../hooks/data/useData';
import type { Flight } from '../../types/flight';
import type { AirportFrequencies } from '../../types/airports';
import Button from '../common/Button';
import TextInput from '../common/TextInput';
import Checkbox from '../common/Checkbox';

interface PDCModalProps {
	isOpen: boolean;
	onClose: () => void;
	flight: Flight | null;
	onIssuePDC?: (flightId: string | number, pdcText: string) => Promise<void> | void;
}

const PDCModal: React.FC<PDCModalProps> = ({ isOpen, onClose, flight, onIssuePDC }) => {
	const { frequencies, fetchAirportData, fetchedAirports } = useData();
	const [airportFreqs, setAirportFreqs] = useState<AirportFrequencies>({});
	const [customFreqs, setCustomFreqs] = useState<AirportFrequencies>(() => {
		const savedFreqs = localStorage.getItem('customPDCFrequencies');
		return savedFreqs ? JSON.parse(savedFreqs) : {};
	});
	const [loading, setLoading] = useState(false);
	const [useCustomFreqs, setUseCustomFreqs] = useState(false);
	const [copied, setCopied] = useState(false);
	const [customSquawk, setCustomSquawk] = useState('');
	const [customIdentifier, setCustomIdentifier] = useState('');
	const [useCustomSquawk, setUseCustomSquawk] = useState(false);
	const [useCustomIdentifier, setUseCustomIdentifier] = useState(false);
	const [pdcFormat, setPdcFormat] = useState<'standard' | 'simplified'>(
		'standard'
	);
	const [error, setError] = useState<string | null>(null);

	const generateRandomSquawk = (): string => {
		return Array.from({ length: 4 }, () =>
			Math.floor(Math.random() * 8)
		).join('');
	};

	const generateRandomIdentifier = (): string => {
		const squawk = getSquawk();
		const firstThreeNumbers = squawk.substring(0, 3);
		
		let firstLetter = 'A';
		if (flight?.callsign) {
			const letters = flight.callsign.match(/[A-Z]/i);
			if (letters && letters.length > 0) {
				firstLetter = letters[0].toUpperCase();
			}
		}
		
		return firstThreeNumbers + firstLetter;
	};

	const [autoSquawk] = useState(() => generateRandomSquawk());
	const [autoIdentifier] = useState(() => generateRandomIdentifier());

	useEffect(() => {
		localStorage.setItem(
			'customPDCFrequencies',
			JSON.stringify(customFreqs)
		);
	}, [customFreqs]);

	useEffect(() => {
		if (isOpen && flight?.departure) {
			fetchAirportFrequencies(flight.departure);
		}
	}, [isOpen, flight]);

	const fetchAirportFrequencies = async (icao: string) => {
		if (!icao) return;

		setLoading(true);
		setError(null);

		try {
			if (!fetchedAirports.has(icao)) {
				await fetchAirportData(icao);
			}

			const airport = frequencies.find(
				(freq) => freq.icao?.toUpperCase() === icao.toUpperCase()
			);

			if (!airport) {
				setError('Airport frequencies not found');
				return;
			}

			const freqMap: AirportFrequencies = {};
			if (Array.isArray(airport.frequencies)) {
				airport.frequencies.forEach((f) => {
					const freqType = f.type?.toLowerCase();
					if (freqType?.includes('del')) {
						freqMap.clearanceDelivery = f.freq;
					} else if (freqType?.includes('app')) {
						freqMap.approach = f.freq;
					} else if (freqType?.includes('gnd')) {
						freqMap.ground = f.freq;
					} else if (freqType?.includes('twr')) {
						freqMap.tower = f.freq;
					}
				});
			}

			if (!freqMap.departure) {
				freqMap.departure = freqMap.approach || freqMap.tower;
			}

			setAirportFreqs(freqMap);
		} catch (error) {
			console.error('Error fetching airport frequencies:', error);
			setError('Failed to load airport frequencies');
		} finally {
			setLoading(false);
		}
	};

	const getSquawk = (): string => {
		if (useCustomSquawk && customSquawk) return customSquawk;
		return flight?.squawk || autoSquawk;
	};

	const getIdentifier = (): string => {
		if (useCustomIdentifier && customIdentifier) return customIdentifier;
		return autoIdentifier;
	};

	const getEquipment = (): string => {
		const acType = flight?.aircraft || 'UNKN';
		return `${acType}/L`;
	};

	const getFrequencies = () => {
		if (useCustomFreqs) {
			return {
				clearance: customFreqs.clearanceDelivery || '122.800',
				departure: customFreqs.departure || '122.800'
			};
		}
		return {
			clearance: airportFreqs.clearanceDelivery || '122.800',
			departure: airportFreqs.departure || '122.800'
		};
	};

	const generatePDCText = (): string => {
		if (!flight) return '';

		const squawk = getSquawk();
		const identifier = getIdentifier();
		const equipment = getEquipment();
		const sidText = flight.sid || 'DCT';
		const freqs = getFrequencies();
		const clearedAlt = flight.clearedFL || '030';
		const isVFR = flight.flight_type === 'VFR';
		const isRadarVectors = sidText === 'RADAR VECTORS';

		let climbInstruction;
		if (isVFR || isRadarVectors) {
			climbInstruction = `CLEARED ${sidText}`;
		} else {
			climbInstruction = `CLEARED ${sidText} DEPARTURE CLIMB VIA SID`;
		}

		if (pdcFormat === 'simplified') {
			return `PDC FOR ${flight.callsign}
CLEARED TO ${flight.arrival} VIA ${sidText}
CLIMB AND MAINTAIN ${clearedAlt}
SQUAWK ${squawk}
CONTACT DEPARTURE ${freqs.departure}
CONTACT CLEARANCE ${freqs.clearance} TO PUSH`;
		}

		return `ACARS: PDC | CALLSIGN: ${
			flight.callsign
		} | EQUIPMENT: ${equipment} |
DEPARTURE: ${flight.departure} | DESTINATION: ${flight.arrival} |
ROUTE: ${flight.departure}.${sidText}..${flight.arrival} |
ALTITUDE: ${clearedAlt} | TRANSPONDER: ${squawk} | REMARKS:
${climbInstruction} EXP ${flight.cruisingFL || clearedAlt} 10
MIN AFT DP DPFRQ ${freqs.departure} | CTC ${freqs.clearance} TO PUSH
IDENTIFIER: ${identifier}`;
	};

	const handleCustomFreqChange = (
		type: keyof AirportFrequencies,
		value: string
	) => {
		setCustomFreqs((prev) => ({ ...prev, [type]: value }));
		setUseCustomFreqs(true);
	};

	const copyToClipboard = async () => {
		if (!flight) return;

		const pdcText = generatePDCText();
		try {
			await navigator.clipboard.writeText(pdcText);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (error) {
			console.error('Failed to copy PDC:', error);
			setError('Failed to copy to clipboard');
		}
	};

	if (!isOpen || !flight) return null;

	return (
		<div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<div className="bg-zinc-900 text-white w-full max-w-2xl max-h-[90vh] rounded-3xl border-2 border-blue-800 flex flex-col shadow-2xl">
				{/* Header */}
				<div className="flex justify-between items-center p-5 border-b border-blue-800 rounded-t-3xl">
					<div className="flex items-center gap-3">
						<Plane className="h-6 w-6 text-blue-400" />
						<span className="font-extrabold text-xl text-blue-300">
							PDC Generator - {flight.callsign}
						</span>
					</div>
					<button
						onClick={onClose}
						className="p-1 rounded-full hover:bg-gray-700 transition-colors"
					>
						<X className="h-5 w-5 text-gray-400" />
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-5 space-y-6">
					{loading && (
						<div className="flex items-center justify-center p-4">
							<Loader className="animate-spin h-5 w-5 mr-2" />
							<span className="text-sm text-gray-400">
								Loading frequency data...
							</span>
						</div>
					)}

					{error && (
						<div className="text-red-400 text-sm p-3 bg-red-900/20 rounded-lg border border-red-700 flex items-center">
							<Info className="h-4 w-4 mr-2" />
							{error}
						</div>
					)}

					{/* Generated PDC */}
					<div className="space-y-3">
						<div className="flex justify-between items-center">
							<h3 className="text-lg font-semibold text-blue-300">
								Generated PDC
							</h3>
							<Button
								onClick={copyToClipboard}
								size="sm"
								variant="outline"
								className={`flex items-center gap-1 transition-all duration-300 ${
									copied
										? 'bg-emerald-600 hover:bg-emerald-600 border-emerald-600 text-white'
										: ''
								}`}
							>
								{copied ? (
									<>
										<CheckCircle className="h-4 w-4" />
										<span>Copied!</span>
									</>
								) : (
									<>
										<Copy className="h-4 w-4" />
										<span>Copy</span>
									</>
								)}
							</Button>
						</div>
						<div className="bg-black p-4 rounded-lg border border-zinc-700 font-mono text-sm text-green-400 whitespace-pre-wrap max-h-48 overflow-y-auto">
							{generatePDCText()}
						</div>
					</div>

					{/* PDC Format */}
					<div className="space-y-3">
						<h3 className="text-lg font-semibold text-blue-300">
							PDC Format
						</h3>
						<div className="flex gap-2">
							<button
								onClick={() => setPdcFormat('standard')}
								className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
									pdcFormat === 'standard'
										? 'bg-blue-600 text-white border border-blue-500'
										: 'bg-zinc-800 text-gray-300 hover:bg-zinc-700 border border-zinc-700'
								}`}
							>
								Standard ACARS
							</button>
							<button
								onClick={() => setPdcFormat('simplified')}
								className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
									pdcFormat === 'simplified'
										? 'bg-blue-600 text-white border border-blue-500'
										: 'bg-zinc-800 text-gray-300 hover:bg-zinc-700 border border-zinc-700'
								}`}
							>
								Simplified
							</button>
						</div>
					</div>

					{/* Flight Information */}
					<div className="space-y-3">
						<h3 className="text-lg font-semibold text-blue-300">
							Flight Information
						</h3>
						<div className="grid grid-cols-2 gap-3 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
							<div>
								<span className="text-xs text-gray-400">
									Callsign
								</span>
								<div className="font-mono font-bold">
									{flight.callsign}
								</div>
							</div>
							<div>
								<span className="text-xs text-gray-400">
									Aircraft
								</span>
								<div className="font-mono">
									{flight.aircraft || 'N/A'}
								</div>
							</div>
							<div>
								<span className="text-xs text-gray-400">
									Departure
								</span>
								<div className="font-mono">
									{flight.departure || 'N/A'}
								</div>
							</div>
							<div>
								<span className="text-xs text-gray-400">
									Arrival
								</span>
								<div className="font-mono">
									{flight.arrival || 'N/A'}
								</div>
							</div>
							<div>
								<span className="text-xs text-gray-400">
									SID
								</span>
								<div className="font-mono">
									{flight.sid || 'DCT'}
								</div>
							</div>
							<div>
								<span className="text-xs text-gray-400">
									Cruising FL
								</span>
								<div className="font-mono">
									{flight.cruisingFL || 'N/A'}
								</div>
							</div>
						</div>
					</div>

					{/* Frequencies */}
					<div className="space-y-3">
						<div className="flex justify-between items-center">
							<h3 className="text-lg font-semibold text-blue-300">
								Frequencies
							</h3>
							<div className="flex gap-2">
								<Checkbox
									checked={useCustomFreqs}
									onChange={setUseCustomFreqs}
									label="Use Custom Frequencies"
									className="text-sm"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div>
								<label className="text-xs block mb-1 text-gray-300">
									Clearance Delivery
								</label>
								<TextInput
									value={
										useCustomFreqs
											? customFreqs.clearanceDelivery ||
											  ''
											: airportFreqs.clearanceDelivery ||
											  '122.800'
									}
									onChange={(value) =>
										handleCustomFreqChange(
											'clearanceDelivery',
											value
										)
									}
									placeholder="e.g. 121.65"
									className="w-full bg-zinc-800 border border-zinc-700"
									disabled={!useCustomFreqs}
								/>
							</div>
							<div>
								<label className="text-xs block mb-1 text-gray-300">
									Departure
								</label>
								<TextInput
									value={
										useCustomFreqs
											? customFreqs.departure || ''
											: airportFreqs.departure ||
											  '122.800'
									}
									onChange={(value) =>
										handleCustomFreqChange(
											'departure',
											value
										)
									}
									placeholder="e.g. 133.0"
									className="w-full bg-zinc-800 border border-zinc-700"
									disabled={!useCustomFreqs}
								/>
							</div>
						</div>
					</div>

					{/* Transponder & Identifier */}
					<div className="space-y-3">
						<h3 className="text-lg font-semibold text-blue-300">
							Transponder & Identifier
						</h3>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<div className="flex items-center justify-between mb-2">
									<label className="text-xs text-gray-300">
										Squawk Code
									</label>
									<button
										onClick={() =>
											setUseCustomSquawk(!useCustomSquawk)
										}
										className={`text-xs px-2 py-1 rounded ${
											useCustomSquawk
												? 'bg-blue-600'
												: 'bg-gray-700'
										}`}
									>
										{useCustomSquawk ? 'Custom' : 'Auto'}
									</button>
								</div>
								<TextInput
									value={
										useCustomSquawk
											? customSquawk
											: flight.squawk || autoSquawk
									}
									onChange={setCustomSquawk}
									placeholder="e.g. 1234"
									className="w-full bg-zinc-800 border border-zinc-700 font-mono"
									maxLength={4}
									disabled={!useCustomSquawk}
								/>
							</div>
							<div>
								<div className="flex items-center justify-between mb-2">
									<label className="text-xs text-gray-300">
										Identifier
									</label>
									<button
										onClick={() =>
											setUseCustomIdentifier(
												!useCustomIdentifier
											)
										}
										className={`text-xs px-2 py-1 rounded ${
											useCustomIdentifier
												? 'bg-blue-600'
												: 'bg-gray-700'
										}`}
									>
										{useCustomIdentifier
											? 'Custom'
											: 'Auto'}
									</button>
								</div>
								<TextInput
									value={
										useCustomIdentifier
											? customIdentifier
											: autoIdentifier
									}
									onChange={setCustomIdentifier}
									placeholder="e.g. AB12"
									className="w-full bg-zinc-800 border border-zinc-700 font-mono"
									maxLength={4}
									disabled={!useCustomIdentifier}
								/>
							</div>
						</div>
					</div>

					{/* Warning */}
					<div className="bg-amber-900/20 p-3 rounded-lg border border-amber-700 text-amber-300 text-xs">
						<div className="flex items-start">
							<Info className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
							<div>
								<p className="font-medium mb-1">
									Verification Required
								</p>
								<p>
									This is an automatically generated PDC.
									Verify all information before issuing to the
									pilot. Flight plan details may need
									additional verification.
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="p-5 border-t border-blue-800 bg-zinc-900 rounded-b-3xl">
					<div className="flex justify-between items-center">
						<div className="text-sm text-gray-500">
							Generated at {new Date().toLocaleTimeString()}
						</div>
						<div className="flex gap-3">
							<Button
								onClick={copyToClipboard}
								disabled={loading}
								size="sm"
							>
								Copy PDC
							</Button>

							{/* NEW: Issue PDC to pilot via flights websocket */}
							{typeof onIssuePDC === 'function' && (
								<Button
									onClick={async () => {
										if (!flight) return;
										const pdcText = generatePDCText();
										try {
											await onIssuePDC(flight.id, pdcText);
											onClose();
										} catch (err) {
											console.error('Issue PDC failed', err);
											setError('Failed to issue PDC');
										}
									}}
									disabled={loading}
									size="sm"
								>
									Issue PDC to Pilot
								</Button>
							)}

							<Button
								onClick={onClose}
								variant="outline"
								size="sm"
							>
								Close
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default PDCModal;
