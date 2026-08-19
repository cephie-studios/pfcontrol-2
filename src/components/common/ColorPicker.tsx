import { PRESET_COLORS } from '../../utils/roles';

interface ColorPickerProps {
  value: string | null;
  onChange: (hex: string) => void;
  onClear?: () => void;
  presets?: string[];
  label?: string;
  defaultValue?: string;
}

export default function ColorPicker({
  value,
  onChange,
  onClear,
  presets = PRESET_COLORS,
  label,
  defaultValue = '#6366F1',
}: ColorPickerProps) {
  const displayValue = value ?? defaultValue;

  return (
    <div>
      {label && (
        <span className="block text-xs text-zinc-500 mb-1.5">{label}</span>
      )}
      <div className="grid grid-cols-5 gap-2 mb-2">
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`h-9 rounded-lg border-2 transition-all ${
              value === color
                ? 'border-white ring-2 ring-white/40'
                : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="color"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          className="pf-color-swatch-input appearance-none p-0 h-10 flex-1 rounded-full border-2 border-blue-600 bg-zinc-900 cursor-pointer"
        />
        <input
          type="text"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 h-10 px-3 rounded-full border-2 border-blue-600 bg-gray-800 text-white text-sm font-mono"
        />
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={value === null}
            className="px-3 h-10 rounded-full border-2 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-zinc-400 disabled:hover:border-zinc-700"
          >
            Reset
          </button>
        )}
      </div>

      <style>{`
        .pf-color-swatch-input::-webkit-color-swatch-wrapper {
          padding: 0;
          border-radius: 9999px;
        }
        .pf-color-swatch-input::-webkit-color-swatch {
          border: none;
          border-radius: 9999px;
        }
        .pf-color-swatch-input::-moz-color-swatch {
          border: none;
          border-radius: 9999px;
        }
      `}</style>
    </div>
  );
}
