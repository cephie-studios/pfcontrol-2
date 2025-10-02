import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DropdownOption } from '../../types/dropdown';

interface DropdownProps {
	options: DropdownOption[];
	placeholder?: string;
	value?: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	maxHeight?: string;
	renderOption?: (option: DropdownOption) => ReactNode;
	getDisplayValue?: (value: string, options: DropdownOption[]) => string;
	allowClear?: boolean;
	className?: string;
	size?: 'xs' | 'sm' | 'md' | 'lg';
}

const sizeClasses = {
	xs: 'px-1 py-1 text-sm',
	sm: 'px-2 py-2 text-sm',
	md: 'px-4 py-3 text-base',
	lg: 'px-6 py-4 text-lg'
};

export default function Dropdown({
	options,
	placeholder = 'Select option',
	value,
	onChange,
	disabled = false,
	maxHeight = 'max-h-60',
	renderOption,
	getDisplayValue,
	allowClear = false,
	className = '',
	size = 'md'
}: DropdownProps) {
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const selectedOption = options.find((option) => option.value === value);

	const displayValue = getDisplayValue
		? getDisplayValue(value || '', options)
		: selectedOption?.label || placeholder;

	const handleOptionClick = (optionValue: string) => {
		onChange(optionValue);
		setIsOpen(false);
	};

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOpen]);

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				onClick={() => !disabled && setIsOpen(!isOpen)}
				disabled={disabled}
				className={`flex items-center justify-between w-full bg-gray-800 border-2 border-blue-600 rounded-full text-left
                    ${
						disabled
							? 'opacity-70 cursor-not-allowed'
							: 'hover:bg-gray-650'
					} ${sizeClasses[size]} ${className}`}
			>
				<span className="truncate ml-2 font-semibold">
					{displayValue}
				</span>
				<span
					className="transition-transform duration-200 ml-2 flex-shrink-0"
					style={{
						display: 'flex',
						alignItems: 'center',
						transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
					}}
				>
					<ChevronDown className="h-4 w-4 text-gray-400" />
				</span>
			</button>

			{isOpen && (
				<div
					className={`absolute z-50 mt-1 w-full bg-gray-800 border border-blue-600 rounded-2xl shadow-lg py-1 ${maxHeight} overflow-y-scroll`}
					style={{
						scrollbarWidth: 'none',
						msOverflowStyle: 'none'
					}}
				>
					<style>{`
                        div::-webkit-scrollbar {
                            display: none;
                        }
                    `}</style>
					{allowClear && (
						<button
							className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-700 text-gray-400"
							onClick={() => handleOptionClick('')}
						>
							Clear selection
						</button>
					)}
					{options.map((option) => (
						<button
							key={option.value}
							className={`block w-full text-left px-3 py-2 text-sm hover:bg-blue-600 hover:text-white
                                ${
									option.selected || option.value === value
										? 'bg-gray-700 font-medium'
										: ''
								}`}
							onClick={() => handleOptionClick(option.value)}
						>
							{renderOption ? renderOption(option) : option.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
