import { memo } from 'react';
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
  onFocus?: () => void;
  onBlur?: () => void;
  name?: string;
  required?: boolean;
  pattern?: string;
  editingAvatar?: string | null;
  editingUsername?: string;
}

function TextInput({
  value,
  onChange,
  placeholder = '',
  disabled = false,
  className = '',
  maxLength,
  autoFocus = false,
  onKeyDown,
  onFocus,
  onBlur,
  name,
  required = false,
  pattern,
  editingAvatar,
  editingUsername,
}: TextInputProps) {
  return (
    <div className="relative">
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
        onFocus={onFocus}
        onBlur={onBlur}
        name={name}
        required={required}
        pattern={pattern}
      />
      {editingAvatar && (
        <div className="absolute -top-1 -right-1 z-10 group">
          <img
            src={editingAvatar}
            alt={editingUsername || 'User editing'}
            className="w-5 h-5 rounded-full border border-blue-400 shadow-md"
            onError={(e) => {
              e.currentTarget.src = '/assets/app/default/avatar.webp';
            }}
          />
          {editingUsername && (
            <div className="absolute top-6 right-0 bg-black text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
              {editingUsername} is editing
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(TextInput);
