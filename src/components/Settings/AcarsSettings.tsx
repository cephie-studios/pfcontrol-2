import {
	Terminal,
	StickyNote,
	Map,
	Eye,
	ChevronDown,
	ChevronUp
} from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Settings } from '../../types/settings';
import Button from '../common/Button';

interface AcarsSettingsProps {
	settings: Settings | null;
	onChange: (updatedSettings: Settings) => void;
}

export default function AcarsSettings({
	settings,
	onChange
}: AcarsSettingsProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [isDragging, setIsDragging] = useState<'terminal' | 'notes' | null>(null);

	const handleNotesToggle = () => {
		if (!settings) return;
		const updatedSettings = {
			...settings,
			acars: {
				...settings.acars,
				notesEnabled: !settings.acars.notesEnabled
			}
		};
		onChange(updatedSettings);
	};

	const handleChartsToggle = () => {
		if (!settings) return;
		const updatedSettings = {
			...settings,
			acars: {
				...settings.acars,
				chartsEnabled: !settings.acars.chartsEnabled
			}
		};
		onChange(updatedSettings);
	};

	const handleTerminalWidthChange = (width: number) => {
		if (!settings) return;
		const updatedSettings = {
			...settings,
			acars: {
				...settings.acars,
				terminalWidth: width
			}
		};
		onChange(updatedSettings);
	};

	const handleNotesWidthChange = (width: number) => {
		if (!settings) return;
		const updatedSettings = {
			...settings,
			acars: {
				...settings.acars,
				notesWidth: width
			}
		};
		onChange(updatedSettings);
	};

	const handleMouseDown = (divider: 'terminal' | 'notes') => {
		setIsDragging(divider);
	};

	const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!isDragging || !settings) return;

		const container = e.currentTarget;
		const rect = container.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const percentage = (x / rect.width) * 100;

		if (isDragging === 'terminal') {
			const newTerminalWidth = Math.max(20, Math.min(80, percentage));
			handleTerminalWidthChange(Math.round(newTerminalWidth / 5) * 5);
		} else if (isDragging === 'notes') {
			const newNotesWidth = Math.max(10, Math.min(50, percentage - settings.acars.terminalWidth));
			handleNotesWidthChange(Math.round(newNotesWidth / 5) * 5);
		}
	};

	const handleMouseUp = () => {
		setIsDragging(null);
	};

	useEffect(() => {
		if (isDragging) {
			document.body.style.cursor = 'col-resize';
			document.body.style.userSelect = 'none';
		} else {
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		}
	}, [isDragging]);

	if (!settings) return null;

	return (
		<div className="bg-zinc-900 border border-zinc-700/50 rounded-2xl overflow-hidden">
			{/* Header */}
			<div className="w-full p-4 sm:p-6 border-b border-zinc-700/50">
				<div className="flex items-center justify-between gap-3">
					<div
						className="flex items-center flex-1 min-w-0 cursor-pointer"
						onClick={() => setIsExpanded(!isExpanded)}
					>
						<div className="p-2 bg-cyan-500/20 rounded-lg mr-3 sm:mr-4 flex-shrink-0">
							<Terminal className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-400" />
						</div>
						<div className="text-left min-w-0">
							<h3 className="text-lg sm:text-xl font-semibold text-white">
								ACARS Settings
							</h3>
							<p className="text-zinc-400 text-xs sm:text-sm mt-1 hidden sm:block">
								Configure ACARS terminal panels and default layout
							</p>
						</div>
					</div>
					<Button
						onClick={() => setIsExpanded(!isExpanded)}
						variant="outline"
						size="sm"
						className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 p-2 flex-shrink-0"
					>
						{isExpanded ? (
							<ChevronUp className="h-4 w-4" />
						) : (
							<ChevronDown className="h-4 w-4" />
						)}
					</Button>
				</div>
			</div>

			{/* Content */}
			<div
				className={`transition-all duration-300 ease-in-out ${
					isExpanded
						? 'max-h-[2000px] opacity-100'
						: 'max-h-0 opacity-0 overflow-hidden'
				}`}
			>
				<div className="p-6">
					<div className="space-y-6">
						{/* Panel Toggles */}
						<div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-5">
							<div className="flex items-start mb-4">
								<div className="p-2 bg-blue-500/20 rounded-lg mr-4 mt-0.5">
									<Eye className="h-5 w-5 text-blue-400" />
								</div>
								<div>
									<h4 className="text-white font-medium mb-1">
										Panel Visibility
									</h4>
									<p className="text-zinc-400 text-sm">
										Choose which panels are enabled in the ACARS terminal
									</p>
								</div>
							</div>

							<div className="space-y-4">
								{/* Notes Toggle */}
								<div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-700/30">
									<div className="flex items-center">
										<StickyNote className="h-5 w-5 text-blue-400 mr-3" />
										<div>
											<p className="text-white font-medium text-sm">Notes Panel</p>
											<p className="text-zinc-500 text-xs">Flight notes and planning</p>
										</div>
									</div>
									<button
										onClick={handleNotesToggle}
										className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
											settings.acars.notesEnabled
												? 'bg-blue-600'
												: 'bg-zinc-700'
										}`}
									>
										<span
											className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
												settings.acars.notesEnabled
													? 'translate-x-6'
													: 'translate-x-1'
											}`}
										/>
									</button>
								</div>

								{/* Charts Toggle */}
								<div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg border border-zinc-700/30">
									<div className="flex items-center">
										<Map className="h-5 w-5 text-purple-400 mr-3" />
										<div>
											<p className="text-white font-medium text-sm">Charts Panel</p>
											<p className="text-zinc-500 text-xs">Airport charts and diagrams</p>
										</div>
									</div>
									<button
										onClick={handleChartsToggle}
										className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
											settings.acars.chartsEnabled
												? 'bg-purple-600'
												: 'bg-zinc-700'
										}`}
									>
										<span
											className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
												settings.acars.chartsEnabled
													? 'translate-x-6'
													: 'translate-x-1'
											}`}
										/>
									</button>
								</div>
							</div>
						</div>

						{/* Interactive Visual Preview */}
						<div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-5">
							<div className="flex items-start mb-4">
								<div className="p-2 bg-cyan-500/20 rounded-lg mr-4 mt-0.5">
									<Eye className="h-5 w-5 text-cyan-400" />
								</div>
								<div>
									<h4 className="text-white font-medium mb-1">
										Preview
									</h4>
									<p className="text-zinc-400 text-sm">
										Drag the dividers to adjust panel widths
									</p>
								</div>
							</div>

							<div
								className="relative bg-zinc-950 border border-zinc-700 rounded-lg overflow-hidden"
								style={{ height: '200px' }}
								onMouseMove={handleMouseMove}
								onMouseUp={handleMouseUp}
								onMouseLeave={handleMouseUp}
							>
								<div className="flex h-full">
									{/* Terminal Panel */}
									<div
										style={{ width: `${settings.acars.terminalWidth}%` }}
										className="bg-gradient-to-br from-gray-800 to-gray-900 border-r border-gray-700 flex flex-col"
									>
										<div className="bg-gray-800/50 px-3 py-2 border-b border-gray-700 flex items-center gap-2">
											<Terminal className="w-3 h-3 text-green-400" />
											<span className="text-[10px] text-gray-300 font-mono">Terminal</span>
										</div>
										<div className="flex-1 p-2 space-y-1">
											<div className="h-1 bg-green-500/20 rounded w-3/4"></div>
											<div className="h-1 bg-cyan-500/20 rounded w-full"></div>
											<div className="h-1 bg-green-500/20 rounded w-2/3"></div>
										</div>
									</div>

									{/* Terminal Divider */}
									{settings.acars.notesEnabled && (
										<div
											className="w-1 bg-blue-500 hover:bg-blue-400 cursor-col-resize flex-shrink-0 relative group"
											onMouseDown={() => handleMouseDown('terminal')}
										>
											<div className="absolute inset-y-0 -left-1 -right-1" />
										</div>
									)}

									{/* Notes Panel */}
									{settings.acars.notesEnabled && (
										<div
											style={settings.acars.chartsEnabled ? { width: `${settings.acars.notesWidth}%` } : undefined}
											className={`bg-gradient-to-br from-blue-900 to-blue-950 border-r border-gray-700 flex flex-col ${!settings.acars.chartsEnabled ? 'flex-1' : ''}`}
										>
											<div className="bg-blue-900/50 px-3 py-2 border-b border-gray-700 flex items-center gap-2">
												<StickyNote className="w-3 h-3 text-blue-400" />
												<span className="text-[10px] text-gray-300 font-mono">Notes</span>
											</div>
											<div className="flex-1 p-2 space-y-1">
												<div className="h-1 bg-blue-500/30 rounded w-full"></div>
												<div className="h-1 bg-blue-500/30 rounded w-5/6"></div>
												<div className="h-1 bg-blue-500/30 rounded w-4/5"></div>
											</div>
										</div>
									)}

									{/* Notes Divider */}
									{settings.acars.notesEnabled && settings.acars.chartsEnabled && (
										<div
											className="w-1 bg-blue-500 hover:bg-blue-400 cursor-col-resize flex-shrink-0 relative group"
											onMouseDown={() => handleMouseDown('notes')}
										>
											<div className="absolute inset-y-0 -left-1 -right-1" />
										</div>
									)}

									{/* Terminal-to-Charts Divider (when notes is disabled) */}
									{!settings.acars.notesEnabled && settings.acars.chartsEnabled && (
										<div
											className="w-1 bg-purple-500 hover:bg-purple-400 cursor-col-resize flex-shrink-0 relative group"
											onMouseDown={() => handleMouseDown('terminal')}
										>
											<div className="absolute inset-y-0 -left-1 -right-1" />
										</div>
									)}

									{/* Charts Panel */}
									{settings.acars.chartsEnabled && (
										<div className="flex-1 bg-gradient-to-br from-purple-900 to-purple-950 flex flex-col">
											<div className="bg-purple-900/50 px-3 py-2 border-b border-gray-700 flex items-center gap-2">
												<Map className="w-3 h-3 text-purple-400" />
												<span className="text-[10px] text-gray-300 font-mono">Charts</span>
											</div>
											<div className="flex-1 p-2 flex items-center justify-center">
												<div className="w-16 h-16 border-2 border-purple-500/30 rounded"></div>
											</div>
										</div>
									)}
								</div>
							</div>

							<p className="text-xs text-zinc-500 mt-2 text-center">
								{settings.acars.notesEnabled && settings.acars.chartsEnabled ? (
									<>Terminal: {settings.acars.terminalWidth}% • Notes: {settings.acars.notesWidth}% • Charts: {100 - settings.acars.terminalWidth - settings.acars.notesWidth}%</>
								) : settings.acars.notesEnabled ? (
									<>Terminal: {settings.acars.terminalWidth}% • Notes: {100 - settings.acars.terminalWidth}%</>
								) : settings.acars.chartsEnabled ? (
									<>Terminal: {settings.acars.terminalWidth}% • Charts: {100 - settings.acars.terminalWidth}%</>
								) : (
									<>Terminal: 100%</>
								)}
							</p>
						</div>
					</div>

					{/* Info Section */}
					<div className="mt-6 p-4 bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-500/20 rounded-lg">
						<div className="flex items-start">
							<div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
							<div>
								<h4 className="text-cyan-300 font-medium text-sm mb-1">
									ACARS Information
								</h4>
								<p className="text-cyan-200/80 text-xs sm:text-sm leading-relaxed">
									Panel visibility settings apply to the ACARS terminal interface.
									The Terminal panel cannot be disabled as it's required for receiving messages.
									Width settings only apply to desktop view - mobile devices use a tab-based layout.
									Changes take effect the next time you open an ACARS terminal.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<style>{`
                .acars-slider::-webkit-slider-thumb {
                    appearance: none;
                    height: 18px;
                    width: 18px;
                    border-radius: 50%;
                    background: #ffffff;
                    cursor: pointer;
                    border: 2px solid #06b6d4;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    position: relative;
                    z-index: 10;
                }
                .acars-slider::-moz-range-thumb {
                    height: 18px;
                    width: 18px;
                    border-radius: 50%;
                    background: #ffffff;
                    cursor: pointer;
                    border: 2px solid #06b6d4;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    position: relative;
                    z-index: 10;
                }
                .acars-slider {
                    background: transparent;
                    position: relative;
                    z-index: 5;
                }
            `}</style>
		</div>
	);
}
