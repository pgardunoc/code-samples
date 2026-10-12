// Shared types only — no logic in this file.

export type PieceId = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

// SRS rotation states: 0 = spawn, 1 = R (cw), 2 = 180, 3 = L (ccw).
export type Rotation = 0 | 1 | 2 | 3;

export type RotationDir = 'cw' | 'ccw';

// Board coordinates: x grows right, y grows DOWN (row 0 is the top buffer row).
export interface Cell {
  x: number;
  y: number;
}

export interface ActivePiece {
  id: PieceId;
  rot: Rotation;
  // Position of the piece's bounding-box top-left corner on the board.
  x: number;
  y: number;
}

export const BOARD_W = 10;
export const VISIBLE_H = 20;
export const BUFFER_H = 2; // hidden rows above the visible well where pieces spawn
export const BOARD_H = VISIBLE_H + BUFFER_H;

// board[y][x]: 0 = empty, 1–7 = locked cell (piece id it came from, for color mode).
export type Board = number[][];

export type Phase = 'ready' | 'playing' | 'clearing' | 'gameover';

// One-tick happenings, consumed by render/sfx.
export type GameEvent =
  | 'spawn'
  | 'move'
  | 'rotate'
  | 'hold'
  | 'harddrop'
  | 'lock'
  | 'clear'
  | 'quad'
  | 'levelup'
  | 'gameover';

export interface GameState {
  tick: number;
  phase: Phase;
  phaseTicks: number;
  board: Board;
  active: ActivePiece | null;
  hold: PieceId | null;
  usedHold: boolean;
  queue: PieceId[];
  bag: PieceId[];
  rng: number; // mulberry32 state — the ONLY source of randomness
  score: number;
  lines: number;
  level: number;
  lockTicks: number; // ticks the active piece has been grounded
  lockResets: number; // move/rotate resets used (capped)
  lowestY: number; // deepest row this piece has reached — reaching a new one refunds lock resets
  clearingRows: number[];
  gravityTicks: number; // ticks since last gravity step
  events: GameEvent[];
}

// Per-tick input snapshot. Edge-triggering (DAS/ARR, key-down vs held) is the
// component's job; the engine just consumes what it's told happened this tick.
export interface Input {
  left: boolean;
  right: boolean;
  softDrop: boolean;
  rotateCw: boolean;
  rotateCcw: boolean;
  hardDrop: boolean;
  hold: boolean;
  pause: boolean;
}
