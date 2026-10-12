// Pure game engine: tick(state, input) mutates the state in place. No DOM, no
// Date.now, no unseeded randomness — a seed plus an input log replays a whole
// game byte-for-byte.

import type {
  ActivePiece,
  Board,
  Cell,
  GameState,
  Input,
  PieceId,
} from './types';
import { BOARD_H, BOARD_W, BUFFER_H } from './types';
import { cellsAt, PIECE_IDS, tryRotate } from './pieces';
import { nextPiece, primeQueue } from './bag';

// --- tuning (all in ticks; the loop runs at a fixed 60 Hz timestep) ---------
export const TICK_MS = 1000 / 60;
export const LOCK_DELAY_TICKS = 30; // ~500ms grounded before locking
export const LOCK_RESET_CAP = 15; // moves/rotates that may reset the lock timer
export const CLEAR_TICKS = 12; // line-clear flash duration

const LINE_SCORES = [0, 100, 300, 500, 800]; // x level; index = rows cleared

// Ticks per one-row gravity step, indexed by level (clamped at the end).
const GRAVITY_TABLE = [48, 42, 36, 30, 25, 20, 16, 12, 9, 7, 5, 4, 3, 2, 2, 1];

export function gravityTicks(level: number): number {
  return GRAVITY_TABLE[Math.min(level - 1, GRAVITY_TABLE.length - 1)];
}

// Spawn with the whole piece inside the hidden buffer rows, horizontally centered.
const SPAWN_X: Record<PieceId, number> = { I: 3, O: 4, T: 3, S: 3, Z: 3, J: 3, L: 3 };

export function emptyBoard(): Board {
  return Array.from({ length: BOARD_H }, () => Array<number>(BOARD_W).fill(0));
}

// y < 0 is open air above the buffer (SRS kicks may briefly go there).
export function collides(board: Board, cells: Cell[]): boolean {
  return cells.some(
    ({ x, y }) =>
      x < 0 || x >= BOARD_W || y >= BOARD_H || (y >= 0 && board[y][x] !== 0)
  );
}

export function newGame(seed: number): GameState {
  const s: GameState = {
    tick: 0,
    phase: 'ready',
    phaseTicks: 0,
    board: emptyBoard(),
    active: null,
    hold: null,
    usedHold: false,
    queue: [],
    bag: [],
    rng: seed | 0,
    score: 0,
    lines: 0,
    level: 1,
    lockTicks: 0,
    lockResets: 0,
    lowestY: 0,
    clearingRows: [],
    gravityTicks: 0,
    events: [],
  };
  primeQueue(s); // preview is visible on the ready screen
  return s;
}

function canPlace(s: GameState, piece: ActivePiece): boolean {
  return !collides(s.board, cellsAt(piece));
}

// Spawn a fresh piece — from the queue by default, or a specific id (hold swap).
function spawn(s: GameState, id: PieceId = nextPiece(s)): void {
  const piece: ActivePiece = { id, rot: 0, x: SPAWN_X[id], y: 0 };
  s.active = piece;
  s.usedHold = false;
  s.gravityTicks = 0;
  s.lockTicks = 0;
  s.lockResets = 0;
  s.lowestY = piece.y;
  if (!canPlace(s, piece)) {
    gameOver(s);
    return;
  }
  s.events.push('spawn');
}

function gameOver(s: GameState): void {
  s.phase = 'gameover';
  s.events.push('gameover');
}

const grounded = (s: GameState) =>
  !canPlace(s, { ...s.active!, y: s.active!.y + 1 });

// A successful move/rotate refreshes the lock timer — but only CAP times per
// piece, so a piece can't hover forever. Resets are refunded when the piece
// falls to a new lowest row (standard "move reset" behavior).
function onMoveReset(s: GameState): void {
  if (s.lockResets < LOCK_RESET_CAP) {
    s.lockResets++;
    s.lockTicks = 0;
  }
}

