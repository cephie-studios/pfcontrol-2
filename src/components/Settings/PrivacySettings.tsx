import { User, Link2, Shield, Image, Star } from 'lucide-react';
import type { Settings } from '../../types/settings';

// DESIGN TOKENS (Shared across all 6 components)
const TOKENS = {
  section: "bg-zinc-800/40 border border-zinc-700/30 rounded-lg p-5 transition-all duration-200",
  iconBox: "p-2.5 rounded-lg flex-shrink-0 flex items-center justify-center",
  label: "text-zinc-100 font-medium text-sm sm:text-base",
  description: "text-zinc-400 text-xs sm:text-sm mt-0.5 leading-relaxed",
  toggle: {
    base: "relative w-11 h-6 rounded-full transition-all duration-200 outline-none",
    dot: "absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-200",
  }
};

interface PrivacySettingsProps {
  settings: Settings | null;
  onChange: (updatedSettings: Settings) => void;
}

export default function PrivacySettings({ settings, onChange }: PrivacySettingsProps) {
  if (!settings) return null;

  const toggleSetting = (key: keyof Settings) => {
    onChange({
      ...settings,
      [key]: !settings[key],
    });
  };

  const SETTINGS_MAP = [
    { 
      id: 'displayStatsOnProfile', 
      label: 'Display Statistics', 
      desc: 'Show sessions created, time controlling, and total flights.', 
      icon: User, 
      color: 'blue' 
    },
    { 
      id: 'displayControllerRatingOnProfile', 
      label: 'Controller Rating', 
      desc: 'Show your average controller rating and total feedback.', 
      icon: Star, 
      color: 'yellow' 
    },
    { 
      id: 'displayLinkedAccountsOnProfile', 
      label: 'Linked Accounts', 
      desc: 'Visibility for Roblox and VATSIM integrations.', 
      icon: Link2, 
      color: 'purple' 
    },
    { 
      id: 'displayBackgroundOnProfile', 
      label: 'Profile Background', 
      desc: 'Show your selected background image in your profile header.', 
      icon: Image, 
      color: 'emerald' 
    },
    { 
      id: 'hideFromLeaderboard', 
      label: 'Leaderboard Privacy', 
      desc: 'Opt out of appearing in the homepage rankings.', 
      icon: Shield, 
      color: 'rose' 
    },
  ];

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-500',
    yellow: 'bg-yellow-500/10 text-yellow-500',
    purple: 'bg-purple-500/10 text-purple-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    rose: 'bg-rose-500/10 text-rose-500',
  };

  return (
    <div className="p-5 space-y-3">
      {SETTINGS_MAP.map((item) => {
        const isChecked = !!settings[item.id as keyof Settings];
        
        return (
          <div key={item.id} className={TOKENS.section}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className={`${TOKENS.iconBox} ${colorClasses[item.color]}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h4 className={TOKENS.label}>{item.label}</h4>
                  <p className={TOKENS.description}>{item.desc}</p>
                </div>
              </div>

              {/* Standardized Toggle */}
              <button
                onClick={() => toggleSetting(item.id as keyof Settings)}
                className={`${TOKENS.toggle.base} ${isChecked ? 'bg-green-600' : 'bg-zinc-700'}`}
              >
                <div className={`${TOKENS.toggle.dot} ${isChecked ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
