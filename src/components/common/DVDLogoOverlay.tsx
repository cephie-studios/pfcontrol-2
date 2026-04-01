import { useEffect, useRef, useState, type CSSProperties } from 'react';

type Vector = {
  x: number;
  y: number;
};

const LOGO_WIDTH = 120;
const LOGO_HEIGHT = 56;
const TRAIL_LIFETIME_MS = 3000;
const TRAIL_SPAWN_INTERVAL_MS = 100;

const randomSign = () => (Math.random() > 0.5 ? 1 : -1);
const randomRange = (min: number, max: number) =>
  min + Math.random() * (max - min);

type TrailPoint = {
  id: number;
  x: number;
  y: number;
  rotation: number;
  speedFactor: number;
  createdAt: number;
};

export default function DVDLogoOverlay() {
  const logoRef = useRef<HTMLDivElement | null>(null);
  const [trailPoints, setTrailPoints] = useState<TrailPoint[]>([]);
  const [isEnabled, setIsEnabled] = useState(() => {
    try {
      return localStorage.getItem('dvdOverlayEnabled') !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('dvdOverlayEnabled', String(isEnabled));
    } catch {
      // Ignore storage errors in private mode.
    }
  }, [isEnabled]);

  useEffect(() => {
    if (!isEnabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTrailPoints([]);
      return;
    }

    const logoEl = logoRef.current;

    if (!logoEl) {
      return;
    }

    const state = {
      position: {
        x: Math.random() * Math.max(1, window.innerWidth - LOGO_WIDTH),
        y: Math.random() * Math.max(1, window.innerHeight - LOGO_HEIGHT),
      } as Vector,
      speed: randomRange(120, 320),
      targetSpeed: randomRange(180, 520),
      nextSpeedShiftAt: randomRange(0.35, 1.4),
      heading: Math.atan2(randomSign() * randomRange(0.65, 1), randomSign()),
      turnRate: randomRange(-0.95, 0.95),
      time: 0,
      lastTimestamp: performance.now(),
      lastTrailTimestamp: performance.now(),
      trailId: 0,
    };

    let frameId = 0;

    const onResize = () => {
      state.position.x = Math.min(state.position.x, window.innerWidth - LOGO_WIDTH);
      state.position.y = Math.min(
        state.position.y,
        window.innerHeight - LOGO_HEIGHT
      );
    };

    window.addEventListener('resize', onResize);

    const animate = (timestamp: number) => {
      const dt = Math.min((timestamp - state.lastTimestamp) / 1000, 0.035);
      state.lastTimestamp = timestamp;
      state.time += dt;

      if (state.time >= state.nextSpeedShiftAt) {
        const burstChance = Math.random();
        if (burstChance > 0.62) {
          state.targetSpeed = randomRange(520, 860);
        } else if (burstChance < 0.22) {
          state.targetSpeed = randomRange(75, 170);
        } else {
          state.targetSpeed = randomRange(170, 540);
        }
        state.nextSpeedShiftAt = state.time + randomRange(0.3, 1.25);
      }

      const pulse = Math.sin(state.time * 2.3) * 48;
      state.speed +=
        (state.targetSpeed + pulse - state.speed) * Math.min(1, dt * 3.6);
      state.speed = Math.min(900, Math.max(60, state.speed));

      const smoothCurve = Math.sin(state.time * 0.8) * 0.35;
      const wanderCurve = Math.sin(state.time * 1.9 + Math.cos(state.time * 0.55)) * 0.2;
      const targetTurnRate = smoothCurve + wanderCurve;

      // Lerp keeps steering smooth and avoids sudden direction snaps.
      state.turnRate += (targetTurnRate - state.turnRate) * Math.min(1, dt * 1.8);
      state.heading += state.turnRate * dt;

      const velocity = {
        x: Math.cos(state.heading) * state.speed,
        y: Math.sin(state.heading) * state.speed,
      };

      state.position.x += velocity.x * dt;
      state.position.y += velocity.y * dt;

      const maxX = Math.max(0, window.innerWidth - LOGO_WIDTH);
      const maxY = Math.max(0, window.innerHeight - LOGO_HEIGHT);

      let bouncedX = false;
      let bouncedY = false;

      if (state.position.x <= 0 || state.position.x >= maxX) {
        state.position.x = Math.min(Math.max(state.position.x, 0), maxX);
        state.heading = Math.PI - state.heading;
        state.turnRate *= -0.75;
        state.targetSpeed = randomRange(200, 760);
        state.speed = Math.min(900, Math.max(60, state.speed * randomRange(0.88, 1.2)));
        bouncedX = true;
      }

      if (state.position.y <= 0 || state.position.y >= maxY) {
        state.position.y = Math.min(Math.max(state.position.y, 0), maxY);
        state.heading = -state.heading;
        state.turnRate *= -0.75;
        state.targetSpeed = randomRange(200, 760);
        state.speed = Math.min(900, Math.max(60, state.speed * randomRange(0.88, 1.2)));
        bouncedY = true;
      }

      if (bouncedX && bouncedY) {
        logoEl.classList.remove('dvd-logo-corner-hit');
        // Restarting the animation class makes corner hits visually pop.
        void logoEl.offsetWidth;
        logoEl.classList.add('dvd-logo-corner-hit');
      }

      const rotation = Math.sin(state.time * 1.6) * 7 + state.turnRate * 8;
      logoEl.style.transform = `translate(${state.position.x}px, ${state.position.y}px) rotate(${rotation}deg)`;

      if (timestamp - state.lastTrailTimestamp >= TRAIL_SPAWN_INTERVAL_MS) {
        state.lastTrailTimestamp = timestamp;
        const now = performance.now();
        const speedFactor = Math.min(1, Math.max(0, (state.speed - 60) / 840));
        const trailPoint: TrailPoint = {
          id: state.trailId,
          x: state.position.x,
          y: state.position.y,
          rotation,
          speedFactor,
          createdAt: now,
        };
        state.trailId += 1;

        setTrailPoints((prev) =>
          [...prev, trailPoint].filter(
            (point) => now - point.createdAt <= TRAIL_LIFETIME_MS
          )
        );
      }

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameId);
      setTrailPoints([]);
    };
  }, [isEnabled]);

  const handleToggle = () => {
    setIsEnabled((prev) => !prev);
  };

  return (
    <div className="dvd-overlay">
      <button
        type="button"
        className="dvd-toggle"
        onClick={handleToggle}
        aria-pressed={isEnabled}
      >
        <span className="dvd-toggle-label">DVD</span>
        <span className={`dvd-toggle-track ${isEnabled ? 'is-on' : ''}`}>
          <span className="dvd-toggle-thumb" />
        </span>
      </button>

      {isEnabled &&
        trailPoints.map((point) => (
          <img
            key={point.id}
            src="/assets/images/dvd-logo.svg"
            alt=""
            aria-hidden="true"
            className="dvd-trail-logo"
            style={
              {
                transform: `translate(${point.x}px, ${point.y}px) rotate(${point.rotation}deg)`,
                '--trail-intensity': point.speedFactor.toFixed(3),
              } as CSSProperties
            }
          />
        ))}

      <div
        ref={logoRef}
        className={`dvd-logo ${isEnabled ? '' : 'is-hidden'}`}
        role="presentation"
      >
        <img
          src="/assets/images/dvd-logo.svg"
          alt="DVD logo"
          className="dvd-logo-image"
          draggable={false}
        />
      </div>
    </div>
  );
}