import { Award } from 'lucide-react';
import type { Settings } from '../../types/settings';
import { AVAILABLE_ICONS, PRESET_COLORS, getIconComponent } from '../../utils/roles';

interface CustomBadgeSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

export default function CustomBadgeSettings({
  settings,
  onChange,
}: CustomBadgeSettingsProps) {
  const customBadge = settings?.customBadge;
  const name = customBadge?.name ?? '';
  const color = customBadge?.color ?? '#6366F1';
  const icon = customBadge?.icon ?? 'Award';

  const handleChange = (updates: { name?: string; color?: string; icon?: string }) => {
    if (!settings) return;
    const nextName = (updates.name ?? name).trim();
    const nextColor = updates.color ?? color;
    const nextIcon = updates.icon ?? icon;
    if (!nextName) {
      const { customBadge: _, ...rest } = settings;
      onChange(rest as Settings);
      return;
    }
    onChange({
      ...settings,
      customBadge: {
        name: nextName,
        color: nextColor,
        icon: nextIcon,
      },
    });
  };

  const BadgeIcon = getIconComponent(icon);

  return (
    <div className="bg-zinc-900 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-zinc-700/50 p-4 sm:p-6 z-1">
      <div className="flex items-center mb-4 sm:mb-6">
        <div className="p-2 bg-violet-500/20 rounded-lg mr-3 flex-shrink-0">
          <Award className="h-4 w-4 sm:h-5 sm:w-5 text-violet-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg md:text-xl font-semibold text-white truncate">
            Custom profile badge
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Show a custom badge on your profile and in sessions (Basic & Ultimate)
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Badge name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleChange({ name: e.target.value.slice(0, 24) })}
            placeholder="e.g. Top Controller"
            maxLength={24}
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <p className="text-xs text-zinc-500 mt-1">{name.length}/24</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleChange({ color: c })}
                className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-zinc-900"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? '#fff' : 'transparent',
                }}
                title={c}
              />
            ))}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="color"
                value={color}
                onChange={(e) => handleChange({ color: e.target.value })}
                className="w-8 h-8 rounded-full border-0 cursor-pointer bg-transparent"
              />
              <span className="text-xs text-zinc-400">Custom</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Icon
          </label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_ICONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleChange({ icon: value })}
                className={`flex items-center justify-center w-9 h-9 rounded-lg border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
                  icon === value
                    ? 'border-violet-500 bg-violet-500/20 text-violet-400'
                    : 'border-zinc-600 bg-zinc-800 text-zinc-400 hover:border-zinc-500'
                }`}
                title={label}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        {name && (
          <div className="pt-2">
            <p className="text-xs text-zinc-500 mb-2">Preview</p>
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border-2"
              style={{
                backgroundColor: `${color}20`,
                borderColor: `${color}80`,
              }}
            >
              <BadgeIcon className="h-4 w-4" style={{ color }} />
              <span className="text-sm font-semibold" style={{ color }}>
                {name}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
