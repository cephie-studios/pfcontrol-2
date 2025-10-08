import type { ReactNode } from 'react';

interface CheckboxProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label: ReactNode;
	className?: string;
	checkedClass?: string; // e.g. 'bg-green-600 border-green-600'
	flashing?: boolean;    // when true and unchecked, fill green + pulse
}

export default function Checkbox({
	checked,
	onChange,
	label,
	className = '',
	checkedClass = 'bg-blue-600 border-blue-600',
	flashing = false,
}: CheckboxProps) {
	return (
		<label className={`checkbox flex items-center space-x-3 cursor-pointer ${className}`}>
			{/* Make the hit area explicit so clicks reliably toggle */}
			<div className="relative w-6 h-6">
				{/* REAL control — must be above visuals */}
				<input
					type="checkbox"
					className="absolute inset-0 w-6 h-6 opacity-0 cursor-pointer z-10"  // ⬅ on top
					checked={checked}
					onChange={(e) => onChange(e.target.checked)}
				/>

				{/* VISUAL square — never blocks clicks */}
				<div
					className={
						'w-6 h-6 border-2 rounded-md transition-colors flex items-center justify-center pointer-events-none ' +
						(checked
							? checkedClass // ✅ when checked: solid (e.g. green) with checkmark
							: (flashing
								? 'bg-green-500 border-green-500 animate-pulse' // ✅ flashing fill when pending
								: 'bg-transparent border-gray-400')) // normal unchecked
					}
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

			<span className="text-gray-200 select-none">{label}</span>
		</label>
	);
}
