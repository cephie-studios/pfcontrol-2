import { useEffect, useState } from 'react';
import { fetchSids } from '../../utils/fetch/data';
import Dropdown from '../common/Dropdown';

interface SidDropdownProps {
	airportIcao: string;
	onChange: (sid: string) => void;
	value?: string;
	disabled?: boolean;
	size?: 'xs' | 'sm' | 'md' | 'lg';
	placeholder?: string;
}

export default function SidDropdown({
	airportIcao,
	onChange,
	value,
	disabled = false,
	size = 'md',
	placeholder = 'Select SID'
}: SidDropdownProps) {
	const [sids, setSids] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(false);

	useEffect(() => {
		async function loadSids() {
			if (!airportIcao) {
				setSids([]);
				return;
			}

			setIsLoading(true);
			try {
				const data = await fetchSids(airportIcao);
				setSids(data || []);
			} catch (error) {
				console.error('Error fetching SIDs:', error);
				setSids([]);
			} finally {
				setIsLoading(false);
			}
		}

		loadSids();
	}, [airportIcao]);

	const dropdownOptions = sids.map((sid) => ({
		value: sid,
		label: sid
	}));

	const getDisplayValue = (selectedValue: string) => {
		if (!selectedValue) {
			if (!airportIcao) return 'Select Airport First';
			if (isLoading) return 'Loading SIDs...';
			if (sids.length === 0) return 'No SIDs available';
			return placeholder;
		}
		return selectedValue;
	};

	return (
		<Dropdown
			options={dropdownOptions}
			placeholder={placeholder}
			value={value}
			onChange={onChange}
			disabled={
				disabled || !airportIcao || isLoading || sids.length === 0
			}
			getDisplayValue={getDisplayValue}
			size={size}
		/>
	);
}
