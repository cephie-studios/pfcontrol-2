import type { ReactNode } from 'react';
import {
  ADMIN_DATETIME_INPUT,
  ADMIN_DATETIME_INPUT_ICON,
  ADMIN_FIELD_INPUT,
  ADMIN_FIELD_INPUT_ICON,
  ADMIN_INPUT_ICON_CLASS,
} from './adminConstants';

type AdminTextInputProps = {
  label?: string;
  icon?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'datetime-local' | 'date';
  disabled?: boolean;
  className?: string;
  required?: boolean;
};

export default function AdminTextInput({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  className = '',
  required = false,
}: AdminTextInputProps) {
  const isDate = type === 'datetime-local' || type === 'date';
  const inputClass = icon
    ? isDate
      ? ADMIN_DATETIME_INPUT_ICON
      : ADMIN_FIELD_INPUT_ICON
    : isDate
      ? ADMIN_DATETIME_INPUT
      : ADMIN_FIELD_INPUT;

  const input = (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={inputClass}
    />
  );

  return (
    <div className={className}>
      {label ? (
        <label className="block text-xs text-zinc-500 mb-1.5">
          {label}
          {required ? <span className="text-red-400"> *</span> : null}
        </label>
      ) : null}
      {icon ? (
        <div className="relative flex items-center w-full">
          <span className={ADMIN_INPUT_ICON_CLASS} aria-hidden>
            {icon}
          </span>
          {input}
        </div>
      ) : (
        input
      )}
    </div>
  );
}
