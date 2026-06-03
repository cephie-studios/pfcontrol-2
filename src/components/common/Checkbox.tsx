import type { ReactNode } from "react";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  className?: string;
  checkedClass?: string;
  /** Unchecked + non-flashing box (border / background). */
  uncheckedClass?: string;
  flashing?: boolean;
  id?: string;
  disabled?: boolean;
}

export default function Checkbox({
  checked,
  onChange,
  label,
  className = "",
  checkedClass = "bg-blue-600 border-blue-600",
  uncheckedClass = "bg-transparent border-gray-400",
  flashing = false,
  id,
  disabled = false,
}: CheckboxProps) {
  return (
    <label
      id={id}
      className={`checkbox flex items-center space-x-3 cursor-pointer ${className}`}
    >
      <div className="relative w-6 h-6">
        <input
          type="checkbox"
          className="absolute inset-0 w-6 h-6 opacity-0 cursor-pointer z-10"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />

        <div
          className={
            "w-6 h-6 border-2 rounded-md transition-colors flex items-center justify-center pointer-events-none " +
            (checked
              ? checkedClass
              : flashing
                ? "bg-green-500 border-green-500 animate-pulse"
                : uncheckedClass) +
            (disabled ? " opacity-50 cursor-not-allowed" : "")
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
