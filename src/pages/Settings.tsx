import { useEffect, useState, useRef, useContext } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { Save, AlertTriangle, Settings as SettingsIcon } from 'lucide-react';
import type {
	Settings,
	DepartureTableColumnSettings,
	ArrivalsTableColumnSettings
} from '../types/settings';
import { useSettings } from '../hooks/settings/useSettings';
import BackgroundImageSettings from '../components/Settings/BackgroundImageSettings';
import SoundSettings from '../components/Settings/SoundSettings';
import LayoutSettings from '../components/Settings/LayoutSettings';
import TableColumnSettings from '../components/Settings/TableColumnSettings';
import AccountSettings from '../components/Settings/AccountSettings';
import AcarsSettings from '../components/Settings/AcarsSettings';
import Navbar from '../components/Navbar';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';

function useCustomBlocker(shouldBlock: boolean, onBlock: () => void) {
	const navigator = useContext(UNSAFE_NavigationContext)?.navigator;
	const location = useLocation();

	useEffect(() => {
		if (!shouldBlock || !navigator) return;

		const push = navigator.push;
		const replace = navigator.replace;

		const block = () => {
			onBlock();
		};

		navigator.push = () => {
			block();
		};
		navigator.replace = () => {
			block();
		};

		return () => {
			navigator.push = push;
			navigator.replace = replace;
		};
	}, [shouldBlock, onBlock, navigator, location]);
}

