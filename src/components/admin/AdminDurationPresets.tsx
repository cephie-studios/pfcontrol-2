import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { ADMIN_DURATION_PRESETS } from './adminDurationPresetConfig';
import type { AdminDurationPresetId } from './adminDurationPresetConfig';

type AdminDurationPresetsProps = {
  label?: string;
  activePreset: AdminDurationPresetId | null;
  onPreset: (
    durationMs: number,
    presetId: (typeof ADMIN_DURATION_PRESETS)[number]['id']
  ) => void;
  onPermanent: () => void;
  className?: string;
};

export default function AdminDurationPresets({
  label = 'Quick duration',
  activePreset,
  onPreset,
  onPermanent,
  className,
}: AdminDurationPresetsProps) {
  return (
    <div className={cn('grid gap-2', className)}>
      {label ? <Label>{label}</Label> : null}
      <ToggleGroup
        type="single"
        variant="outline"
        value={activePreset ?? ''}
        onValueChange={(id) => {
          if (!id) return;
          if (id === 'permanent') {
            onPermanent();
            return;
          }
          const preset = ADMIN_DURATION_PRESETS.find((p) => p.id === id);
          if (preset) onPreset(preset.ms, preset.id);
        }}
        className="w-full"
        aria-label={label}
      >
        {ADMIN_DURATION_PRESETS.map((p) => (
          <ToggleGroupItem key={p.id} value={p.id} className="flex-1">
            {p.label}
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem value="permanent" className="flex-1">
          Permanent
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
