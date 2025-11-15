import { useState } from 'react';

interface MusicPlayerControlProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onSkip: () => void;
  currentTrack: string;
  enabled: boolean;
}

export default function MusicPlayerControl({
  isPlaying,
  onPlayPause,
  onSkip,
  currentTrack,
  enabled,
}: MusicPlayerControlProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!enabled) return null;

  const parseTrackInfo = (filename: string) => {
    const nameWithoutExt = filename.replace('.mp3', '');
    const parts = nameWithoutExt.split(' - ');
    if (parts.length >= 2) {
      return {
        artist: parts[0].trim(),
        trackName: parts.slice(1).join(' - ').trim(),
      };
    }
    return {
      artist: 'Unknown Artist',
      trackName: nameWithoutExt,
    };
  };

  const { artist, trackName } = parseTrackInfo(currentTrack);

  return (
    <div
      className="fixed right-4 bottom-5 transition-all duration-500 ease-in-out select-none"
      style={{
        zIndex: 100,
      }}
    >
      <svg
        className="absolute pointer-events-none transition-all duration-500"
        style={{
          width: isExpanded ? '280px' : '150px',
          height: isExpanded ? '90px' : '65px',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: -1,
        }}
        viewBox="0 0 280 90"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="snowDriftGradient" cx="50%" cy="40%">
            <stop
              offset="0%"
              style={{ stopColor: '#ffffff', stopOpacity: 0.98 }}
            />
            <stop
              offset="60%"
              style={{ stopColor: '#f0f9ff', stopOpacity: 0.85 }}
            />
            <stop
              offset="100%"
              style={{ stopColor: '#ffffff', stopOpacity: 0 }}
            />
          </radialGradient>
        </defs>
        <ellipse
          cx="140"
          cy="70"
          rx="130"
          ry="45"
          fill="url(#snowDriftGradient)"
        />
        <ellipse
          cx="85"
          cy="73"
          rx="60"
          ry="23"
          fill="rgba(255, 255, 255, 0.6)"
          opacity="0.5"
        />
        <ellipse
          cx="195"
          cy="74"
          rx="58"
          ry="21"
          fill="rgba(255, 255, 255, 0.6)"
          opacity="0.5"
        />
      </svg>

      {!isExpanded && isPlaying && (
        <>
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 animate-float-up-1 text-amber-600 text-xl opacity-80">
            ♪
          </div>
          <div className="absolute -top-12 left-1/3 animate-float-up-2 text-amber-500 text-lg opacity-70">
            ♫
          </div>
          <div className="absolute -top-10 left-2/3 animate-float-up-3 text-amber-600 text-base opacity-60">
            ♪
          </div>
        </>
      )}

      <svg
        className="transition-all duration-500 ease-in-out cursor-pointer"
        width={isExpanded ? '230' : '115'}
        height={isExpanded ? '250' : '125'}
        viewBox="0 0 230 250"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        onClick={(e) => {
          const target = e.target as SVGElement;
          if (
            target.classList.contains('control-knob') ||
            target.closest('.control-knob')
          ) {
            e.stopPropagation();
            return;
          }
          setIsExpanded(!isExpanded);
        }}
      >
        <defs>
          <linearGradient id="woodGrain" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#78350f" />
            <stop offset="50%" stopColor="#92400e" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>

          <radialGradient id="speakerGradient" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#1c1917" />
            <stop offset="100%" stopColor="#0c0a09" />
          </radialGradient>

          <linearGradient id="screenGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#422006" />
            <stop offset="100%" stopColor="#1c0a00" />
          </linearGradient>
        </defs>

        <rect
          x="20"
          y="25"
          width="190"
          height="170"
          rx="12"
          fill="url(#woodGrain)"
          stroke="#451a03"
          strokeWidth="3"
        />

        <path
          d="M 32 38 Q 50 42 70 38 T 110 38 T 160 38 T 198 38"
          stroke="#451a03"
          strokeWidth="0.6"
          opacity="0.3"
          fill="none"
        />
        <path
          d="M 32 70 Q 55 68 80 70 T 135 70 T 198 70"
          stroke="#451a03"
          strokeWidth="0.6"
          opacity="0.3"
          fill="none"
        />
        <path
          d="M 32 120 Q 60 123 90 120 T 160 120 T 198 120"
          stroke="#451a03"
          strokeWidth="0.6"
          opacity="0.3"
          fill="none"
        />
        <path
          d="M 32 165 Q 50 163 70 165 T 120 165 T 198 165"
          stroke="#451a03"
          strokeWidth="0.6"
          opacity="0.3"
          fill="none"
        />

        <rect
          x="35"
          y="45"
          width="160"
          height="45"
          rx="4"
          fill="url(#screenGradient)"
          stroke="#78350f"
          strokeWidth="2"
        />

        <rect
          x="39"
          y="49"
          width="152"
          height="37"
          rx="2"
          fill="#1c0a00"
          opacity="0.8"
        />

        {isExpanded ? (
          <>
            <text
              x="115"
              y="62"
              fontSize="9"
              fill="#fbbf24"
              textAnchor="middle"
              fontWeight="600"
            >
              {trackName.length > 20
                ? trackName.substring(0, 20) + '...'
                : trackName}
            </text>
            <text
              x="115"
              y="76"
              fontSize="7"
              fill="#f59e0b"
              textAnchor="middle"
              opacity="0.8"
            >
              {artist}
            </text>

            <circle
              cx="45"
              cy="66"
              r="3.5"
              fill={isPlaying ? '#22c55e' : '#ef4444'}
            >
              {isPlaying && (
                <animate
                  attributeName="opacity"
                  values="1;0.3;1"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              )}
            </circle>
          </>
        ) : (
          <>
            <circle
              cx="115"
              cy="66"
              r="4.5"
              fill={isPlaying ? '#22c55e' : '#ef4444'}
            >
              {isPlaying && (
                <animate
                  attributeName="opacity"
                  values="1;0.3;1"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              )}
            </circle>
          </>
        )}

        <rect
          x="35"
          y="105"
          width="160"
          height="55"
          rx="6"
          fill="url(#speakerGradient)"
          stroke="#78350f"
          strokeWidth="2"
        />

        {Array.from({ length: isExpanded ? 42 : 20 }).map((_, i) => {
          const row = Math.floor(i / (isExpanded ? 7 : 5));
          const col = i % (isExpanded ? 7 : 5);
          const x = 52 + col * (isExpanded ? 21 : 26);
          const y = 118 + row * 11;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="2.5"
              fill="#292524"
              opacity="0.6"
            />
          );
        })}

        {isExpanded && (
          <>
            <g
              onClick={(e) => {
                e.stopPropagation();
                onPlayPause();
              }}
              className="cursor-pointer control-knob"
              style={{ pointerEvents: 'auto' }}
            >
              <circle
                cx="70"
                cy="175"
                r="18"
                fill="#92400e"
                stroke="#451a03"
                strokeWidth="2"
              />
              <circle
                cx="70"
                cy="175"
                r="14"
                fill="url(#woodGrain)"
                stroke="#451a03"
                strokeWidth="1"
              />
              <line
                x1="70"
                y1="160"
                x2="70"
                y2="164"
                stroke="#451a03"
                strokeWidth="1.5"
              />
              <line
                x1="70"
                y1="186"
                x2="70"
                y2="190"
                stroke="#451a03"
                strokeWidth="1.5"
              />
              <line
                x1="55"
                y1="175"
                x2="59"
                y2="175"
                stroke="#451a03"
                strokeWidth="1.5"
              />
              <line
                x1="81"
                y1="175"
                x2="85"
                y2="175"
                stroke="#451a03"
                strokeWidth="1.5"
              />
              {isPlaying ? (
                <>
                  <rect x="65" y="170" width="3" height="10" fill="#fbbf24" />
                  <rect x="72" y="170" width="3" height="10" fill="#fbbf24" />
                </>
              ) : (
                <path d="M 66 170 L 66 180 L 75 175 Z" fill="#fbbf24" />
              )}
            </g>

            <g
              onClick={(e) => {
                e.stopPropagation();
                onSkip();
              }}
              className="cursor-pointer control-knob"
              style={{ pointerEvents: 'auto' }}
            >
              <circle
                cx="160"
                cy="175"
                r="15"
                fill="#92400e"
                stroke="#451a03"
                strokeWidth="2"
              />
              <circle
                cx="160"
                cy="175"
                r="11"
                fill="url(#woodGrain)"
                stroke="#451a03"
                strokeWidth="1"
              />
              <path d="M 155 170 L 155 180 L 163 175 Z" fill="#fbbf24" />
              <rect x="163" y="170" width="2" height="10" fill="#fbbf24" />
            </g>
          </>
        )}

        <text
          x="115"
          y="188"
          fontSize="8"
          fill="#78350f"
          textAnchor="middle"
          fontFamily="serif"
          fontStyle="italic"
        >
          Holiday Radio
        </text>

        <rect x="35" y="200" width="15" height="8" rx="3" fill="#451a03" />
        <rect x="180" y="200" width="15" height="8" rx="3" fill="#451a03" />
      </svg>

      <style>{`
        @keyframes float-up-1 {
          0% {
            transform: translateY(0) translateX(-50%);
            opacity: 0.8;
          }
          100% {
            transform: translateY(-40px) translateX(-50%);
            opacity: 0;
          }
        }

        @keyframes float-up-2 {
          0% {
            transform: translateY(0);
            opacity: 0.7;
          }
          100% {
            transform: translateY(-45px) translateX(5px);
            opacity: 0;
          }
        }

        @keyframes float-up-3 {
          0% {
            transform: translateY(0);
            opacity: 0.6;
          }
          100% {
            transform: translateY(-35px) translateX(-5px);
            opacity: 0;
          }
        }

        .animate-float-up-1 {
          animation: float-up-1 2s ease-in-out infinite;
        }

        .animate-float-up-2 {
          animation: float-up-2 2.3s ease-in-out infinite 0.3s;
        }

        .animate-float-up-3 {
          animation: float-up-3 2.1s ease-in-out infinite 0.6s;
        }
      `}</style>
    </div>
  );
}
