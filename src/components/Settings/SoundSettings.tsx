import { Image, UserCircle, Palette, CheckCircle2 } from 'lucide-react';
import type { Settings } from '../../types/settings';
import Button from '../common/Button';

// SHARED DESIGN TOKENS
const TOKENS = {
  container: "bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden",
  header: "w-full p-5 border-b border-zinc-800 flex items-center justify-between gap-3",
  iconBox: "p-2.5 rounded-lg flex-shrink-0 flex items-center justify-center",
  section: "bg-zinc-800/40 border border-zinc-700/30 rounded-lg p-5 transition-all duration-200",
  title: "text-lg font-semibold text-zinc-100",
  description: "text-zinc-400 text-sm mt-0.5",
  label: "text-white font-medium mb-3 block",
};

interface BackgroundSettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

export default function BackgroundSettings({ settings, onChange }: BackgroundSettingsProps) {
  if (!settings) return null;

  const updateBackground = (url: string) => {
    onChange({ ...settings, profileBackgroundUrl: url });
  };

  const PRESETS = [
    { name: 'Midnight', url: '/bg/midnight.jpg', color: 'bg-zinc-950' },
    { name: 'Skyline', url: '/bg/skyline.jpg', color: 'bg-blue-900' },
    { name: 'Terminal', url: '/bg/terminal.jpg', color: 'bg-emerald-950' },
  ];

  return (
    <div className={TOKENS.container}>
      {/* Unified Header */}
      <div className={TOKENS.header}>
        <div className="flex items-center gap-4">
          <div className={`${TOKENS.iconBox} bg-indigo-500/10`}>
            <Palette className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <h3 className={TOKENS.title}>Appearance & Background</h3>
            <p className={TOKENS.description}>Customize your profile's visual presence</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Background Selection Section */}
        <div className={TOKENS.section}>
          <label className={TOKENS.label}>Profile Background</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PRESETS.map((bg) => (
              <button
                key={bg.url}
                onClick={() => updateBackground(bg.url)}
                className={`relative h-20 rounded-lg border-2 transition-all overflow-hidden ${
                  settings.profileBackgroundUrl === bg.url 
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
                    : 'border-zinc-700 hover:border-zinc-500'
                } ${bg.color}`}
              >
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold uppercase tracking-wider text-white/50">
                  {bg.name}
                </span>
                {settings.profileBackgroundUrl === bg.url && (
                  <div className="absolute top-2 right-2 bg-indigo-500 rounded-full p-0.5">
                    <CheckCircle2 className="h-3 w-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
          
          <div className="mt-4">
            <input
              type="text"
              placeholder="Custom Image URL..."
              value={settings.profileBackgroundUrl}
              onChange={(e) => updateBackground(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Avatar Scale Section */}
        <div className={TOKENS.section}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`${TOKENS.iconBox} bg-amber-500/10`}>
              <UserCircle className="h-5 w-5 text-amber-500" />
            </div>
            <h4 className="text-zinc-100 font-medium">Avatar Display Size</h4>
          </div>
          
          <div className="flex gap-2">
            {['Small', 'Normal', 'Large'].map((size) => (
              <Button
                key={size}
                variant={settings.avatarSize === size.toLowerCase() ? 'primary' : 'secondary'}
                className="flex-1 py-2 text-xs"
                onClick={() => onChange({ ...settings, avatarSize: size.toLowerCase() })}
              >
                {size}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
