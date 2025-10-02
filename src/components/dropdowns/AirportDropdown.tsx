import { useEffect, useState } from 'react';
import { fetchAirports } from '../../utils/fetch/data';
import type { Airport } from '../../types/airports';
import Dropdown from '../common/Dropdown';

interface AirportDropdownProps {
	onChange: (icao: string) => void;
	value?: string;
	disabled?: boolean;
	size?: 'xs' | 'sm' | 'md' | 'lg';
	showFullName?: boolean;
}

export default function AirportDropdown({
	onChange,
	value,
	disabled = false,
	size = 'md',
	showFullName = true
}: AirportDropdownProps) {
	const [airports, setAirports] = useState<Airport[]>([]);

	useEffect(() => {
		async function loadAirports() {
			const data = await fetchAirports();
			setAirports(data);
		}
		loadAirports();
	}, []);

	const dropdownOptions = airports.map((airport) => ({
		value: airport.icao,
		label: showFullName ? `${airport.icao} - ${airport.name}` : airport.icao
	}));

	const getDisplayValue = (selectedValue: string) => {
		if (!selectedValue) return 'Select Airport';
		const found = airports.find((ap) => ap.icao === selectedValue);
		return found
			? showFullName
				? `${found.icao} - ${found.name}`
				: found.icao
			: selectedValue;
	};

	return (
		<Dropdown
			options={dropdownOptions}
			placeholder="Select Airport"
			value={value}
			onChange={onChange}
			disabled={disabled}
			getDisplayValue={getDisplayValue}
			size={size}
		/>
	);
}
