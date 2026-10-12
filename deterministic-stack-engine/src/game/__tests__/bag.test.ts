import { describe, expect, it } from 'vitest';
import type { PieceId } from '../types';
import { PIECE_IDS } from '../pieces';
import { nextPiece, primeQueue, QUEUE_LEN, rand } from '../bag';

function bagState(seed: number) {
  return { rng: seed | 0, bag: [] as PieceId[], queue: [] as PieceId[] };
}

function deal(seed: number, count: number): PieceId[] {
  const s = bagState(seed);
  return Array.from({ length: count }, () => nextPiece(s));
}

describe('mulberry32 rand', () => {
  it('is deterministic for a given rng state and advances it', () => {
    const a = { rng: 42 };
    const b = { rng: 42 };
    const seqA = [rand(a), rand(a), rand(a)];
    const seqB = [rand(b), rand(b), rand(b)];
    expect(seqA).toEqual(seqB);
    expect(a.rng).not.toBe(42); // state advanced
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('7-bag randomizer', () => {
  it('every 7 consecutive pieces contain each shape exactly once', () => {
    const pieces = deal(123, 70);
    for (let i = 0; i < 70; i += 7) {
      const chunk = [...pieces.slice(i, i + 7)].sort();
      expect(chunk).toEqual([...PIECE_IDS].sort());
    }
  });

  it('the same seed deals the same sequence', () => {
    expect(deal(7, 28)).toEqual(deal(7, 28));
  });

  it('different seeds deal different sequences', () => {
    expect(deal(1, 28)).not.toEqual(deal(2, 28));
  });

  it('keeps the preview queue topped up at QUEUE_LEN', () => {
    const s = bagState(99);
    primeQueue(s);
    expect(s.queue).toHaveLength(QUEUE_LEN);
    for (let i = 0; i < 20; i++) {
      const upNext = s.queue[0];
      expect(nextPiece(s)).toBe(upNext); // the deal comes from the front of the queue
      expect(s.queue).toHaveLength(QUEUE_LEN);
    }
  });
});
