import { useEffect, useState } from 'react';

export default function HolidayAnimations() {
  const [snowmanPosition, setSnowmanPosition] = useState(-200);
  const [snowmanDirection, setSnowmanDirection] = useState<'in' | 'out'>('in');
  const [showSnowman, setShowSnowman] = useState(true);

  useEffect(() => {
    const snowmanInterval = setInterval(() => {
      setSnowmanPosition((prev) => {
        if (snowmanDirection === 'in') {
          if (prev >= 20) {
            setTimeout(() => setSnowmanDirection('out'), 5000);
            return prev;
          }
          return prev + 0.5;
        } else {
          if (prev <= -200) {
            setTimeout(() => {
              setSnowmanDirection('in');
              setShowSnowman((prev) => !prev);
            }, 3000);
            return prev;
          }
          return prev - 0.5;
        }
      });
    }, 30);

    return () => clearInterval(snowmanInterval);
  }, [snowmanDirection]);

  return (
    <>
      <div
        className="fixed bottom-0 pointer-events-none transition-all duration-300"
        style={{
          left: `${snowmanPosition}px`,
          zIndex: 1,
        }}
      >
        <svg
          className="absolute bottom-0"
          style={{
            width: '250px',
            height: '80px',
            transform: 'translateY(40px)',
            zIndex: 1,
          }}
          viewBox="0 0 250 80"
          preserveAspectRatio="none"
        >
          <defs>
            <radialGradient id="snowmanDriftGradient" cx="50%" cy="30%">
              <stop
                offset="0%"
                style={{
                  stopColor: 'rgba(255, 255, 255, 0.98)',
                  stopOpacity: 0.98,
                }}
              />
              <stop
                offset="50%"
                style={{
                  stopColor: 'rgba(255, 255, 255, 0.85)',
                  stopOpacity: 0.85,
                }}
              />
              <stop
                offset="100%"
                style={{ stopColor: 'rgba(255, 255, 255, 0)', stopOpacity: 0 }}
              />
            </radialGradient>
          </defs>
          <ellipse
            cx="125"
            cy="60"
            rx="120"
            ry="40"
            fill="url(#snowmanDriftGradient)"
          />
          <ellipse
            cx="80"
            cy="65"
            rx="60"
            ry="25"
            fill="rgba(255, 255, 255, 0.6)"
            opacity="0.5"
          />
          <ellipse
            cx="170"
            cy="67"
            rx="55"
            ry="22"
            fill="rgba(255, 255, 255, 0.6)"
            opacity="0.5"
          />
        </svg>

        {showSnowman ? (
          <img
            src="/assets/app/holiday/SnowmanHappy.svg"
            alt="Happy Snowman"
            style={{
              width: '120px',
              height: 'auto',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
            }}
          />
        ) : (
          <img
            src="/assets/app/holiday/SnowmanOK.svg"
            alt="OK Snowman"
            style={{
              width: '120px',
              height: 'auto',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
            }}
          />
        )}
      </div>
    </>
  );
}
