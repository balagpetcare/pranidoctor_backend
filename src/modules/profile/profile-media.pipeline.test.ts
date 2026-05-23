import { describe, expect, it } from 'vitest';

import { processProfileMediaBuffer } from './profile-media.pipeline.js';

// 1x1 PNG
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('processProfileMediaBuffer', () => {
  it('rejects gif mime', async () => {
    const gif = Buffer.from(
      'GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;',
    );
    const result = await processProfileMediaBuffer(gif, 'avatar');
    expect(result).toBe('INVALID_TYPE');
  });

  it('produces webp avatar main + thumb from png bytes', async () => {
    const result = await processProfileMediaBuffer(PNG_1X1, 'avatar');
    expect(result).not.toBe('INVALID_TYPE');
    if (result === 'INVALID_TYPE') return;
    expect(result.mainMime).toBe('image/webp');
    expect(result.thumbMime).toBe('image/webp');
    expect(result.mainWidth).toBeLessThanOrEqual(800);
    expect(result.mainHeight).toBeLessThanOrEqual(800);
    expect(result.thumbWidth).toBeLessThanOrEqual(200);
    expect(result.thumbHeight).toBeLessThanOrEqual(200);
    expect(result.mainBuffer.length).toBeGreaterThan(0);
    expect(result.thumbBuffer.length).toBeGreaterThan(0);
  });

  it('produces landscape cover dimensions', async () => {
    const result = await processProfileMediaBuffer(PNG_1X1, 'cover');
    expect(result).not.toBe('INVALID_TYPE');
    if (result === 'INVALID_TYPE') return;
    expect(result.mainWidth).toBeLessThanOrEqual(1600);
    expect(result.mainHeight).toBeLessThanOrEqual(900);
    expect(result.thumbWidth).toBeLessThanOrEqual(640);
    expect(result.thumbHeight).toBeLessThanOrEqual(360);
  });
});
