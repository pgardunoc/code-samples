// Seeded 7-bag randomizer. All randomness flows through the mulberry32 state
// carried in `rng`, so a seed fully determines the piece sequence — that's what
// makes daily mode, replays and deterministic tests possible.

import type { PieceId } from './types';
import { PIECE_IDS } from './pieces';

export const QUEUE_LEN = 5;

export interface BagState {
  rng: number;
  bag: PieceId[]; // the current shuffled bag, dealt from the end
  queue: PieceId[]; // the visible next-piece preview, dealt from the front
}

// mulberry32 — mutates s.rng, returns a float in [0, 1).
export function rand(s: { rng: number }): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Fisher-Yates over a fresh bag of all 7 pieces.
function refill(s: BagState): void {
  const bag = [...PIECE_IDS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  s.bag = bag;
}

function draw(s: BagState): PieceId {
  if (s.bag.length === 0) refill(s);
  return s.bag.pop()!;
}

export function primeQueue(s: BagState): void {
  while (s.queue.length < QUEUE_LEN) s.queue.push(draw(s));
}

// Deal the next piece to play and keep the preview queue topped up.
export function nextPiece(s: BagState): PieceId {
  primeQueue(s);
  const id = s.queue.shift()!;
  s.queue.push(draw(s));
  return id;
}
