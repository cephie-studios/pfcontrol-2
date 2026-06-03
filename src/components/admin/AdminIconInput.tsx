import type { ReactNode } from "react";
import {
  ADMIN_DATETIME_INPUT,
  ADMIN_DATETIME_INPUT_ICON,
  ADMIN_FIELD_INPUT,
  ADMIN_FIELD_INPUT_ICON,
  ADMIN_INPUT_ICON_CLASS,
} from "./adminConstants";

type AdminIconInputProps = {
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "date" | "datetime-local" | "search";
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  label?: string;
  required?: boolean;
  "aria-label"?: string;
};

export default function AdminIconInput({
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
  className = "",
  inputClassName = "",
  label,
  required = false,
  "aria-label": ariaLabel,
}: AdminIconInputProps) {
  const isDate = type === "date" || type === "datetime-local";
  const inputClass = isDate
    ? `${ADMIN_DATETIME_INPUT_ICON} ${inputClassName}`.trim()
    : `${ADMIN_FIELD_INPUT_ICON} ${inputClassName}`.trim();

  const field = (
    <div
      className={`relative flex items-center shrink-0 ${label ? "w-full" : className || "w-full"}`}
    >
      <span className={ADMIN_INPUT_ICON_CLASS} aria-hidden>
        {icon}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel ?? label}
        className={`w-full min-w-0 ${inputClass}`}
      />
    </div>
  );

  if (!label) {
    return field;
  }

  return (
    <div className={className}>
      <label className="block text-xs text-zinc-500 mb-1.5">
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </label>
      {field}
    </div>
  );
}

export { ADMIN_FIELD_INPUT, ADMIN_DATETIME_INPUT };