function lockPiece(s: GameState): void {
  const piece = s.active!;
  const cells = cellsAt(piece);
  // Locking with any cell above the board = topped out mid-kick; treat as over.
  if (cells.some(({ y }) => y < 0)) {
    gameOver(s);
    return;
  }
  const value = PIECE_IDS.indexOf(piece.id) + 1;
  for (const { x, y } of cells) s.board[y][x] = value;
  s.active = null;
  s.events.push('lock');

  // Lock-out: the whole piece came to rest inside the hidden buffer.
  if (cells.every(({ y }) => y < BUFFER_H)) {
    gameOver(s);
    return;
  }

  const full: number[] = [];
  for (let y = 0; y < BOARD_H; y++) {
    if (s.board[y].every((c) => c !== 0)) full.push(y);
  }
  if (full.length > 0) {
    s.score += LINE_SCORES[full.length] * s.level;
    s.clearingRows = full;
    s.phase = 'clearing';
    s.phaseTicks = CLEAR_TICKS;
    s.events.push(full.length === 4 ? 'quad' : 'clear');
  } else {
    spawn(s);
  }
}

function stepClearing(s: GameState): void {
  s.phaseTicks--;
  if (s.phaseTicks > 0) return;
  const cleared = s.clearingRows.length;
  s.board = s.board.filter((_, y) => !s.clearingRows.includes(y));
  while (s.board.length < BOARD_H) s.board.unshift(Array<number>(BOARD_W).fill(0));
  s.clearingRows = [];
  s.lines += cleared;
  const level = 1 + Math.floor(s.lines / 10);
  if (level > s.level) {
    s.level = level;
    s.events.push('levelup');
  }
  s.phase = 'playing';
  spawn(s);
}

function stepPlaying(s: GameState, input: Input): void {
  // Hold: stash the active piece, bring out the held one (or the next from the
  // queue). Once per piece — the flag clears when a piece locks.
  if (input.hold && !s.usedHold) {
    const stashed = s.active!.id;
    const comingOut = s.hold;
    s.hold = stashed;
    if (comingOut === null) spawn(s);
    else spawn(s, comingOut);
    s.usedHold = true; // spawn() cleared it; re-arm until this piece locks
    s.events.push('hold');
    return;
  }

  // Rotation first, so rotate + hard-drop on the same tick spins before slamming.
  if (input.rotateCw !== input.rotateCcw) {
    const result = tryRotate(s.active!, input.rotateCw ? 'cw' : 'ccw', (cells) =>
      collides(s.board, cells)
    );
    if (result) {
      s.active = result.piece;
      s.events.push('rotate');
      onMoveReset(s);
    }
  }

  let dx = 0;
  if (input.left) dx--;
  if (input.right) dx++;
  if (dx !== 0 && canPlace(s, { ...s.active!, x: s.active!.x + dx })) {
    s.active!.x += dx;
    s.events.push('move');
    onMoveReset(s);
  }

  if (input.hardDrop) {
    let dist = 0;
    while (canPlace(s, { ...s.active!, y: s.active!.y + 1 })) {
      s.active!.y++;
      dist++;
    }
    s.score += 2 * dist;
    s.events.push('harddrop');
    lockPiece(s);
    return;
  }

  // Gravity: one row every gravityTicks(level) ticks; soft drop = every tick.
  s.gravityTicks++;
  const g = input.softDrop ? 1 : gravityTicks(s.level);
  if (s.gravityTicks >= g) {
    s.gravityTicks = 0;
    if (!grounded(s)) {
      s.active!.y++;
      if (input.softDrop) s.score += 1;
      s.lockTicks = 0;
      if (s.active!.y > s.lowestY) {
        s.lowestY = s.active!.y;
        s.lockResets = 0; // fresh resets at a new depth
      }
    }
  }

  if (grounded(s)) {
    s.lockTicks++;
    if (s.lockTicks >= LOCK_DELAY_TICKS) lockPiece(s);
  }
}

const anyAction = (input: Input) =>
  input.left ||
  input.right ||
  input.softDrop ||
  input.rotateCw ||
  input.rotateCcw ||
  input.hardDrop ||
  input.hold;

export function tick(s: GameState, input: Input): void {
  if (s.phase === 'gameover') return;
  s.tick++;
  s.events = [];
  switch (s.phase) {
    case 'ready':
      if (anyAction(input)) {
        s.phase = 'playing';
        spawn(s); // the starting keypress is consumed by the start itself
      }
      return;
    case 'clearing':
      stepClearing(s);
      return;
    case 'playing':
      stepPlaying(s, input);
      return;
  }
}
