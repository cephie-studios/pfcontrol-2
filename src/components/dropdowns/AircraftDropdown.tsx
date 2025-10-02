import { useEffect, useState } from 'react';
import Dropdown from '../common/Dropdown';
import type { Aircraft } from '../../types/aircraft';

interface AircraftDropdownProps {
	value?: string;
	onChange: (aircraftType: string) => void;
	disabled?: boolean;
	size?: 'xs' | 'sm' | 'md' | 'lg';
	showFullName?: boolean;
}

export default function AircraftDropdown({
	value,
	onChange,
	disabled = false,
	size = 'md',
	showFullName = true
}: AircraftDropdownProps) {
	const [aircraftList, setAircraftList] = useState<
		{ type: string; name: string }[]
	>([]);

	useEffect(() => {
		async function loadAircraft() {
			const res = await fetch('/server/data/aircraftData.json');
			const data = await res.json();
			const list = Object.entries(data).map(([type, info]) => ({
				type,
				name: (info as Aircraft).name
			}));
			setAircraftList(list);
		}
		loadAircraft();
	}, []);

	const dropdownOptions = aircraftList.map((ac) => ({
		value: ac.type,
		label: showFullName ? `${ac.type} - ${ac.name}` : ac.type
	}));

	const getDisplayValue = (selectedValue: string) => {
		if (!selectedValue) return 'Select Aircraft';
		const found = aircraftList.find((ac) => ac.type === selectedValue);
		return found
			? showFullName
				? `${found.type} - ${found.name}`
				: found.type
			: selectedValue;
	};

	return (
		<Dropdown
			options={dropdownOptions}
			placeholder="Select Aircraft"
			value={value}
			onChange={onChange}
			disabled={disabled}
			getDisplayValue={getDisplayValue}
			size={size}
		/>
	);
}
