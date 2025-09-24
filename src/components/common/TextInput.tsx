import type { ChangeEvent } from 'react';

interface TextInputProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	maxLength?: number;
	autoFocus?: boolean;
	onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function TextInput({
	value,
	onChange,
	placeholder = '',
	disabled = false,
	className = '',
	maxLength,
	autoFocus = false,
	onKeyDown
}: TextInputProps) {
	return (
		<input
			type="text"
			className={`bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white w-full text-base transition-all focus:border-blue-600 focus:outline-none ${className}`}
			value={value}
			onChange={(e: ChangeEvent<HTMLInputElement>) =>
				onChange(e.target.value)
			}
			placeholder={placeholder}
			disabled={disabled}
			maxLength={maxLength}
			autoFocus={autoFocus}
			onKeyDown={onKeyDown}
		/>
	);
}
