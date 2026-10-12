import { describe, expect, it } from 'vitest';
import { dailyKey, dailyLabel, dailySeed } from '../daily';
import { newGame, tick } from '../engine';
import type { Input } from '../types';

describe('daily seed', () => {
  it('same UTC day → same seed, regardless of local time of day', () => {
    const morning = new Date(Date.UTC(2026, 7, 25, 0, 1));
    const night = new Date(Date.UTC(2026, 7, 25, 23, 59));
    expect(dailySeed(morning)).toBe(dailySeed(night));
    expect(dailySeed(morning)).toBe(20260825);
  });

  it('different days → different seeds', () => {
    expect(dailySeed(new Date(Date.UTC(2026, 7, 25)))).not.toBe(
      dailySeed(new Date(Date.UTC(2026, 7, 26)))
    );
  });

  it('key and label format', () => {
    const d = new Date(Date.UTC(2026, 7, 25));
    expect(dailyKey(d)).toBe('2026-08-25');
    expect(dailyLabel(d)).toBe('AUG 25');
  });

  it('two players on the same daily seed play identical games', () => {
    const seed = dailySeed(new Date(Date.UTC(2026, 7, 25)));
    const a = newGame(seed);
    const b = newGame(seed);
    const input = (t: number): Input => ({
      left: t % 5 === 0,
      right: false,
      softDrop: t % 2 === 0,
      rotateCw: t % 9 === 0,
      rotateCcw: false,
      hardDrop: t % 60 === 0,
      hold: t % 77 === 0,
      pause: false,
    });
    for (let t = 1; t <= 400; t++) {
      tick(a, input(t));
      tick(b, input(t));
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
