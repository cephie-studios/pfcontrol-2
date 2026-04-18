import React, { useEffect, useState } from 'react';
import { Star, MessageSquare, Plane, Radio, Play, Square } from 'lucide-react';

const AudioVisualizerButton: React.FC<{
  isPlaying: boolean;
  onClick: (e: React.MouseEvent) => void;
  label?: string;
  variant?: 'default' | 'custom' | 'notification' | 'newstrip' | 'acars-beep' | 'acars-chat';
}> = ({ isPlaying, onClick, label = 'Test', variant = 'default' }) => {
  const [glowIntensity, setGlowIntensity] = useState(0.3);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setGlowIntensity(Math.random() * 0.5 + 0.5);
      }, 150);
    } else {
      setGlowIntensity(0.3);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Color mapping based on your new palette
  const colors = {
    custom: 'yellow',
    notification: 'blue',
    newstrip: 'green',
    'acars-beep': 'cyan',
    'acars-chat': 'orange',
    default: 'purple',
  };

  const theme = colors[variant] || colors.default;

  return (
    <button
      onClick={onClick}
      className={`
        relative overflow-hidden group flex items-center justify-between px-4 py-2.5 
        rounded-lg border transition-all duration-300 min-w-[140px]
        ${isPlaying 
          ? `bg-${theme}-500/10 border-${theme}-500/50 text-${theme}-400 shadow-[0_0_15px_rgba(0,0,0,0.2)]` 
          : 'bg-zinc-800/30 border-zinc-700/50 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-800/50'}
      `}
      style={{
        boxShadow: isPlaying 
          ? `0 0 ${glowIntensity * 15}px -2px var(--tw-shadow-color)` 
          : 'none'
      }}
    >
      {/* Visualizer Bars - Made more subtle */}
      {isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center gap-0.5 opacity-10 pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-current rounded-full"
              style={{
                height: `${20 + Math.random() * 60}%`,
                transition: 'height 0.2s ease',
              }}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 relative z-10">
        <div className={`
          p-1.5 rounded-md border transition-colors
          ${isPlaying ? `bg-${theme}-500/20 border-${theme}-500/20` : 'bg-zinc-950/50 border-zinc-800'}
        `}>
          {variant === 'custom' && <Star size={14} />}
          {variant === 'default' && <Star size={14} />}
          {variant === 'notification' && <MessageSquare size={14} />}
          {variant === 'newstrip' && <Plane size={14} />}
          {variant === 'acars-beep' && <Radio size={14} />}
          {variant === 'acars-chat' && <MessageSquare size={14} />}
        </div>
        <span className="text-xs font-bold uppercase tracking-wider">
          {isPlaying ? 'Playing' : label}
        </span>
      </div>

      <div className="relative z-10 ml-2">
        {isPlaying ? (
          <Square size={12} className="fill-current animate-pulse" />
        ) : (
          <Play size={12} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
        )}
      </div>

      {/* Internal Scanline Effect for Active state */}
      {isPlaying && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
      )}
    </button>
  );
};

export default AudioVisualizerButton;