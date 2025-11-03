import Dropdown from '../common/Dropdown';

interface StatusDropdownProps {
	value?: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	size?: 'xs' | 'sm' | 'md' | 'lg';
	placeholder?: string;
	controllerType?: 'departure' | 'arrival' | 'event';
}

const departureStatusOptions = [
	{ value: 'PENDING', label: 'PENDING' },
	{ value: 'STUP', label: 'STUP' },
	{ value: 'PUSH', label: 'PUSH' },
	{ value: 'TAXI', label: 'TAXI' },
	{ value: 'RWY', label: 'RWY' },
	{ value: 'DEPA', label: 'DEPA' }
];

const arrivalStatusOptions = [
	{ value: 'APP', label: 'APP' },
	{ value: 'RWY', label: 'RWY' },
	{ value: 'TAXI', label: 'TAXI' },
	{ value: 'GATE', label: 'GATE' }
];

const eventStatusOptions = [
	// Departure phase
	{ value: 'PENDING', label: 'PENDING' },
	{ value: 'STUP', label: 'STUP' },
	{ value: 'PUSH', label: 'PUSH' },
	{ value: 'TAXI_ORIG', label: 'TAXI' },
	{ value: 'RWY_ORIG', label: 'RWY' },
	{ value: 'DEPA', label: 'DEPA' },
	// Enroute phase
	{ value: 'ENROUTE', label: 'ENROUTE' },
	// Arrival phase
	{ value: 'APP', label: 'APP' },
	{ value: 'RWY_ARRV', label: 'RWY' },
	{ value: 'TAXI_ARRV', label: 'TAXI' },
	{ value: 'GATE', label: 'GATE' }
];

const getColorClass = (status: string) => {
	switch (status) {
		case 'PENDING':
			return 'text-yellow-600';
		case 'STUP':
			return 'text-cyan-500';
		case 'PUSH':
			return 'text-blue-500';
		case 'TAXI':
		case 'TAXI_ORIG':
		case 'TAXI_ARRV':
			return 'text-pink-600';
		case 'RWY':
		case 'RWY_ORIG':
		case 'RWY_ARRV':
			return 'text-red-600';
		case 'DEPA':
			return 'text-green-600';
		case 'ENROUTE':
			return 'text-purple-500';
		case 'APP':
			return 'text-orange-500';
		case 'GATE':
			return 'text-emerald-600';
		default:
			return 'text-white';
	}
};

const getBgClass = (status: string) => {
	switch (status) {
		case 'RWY':
		case 'RWY_ORIG':
		case 'RWY_ARRV':
			return 'bg-red-600';
		default:
			return '';
	}
};

const getBorderClass = (status: string) => {
	switch (status) {
		case 'PENDING':
			return 'border-yellow-600';
		case 'STUP':
			return 'border-cyan-600';
		case 'PUSH':
			return 'border-blue-600';
		case 'TAXI':
		case 'TAXI_ORIG':
		case 'TAXI_ARRV':
			return 'border-pink-600';
		case 'RWY':
		case 'RWY_ORIG':
		case 'RWY_ARRV':
			return 'border-red-600';
		case 'DEPA':
			return 'border-green-600';
		case 'ENROUTE':
			return 'border-purple-600';
		case 'APP':
			return 'border-orange-600';
		case 'GATE':
			return 'border-emerald-600';
		default:
			return '';
	}
};

export default function StatusDropdown({
	value,
	onChange,
	disabled = false,
	size = 'md',
	placeholder = 'Select Status',
	controllerType = 'event',
}: StatusDropdownProps) {
	const statusOptions =
		controllerType === 'departure'
			? departureStatusOptions
			: controllerType === 'arrival'
			? arrivalStatusOptions
			: eventStatusOptions;

	const renderOption = (option: { value: string; label: string }) => (
		<span className={getColorClass(option.value)}>
			{option.label}
		</span>
	);

	const getDisplayValue = (selectedValue: string) => {
		if (!selectedValue) return placeholder;
		const option = statusOptions.find(opt => opt.value === selectedValue);
		return option?.label || selectedValue;
	};

	const bgClass = value ? getBgClass(value) : '';
	const borderClass = value ? getBorderClass(value) : '';
	const textClass = value ? 'text-white' : '';

	return (
		<Dropdown
			options={statusOptions}
			value={value}
			onChange={onChange}
			disabled={disabled}
			size={size}
			placeholder={placeholder}
			renderOption={renderOption}
			getDisplayValue={getDisplayValue}
			className={`${bgClass} ${borderClass} ${textClass} font-bold`}
		/>
	);
}
