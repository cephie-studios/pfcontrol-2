import { cn } from '@/lib/utils';

export default function AcarsDivider({
  label,
  value,
  active,
  onPointerDown,
  onKeyStep,
}: {
  label: string;
  value: number;
  active: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onKeyStep: (delta: number) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onKeyStep(-5);
        else if (e.key === 'ArrowRight') onKeyStep(5);
        else return;
        e.preventDefault();
      }}
      className="group relative z-10 hidden w-px shrink-0 cursor-col-resize touch-none items-center justify-center bg-zinc-800 outline-none before:absolute before:inset-y-0 before:-right-2 before:-left-2 before:content-[''] md:flex"
    >
      <div
        className={cn(
          'absolute h-12 w-1 rounded-full transition-colors',
          active
            ? 'bg-blue-400'
            : 'bg-transparent group-hover:bg-blue-600 group-focus-visible:bg-blue-400'
        )}
      />
    </div>
  );
}
