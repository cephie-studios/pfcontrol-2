import { useEffect, useState } from 'react';
import { fetchAirports } from '../../utils/fetch/data';
import type { Airport } from '../../types/airports';
import Dropdown from '../common/Dropdown';

interface AirportDropdownProps {
	onChange: (icao: string) => void;
	value?: string;
	disabled?: boolean;
}

export default function AirportDropdown({
	onChange,
	value,
	disabled = false
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
		label: `${airport.icao} - ${airport.name}`
	}));

	const getDisplayValue = (selectedValue: string) => {
		if (!selectedValue) return 'Select Airport';
		return selectedValue;
	};

	return (
		<Dropdown
			options={dropdownOptions}
			placeholder="Select Airport"
			value={value}
			onChange={onChange}
			disabled={disabled}
			getDisplayValue={getDisplayValue}
		/>
	);
}
