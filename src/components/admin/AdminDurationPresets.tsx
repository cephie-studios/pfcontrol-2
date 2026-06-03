import {
  ADMIN_SEGMENT_ACTIVE,
  ADMIN_SEGMENT_INACTIVE,
  ADMIN_TOOLBAR_HEIGHT,
} from "./adminConstants";
import { ADMIN_DURATION_PRESETS } from "./adminDurationPresetConfig";
import type { AdminDurationPresetId } from "./adminDurationPresetConfig";

type AdminDurationPresetsProps = {
  label?: string;
  activePreset: AdminDurationPresetId | null;
  onPreset: (
    durationMs: number,
    presetId: (typeof ADMIN_DURATION_PRESETS)[number]["id"]
  ) => void;
  onPermanent: () => void;
  className?: string;
};

export default function AdminDurationPresets({
  label = "Quick duration",
  activePreset,
  onPreset,
  onPermanent,
  className = "",
}: AdminDurationPresetsProps) {
  return (
    <div className={className}>
      {label ? (
        <span className="block text-xs text-zinc-500 mb-1.5">{label}</span>
      ) : null}
      <div
        className={`flex ${ADMIN_TOOLBAR_HEIGHT} w-full rounded-full border-2 border-blue-600 overflow-hidden`}
        role="group"
        aria-label={label}
      >
        {ADMIN_DURATION_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={activePreset === p.id}
            onClick={() => onPreset(p.ms, p.id)}
            className={`flex-1 h-full text-sm font-medium transition-colors ${
              activePreset === p.id
                ? ADMIN_SEGMENT_ACTIVE
                : ADMIN_SEGMENT_INACTIVE
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={activePreset === "permanent"}
          onClick={onPermanent}
          className={`flex-1 h-full text-sm font-medium transition-colors ${
            activePreset === "permanent"
              ? ADMIN_SEGMENT_ACTIVE
              : ADMIN_SEGMENT_INACTIVE
          }`}
        >
          Permanent
        </button>
      </div>
    </div>
  );
}
