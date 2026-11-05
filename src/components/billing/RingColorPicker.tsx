import { cn } from '@/lib/utils';

export default function RingColorPicker({
  colors,
  onChange,
  disabled,
  className,
}: {
  colors: string[];
  onChange: (colors: string[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {colors.map((color, i) => (
        <label
          key={i}
          className={cn(
            'relative size-8 cursor-pointer rounded-full border-2 border-zinc-700 transition-colors focus-within:border-ring hover:border-zinc-500',
            disabled && 'pointer-events-none opacity-50'
          )}
          style={{ backgroundColor: color }}
        >
          <span className="sr-only">Ring colour {i + 1}</span>
          <input
            type="color"
            value={color}
            disabled={disabled}
            onChange={(e) =>
              onChange(colors.map((c, j) => (j === i ? e.target.value : c)))
            }
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
      ))}
    </div>
  );
}
