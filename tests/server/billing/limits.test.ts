import { describe, expect, it } from 'vitest';
import {
  PLAN_LIMITS,
  hasLapsedAnimatedBackground,
} from '../../../server/billing/limits.js';
import { isAnimatedImage } from '../../../server/utils/animatedImage.js';
import { isRingColors } from '../../../server/billing/plans.js';

const gif = 'https://api.cephie.app/img/abc';

function webp(flags: number) {
  const buffer = Buffer.alloc(30);
  buffer.write('RIFF', 0, 'ascii');
  buffer.write('WEBP', 8, 'ascii');
  buffer.write('VP8X', 12, 'ascii');
  buffer[20] = flags;
  return buffer;
}

function png(chunks: string[]) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = chunks.map((type) => {
    const chunk = Buffer.alloc(12);
    chunk.writeUInt32BE(0, 0);
    chunk.write(type, 4, 'ascii');
    return chunk;
  });
  return Buffer.concat([signature, ...parts]);
}

describe('plan limits', () => {
  it('raises limits for Supporter', () => {
    expect(PLAN_LIMITS.supporter.maxSessions).toBeGreaterThan(
      PLAN_LIMITS.free.maxSessions
    );
    expect(PLAN_LIMITS.supporter.animatedBackgrounds).toBe(true);
  });

  it('flags a selected animated background once the perk is gone', () => {
    const settings = {
      animatedBackground: gif,
      backgroundImage: {
        selectedImage: gif,
        useCustomBackground: true,
        favorites: [],
      },
    };
    expect(hasLapsedAnimatedBackground(settings, PLAN_LIMITS.free)).toBe(true);
    expect(hasLapsedAnimatedBackground(settings, PLAN_LIMITS.supporter)).toBe(
      false
    );
    expect(
      hasLapsedAnimatedBackground(
        {
          ...settings,
          backgroundImage: { ...settings.backgroundImage, selectedImage: 'x' },
        },
        PLAN_LIMITS.free
      )
    ).toBe(false);
  });
});

describe('isAnimatedImage', () => {
  it('detects animated formats', () => {
    expect(isAnimatedImage(Buffer.alloc(0), 'image/gif')).toBe(true);
    expect(isAnimatedImage(webp(0x02), 'image/webp')).toBe(true);
    expect(isAnimatedImage(png(['IHDR', 'acTL', 'IDAT']), 'image/png')).toBe(
      true
    );
  });

  it('leaves still images alone', () => {
    expect(isAnimatedImage(webp(0x10), 'image/webp')).toBe(false);
    expect(isAnimatedImage(png(['IHDR', 'IDAT', 'acTL']), 'image/png')).toBe(
      false
    );
    expect(isAnimatedImage(Buffer.alloc(10), 'image/jpeg')).toBe(false);
  });
});

describe('ring colours', () => {
  it('accepts two or three hex colours', () => {
    expect(isRingColors(['#000000', '#ffffff'])).toBe(true);
    expect(isRingColors(['#00ff00', '#ABCDEF', '#123456'])).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isRingColors(['#000000'])).toBe(false);
    expect(isRingColors(['#000', '#fff'])).toBe(false);
    expect(isRingColors(['red', 'blue'])).toBe(false);
    expect(isRingColors(['#000000', '#000000', '#000000', '#000000'])).toBe(
      false
    );
    expect(isRingColors('#000000')).toBe(false);
  });
});
