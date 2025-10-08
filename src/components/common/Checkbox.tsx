import type { ReactNode } from 'react';

interface CheckboxProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label: ReactNode;
	className?: string;
	checkedClass?: string;
	// NEW: pass a flashing flag from parent to highlight this checkbox (avoids referencing external vars)
	flashing?: boolean;
}

export default function Checkbox({
	checked,
	onChange,
	label,
	className = '',
	checkedClass = 'bg-blue-600 border-blue-600',
	flashing = false
}: CheckboxProps) {
	return (
		<label
			className={`checkbox flex items-center space-x-3 cursor-pointer ${className}`}
		>
			<div className="relative">
				<input
					type="checkbox"
					className="absolute inset-0 w-6 h-6 opacity-0 cursor-pointer "
					checked={checked}
					onChange={(e) => onChange(e.target.checked)}
				/>
				<div
					className={`w-6 h-6 border-2 rounded-md transition-colors ${
						checked ? checkedClass : 'border-gray-400'
					} ${flashing ? 'ring-2 ring-blue-400 animate-pulse' : ''}`}
				>
					{checked && (
						<svg
							className="w-5 h-5 text-white"
							fill="none"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path d="M5 13l4 4L19 7" />
						</svg>
					)}
				</div>
			</div>
			<span className="text-gray-200">{label}</span>
		</label>
	);
}
