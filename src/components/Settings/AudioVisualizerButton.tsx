import React, { useEffect, useState } from 'react';
import { Star, MessageSquare, Plane, Radio } from 'lucide-react';

const AudioVisualizerButton: React.FC<{
  isPlaying: boolean;
  onClick: (e: React.MouseEvent) => void;
  label?: string;
  variant?:
    | 'default'
    | 'custom'
    | 'notification'
    | 'newstrip'
    | 'acars-beep'
    | 'acars-chat';
}> = ({ isPlaying, onClick, label = 'Test', variant = 'default' }) => {
  const [glowIntensity, setGlowIntensity] = useState(0.3);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isPlaying) {
      interval = setInterval(() => {
        setGlowIntensity(Math.random() * 0.7 + 0.3);
      }, 150);
    } else {
      setGlowIntensity(0.3);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  const baseClasses =
    'relative overflow-hidden flex items-center justify-center px-5 py-3 sm:py-2 border rounded-lg text-base sm:text-sm transition-all duration-200 min-h-[52px] sm:min-h-[40px] font-medium cursor-pointer';

  let variantClasses = '';

  if (variant === 'custom') {
    variantClasses = isPlaying
      ? 'bg-yellow-600/80 hover:bg-yellow-600/90 border-yellow-500/80 hover:border-yellow-500/90 text-white shadow-lg'
      : 'bg-yellow-600/60 hover:bg-yellow-600/80 border-yellow-500/60 hover:border-yellow-500/80 text-yellow-100 hover:text-white';
  } else if (variant === 'notification') {
    variantClasses = isPlaying
      ? 'bg-blue-600/80 hover:bg-blue-600/90 border-blue-500/80 hover:border-blue-500/90 text-white shadow-lg'
      : 'bg-blue-600/60 hover:bg-blue-600/80 border-blue-500/60 hover:border-blue-500/80 text-blue-100 hover:text-white';
  } else if (variant === 'newstrip') {
    variantClasses = isPlaying
      ? 'bg-green-600/80 hover:bg-green-600/90 border-green-500/80 hover:border-green-500/90 text-white shadow-lg'
      : 'bg-green-600/60 hover:bg-green-600/80 border-green-500/60 hover:border-green-500/80 text-green-100 hover:text-white';
  } else if (variant === 'acars-beep') {
    variantClasses = isPlaying
      ? 'bg-cyan-600/80 hover:bg-cyan-600/90 border-cyan-500/80 hover:border-cyan-500/90 text-white shadow-lg'
      : 'bg-cyan-600/60 hover:bg-cyan-600/80 border-cyan-500/60 hover:border-cyan-500/80 text-cyan-100 hover:text-white';
  } else if (variant === 'acars-chat') {
    variantClasses = isPlaying
      ? 'bg-orange-600/80 hover:bg-orange-600/90 border-orange-500/80 hover:border-orange-500/90 text-white shadow-lg'
      : 'bg-orange-600/60 hover:bg-orange-600/80 border-orange-500/60 hover:border-orange-500/80 text-orange-100 hover:text-white';
  } else {
    variantClasses = isPlaying
      ? 'bg-purple-600/80 hover:bg-purple-600/90 border-purple-500/80 hover:border-purple-500/90 text-white shadow-lg'
      : 'bg-purple-600/60 hover:bg-purple-600/80 border-purple-500/60 hover:border-purple-500/80 text-purple-100 hover:text-white';
  }

  const getGlowColor = () => {
    switch (variant) {
      case 'custom':
        return 'rgba(234, 179, 8';
      case 'notification':
        return 'rgba(59, 130, 246';
      case 'newstrip':
        return 'rgba(34, 197, 94';
      case 'acars-beep':
        return 'rgba(34, 211, 238';
      case 'acars-chat':
        return 'rgba(249, 115, 22';
      default:
        return 'rgba(147, 51, 234';
    }
  };

  const glowColor = getGlowColor();

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses}`}
      style={{
        boxShadow: isPlaying
          ? `0 0 ${glowIntensity * 20}px ${glowColor}, ${glowIntensity}), 0 0 ${
              glowIntensity * 40
            }px ${glowColor}, ${
              glowIntensity * 0.5
            }), 0 4px 12px rgba(0, 0, 0, 0.3)`
          : '0 2px 4px rgba(0, 0, 0, 0.1)',
      }}
    >
      {isPlaying && (
        <div className="absolute inset-0 flex items-end justify-center space-x-0.5 opacity-20 pointer-events-none">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="w-0.5 bg-white rounded-full"
              style={{
                height: `${30 + Math.sin(Date.now() * 0.01 + index) * 20}%`,
                animation: `pulse 0.3s ease-in-out infinite alternate`,
                animationDelay: `${index * 50}ms`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 flex items-center justify-center gap-2">
        {variant === 'custom' && <Star className="h-4 w-4" />}
        {variant === 'default' && <Star className="h-4 w-4" />}
        {variant === 'notification' && <MessageSquare className="h-4 w-4" />}
        {variant === 'newstrip' && <Plane className="h-4 w-4" />}
        {variant === 'acars-beep' && <Radio className="h-4 w-4" />}
        {variant === 'acars-chat' && <MessageSquare className="h-4 w-4" />}
        <span>{isPlaying ? 'Stop' : label}</span>
      </div>

      <style>{`
				@keyframes pulse {
					0% {
						transform: scaleY(0.8);
					}
					100% {
						transform: scaleY(1.2);
					}
				}
			`}</style>
    </button>
  );
};

export default AudioVisualizerButton;