export default function Settings() {
	const { settings, updateSettings, loading } = useSettings();
	const [localSettings, setLocalSettings] = useState<Settings | null>(null);
	const [saving, setSaving] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);
	const [showDiscardToast, setShowDiscardToast] = useState(false);
	const preventNavigation = useRef(false);

	useEffect(() => {
		if (settings) {
			setLocalSettings(settings);
		}
	}, [settings]);

	useEffect(() => {
		if (settings && localSettings) {
			const hasChanges =
				JSON.stringify(settings) !== JSON.stringify(localSettings);
			setHasChanges(hasChanges);
			preventNavigation.current = hasChanges;
		}
	}, [settings, localSettings]);

	useCustomBlocker(hasChanges, () => setShowDiscardToast(true));

	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (hasChanges) {
				e.preventDefault();
				e.returnValue = '';
			}
		};
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () =>
			window.removeEventListener('beforeunload', handleBeforeUnload);
	}, [hasChanges]);

	const handleLocalSettingsChange = (updatedSettings: Settings) => {
		setLocalSettings(updatedSettings);
	};

	const handleDepartureColumnsChange = (
		columns: DepartureTableColumnSettings
	) => {
		if (!localSettings) return;
		const newSettings = {
			...localSettings,
			departureTableColumns: columns
		};
		setLocalSettings(newSettings);
	};

	const handleArrivalsColumnsChange = (
		columns: ArrivalsTableColumnSettings
	) => {
		if (!localSettings) return;
		const newSettings = {
			...localSettings,
			arrivalsTableColumns: columns
		};
		setLocalSettings(newSettings);
	};

	const handleResetTableColumns = () => {
		if (!localSettings) return;
		const newSettings: Settings = {
			...localSettings,
			departureTableColumns: {
				time: true as const,
				callsign: true,
				stand: true,
				aircraft: true,
				wakeTurbulence: true,
				flightType: true,
				arrival: true,
				runway: true,
				sid: true,
				rfl: true,
				cfl: true,
				squawk: true,
				clearance: true,
				status: true,
				remark: true,
				pdc: true,
				hide: true,
				delete: true
			},
			arrivalsTableColumns: {
				time: true as const,
				callsign: true,
				gate: true,
				aircraft: true,
				wakeTurbulence: true,
				flightType: true,
				departure: true,
				runway: true,
				star: true,
				rfl: true,
				cfl: true,
				squawk: true,
				status: true,
				remark: true,
				hide: true
			}
		};
		setLocalSettings(newSettings);
	};

	const handleSave = async () => {
		if (!localSettings) return;

		try {
			setSaving(true);
			await updateSettings(localSettings);
			setHasChanges(false);
			preventNavigation.current = false;
		} catch (error) {
			console.error('Error updating settings:', error);
		} finally {
			setSaving(false);
		}
	};

	const handleDiscard = () => {
		if (settings) {
			setLocalSettings(settings);
			setHasChanges(false);
			preventNavigation.current = false;
			setShowDiscardToast(false);
		}
	};

	const handleForceLeave = () => {
		preventNavigation.current = false;
		setShowDiscardToast(false);
		window.history.back();
	};

	if (loading)
		return (
			<div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
				<Navbar />
				<Loader />
			</div>
		);

	return (
		<div className="min-h-screen bg-zinc-950 text-white">
			<Navbar />

			{/* Header */}
			<div className="bg-gradient-to-b from-zinc-800 to-zinc-900 border-b border-zinc-700/50">
				<div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pt-24 sm:pt-28">
					<div className="flex items-center mb-4">
						<div className="p-2 sm:p-3 bg-blue-500/20 rounded-xl mr-3 sm:mr-4">
							<SettingsIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400" />
						</div>
						<div>
							<h1
								className="text-3xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600 font-extrabold mb-2"
								style={{ lineHeight: 1.4 }}
							>
								Settings
							</h1>
						</div>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
				<div className="space-y-8">
					<AccountSettings />

					<TableColumnSettings
						departureColumns={
							localSettings?.departureTableColumns || {
								time: true,
								callsign: true,
								stand: true,
								aircraft: true,
								wakeTurbulence: true,
								flightType: true,
								arrival: true,
								runway: true,
								sid: true,
								rfl: true,
								cfl: true,
								squawk: true,
								clearance: true,
								status: true,
								remark: true,
								pdc: true,
								hide: true,
								delete: true
							}
						}
						arrivalsColumns={
							localSettings?.arrivalsTableColumns || {
								time: true,
								callsign: true,
								gate: true,
								aircraft: true,
								wakeTurbulence: true,
								flightType: true,
								departure: true,
								runway: true,
								star: true,
								rfl: true,
								cfl: true,
								squawk: true,
								status: true,
								remark: true,
								hide: true
							}
						}
						onDepartureColumnsChange={handleDepartureColumnsChange}
						onArrivalsColumnsChange={handleArrivalsColumnsChange}
						onReset={handleResetTableColumns}
					/>

					<LayoutSettings
						settings={localSettings}
						onChange={handleLocalSettingsChange}
					/>

					<AcarsSettings
						settings={localSettings}
						onChange={handleLocalSettingsChange}
					/>

					<SoundSettings
						settings={localSettings}
						onChange={handleLocalSettingsChange}
					/>

					<BackgroundImageSettings
						settings={localSettings}
						onChange={handleLocalSettingsChange}
					/>
				</div>
			</div>

			{/* Save/Discard Bar */}
			{hasChanges && !showDiscardToast && (
				<div className="fixed bottom-4 sm:bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 z-50">
					<div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 sm:min-w-[320px]">
						<div className="flex-1">
							<p className="text-white font-medium text-sm">
								Unsaved changes
							</p>
							<p className="text-zinc-400 text-xs">
								Don't forget to save your settings
							</p>
						</div>
						<div className="flex gap-2 sm:gap-3">
							<Button
								onClick={handleDiscard}
								variant="outline"
								size="sm"
								disabled={saving}
								className="flex-1 sm:flex-none text-xs border-zinc-600 text-zinc-300 hover:bg-zinc-800"
							>
								Discard
							</Button>
							<Button
								onClick={handleSave}
								disabled={saving}
								size="sm"
								className="flex-1 sm:flex-none text-xs bg-blue-600 hover:bg-blue-700 flex items-center justify-center space-x-2"
							>
								{saving ? (
									<>
										<div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
										<span>Saving...</span>
									</>
								) : (
									<>
										<Save className="w-3 h-3" />
										<span>Save</span>
									</>
								)}
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Discard Warning Toast */}
			{showDiscardToast && (
				<div className="fixed bottom-4 sm:bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 z-50">
					<div className="bg-red-900/95 backdrop-blur-md border border-red-600/50 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 sm:min-w-[380px]">
						<div className="flex items-start gap-3 sm:gap-4 flex-1">
							<AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
							<div className="flex-1 min-w-0">
								<p className="text-white font-medium text-sm">
									Unsaved changes will be lost
								</p>
								<p className="text-red-300 text-xs">
									Are you sure you want to leave?
								</p>
							</div>
						</div>
						<div className="flex gap-2 sm:gap-3">
							<Button
								onClick={() => setShowDiscardToast(false)}
								variant="outline"
								size="sm"
								className="flex-1 sm:flex-none text-xs border-zinc-600 text-zinc-300 hover:bg-zinc-800"
							>
								Cancel
							</Button>
							<Button
								onClick={handleForceLeave}
								variant="danger"
								size="sm"
								className="flex-1 sm:flex-none text-xs bg-red-600 hover:bg-red-700 whitespace-nowrap"
							>
								Leave anyway
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
