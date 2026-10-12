import { describe, expect, it } from 'vitest';
import type { GameState, Input } from '../types';
import { BOARD_H, BOARD_W, BUFFER_H } from '../types';
import {
  CLEAR_TICKS,
  gravityTicks,
  LOCK_DELAY_TICKS,
  LOCK_RESET_CAP,
  newGame,
  tick,
} from '../engine';

const IDLE: Input = {
  left: false,
  right: false,
  softDrop: false,
  rotateCw: false,
  rotateCcw: false,
  hardDrop: false,
  hold: false,
  pause: false,
};

const press = (keys: Partial<Input>): Input => ({ ...IDLE, ...keys });

// newGame + first action input = a running game with a spawned piece.
function start(seed = 1): GameState {
  const s = newGame(seed);
  tick(s, press({ hardDrop: true })); // in 'ready' this only starts the game
  return s;
}

function idleTicks(s: GameState, n: number): void {
  for (let i = 0; i < n; i++) tick(s, IDLE);
}

// Fill row y with garbage, leaving the given columns empty.
function fillRow(s: GameState, y: number, except: number[] = []): void {
  for (let x = 0; x < BOARD_W; x++) {
    if (!except.includes(x)) s.board[y][x] = 7;
  }
}

const rowIsEmpty = (s: GameState, y: number) => s.board[y].every((c) => c === 0);

describe('game start', () => {
  it('newGame is in ready with an empty board and a primed preview queue', () => {
    const s = newGame(1);
    expect(s.phase).toBe('ready');
    expect(s.active).toBeNull();
    expect(s.board).toHaveLength(BOARD_H);
    expect(s.board.every((_, y) => rowIsEmpty(s, y))).toBe(true);
    expect(s.queue.length).toBeGreaterThan(0);
  });

  it('an action input starts the game and spawns a piece inside the hidden buffer', () => {
    const s = newGame(1);
    tick(s, press({ left: true }));
    expect(s.phase).toBe('playing');
    expect(s.active).not.toBeNull();
  });

  it('idle ticks in ready do not start the game', () => {
    const s = newGame(1);
    idleTicks(s, 10);
    expect(s.phase).toBe('ready');
    expect(s.active).toBeNull();
  });
});

describe('gravity and drops', () => {
  it('the piece falls one row every gravityTicks(level) ticks', () => {
    const s = start();
    const y0 = s.active!.y;
    idleTicks(s, gravityTicks(1) - 1);
    expect(s.active!.y).toBe(y0);
    idleTicks(s, 1);
    expect(s.active!.y).toBe(y0 + 1);
  });

  it('soft drop falls every tick and scores 1 per cell', () => {
    const s = start();
    s.active = { id: 'T', rot: 0, x: 3, y: 5 };
    s.score = 0;
    for (let i = 0; i < 10; i++) tick(s, press({ softDrop: true }));
    expect(s.active!.y).toBe(15);
    expect(s.score).toBe(10);
  });

  it('hard drop slams to the floor, scores 2 per cell, locks, and spawns the next piece', () => {
    const s = start();
    s.active = { id: 'T', rot: 0, x: 3, y: 10 };
    s.score = 0;
    tick(s, press({ hardDrop: true }));
    // T bottom row must land on the last board row: y = BOARD_H - 2 = 20
    expect(s.board[21][3]).toBe(3); // 'T' is piece #3
    expect(s.board[21][4]).toBe(3);
    expect(s.board[21][5]).toBe(3);
    expect(s.board[20][4]).toBe(3);
    expect(s.score).toBe(2 * 10);
    expect(s.active).not.toBeNull(); // next piece spawned
    expect(s.active!.y).toBe(0);
  });

  it('gravity is strictly faster at higher levels (with a floor)', () => {
    expect(gravityTicks(2)).toBeLessThan(gravityTicks(1));
    expect(gravityTicks(99)).toBeGreaterThanOrEqual(1);
  });
});

describe('horizontal movement and rotation', () => {
  it('moves left until the wall blocks it', () => {
    const s = start();
    s.active = { id: 'T', rot: 0, x: 3, y: 10 };
    for (let i = 0; i < 5; i++) tick(s, press({ left: true }));
    expect(s.active!.x).toBe(0); // leftmost legal position for a 3x3 piece
    expect(s.active!.y).toBe(10);
  });

  it('rotates with SRS through the engine (open field: kick 0)', () => {
    const s = start();
    s.active = { id: 'T', rot: 0, x: 3, y: 10 };
    tick(s, press({ rotateCw: true }));
    expect(s.active!.rot).toBe(1);
    expect(s.active!.x).toBe(3);
    expect(s.events).toContain('rotate');
  });
});

describe('line clears and scoring', () => {
  // Drops an O at column 4 to plug rows prepared by the caller, then finishes
  // the clear animation. Returns the score the run ended with.
  function dropOAndClear(s: GameState): void {
    s.active = { id: 'O', rot: 0, x: 4, y: 0 };
    tick(s, press({ hardDrop: true }));
    expect(s.phase).toBe('clearing');
    expect(s.active).toBeNull();
    idleTicks(s, CLEAR_TICKS);
    expect(s.phase).toBe('playing');
  }

  it('single: 100 x level, row collapses, stack above shifts down', () => {
    const s = start();
    s.score = 0;
    fillRow(s, 21, [4, 5]);
    s.board[17][0] = 7; // a floater above the cleared row
    dropOAndClear(s);
    // hard drop dist 20 = 40 pts, single = 100
    expect(s.score).toBe(140);
    expect(s.lines).toBe(1);
    // old row 20 (the O's top half) is now row 21
    expect(s.board[21][4]).not.toBe(0);
    expect(s.board[21][0]).toBe(0);
    expect(s.board[18][0]).toBe(7); // floater moved down one row
  });

  it('double: 300 x level', () => {
    const s = start();
    s.score = 0;
    fillRow(s, 20, [4, 5]);
    fillRow(s, 21, [4, 5]);
    dropOAndClear(s);
    expect(s.score).toBe(40 + 300);
    expect(s.lines).toBe(2);
    // both rows were consumed by the clear — the well is empty again
    expect(rowIsEmpty(s, 21)).toBe(true);
    expect(rowIsEmpty(s, 20)).toBe(true);
  });

  it('triple via the T-spin-triple kick, straight through the engine', () => {
    const s = start();
    s.score = 0;
    s.board[17][0] = 7; // overhang
    fillRow(s, 19, [0]);
    fillRow(s, 20, [0, 1]); // (1,20) is the notch
    fillRow(s, 21, [0]);
    s.active = { id: 'T', rot: 0, x: 0, y: 17 };
    tick(s, press({ rotateCw: true }));
    expect(s.active).toEqual({ id: 'T', rot: 1, x: -1, y: 19 }); // the kick-5 spin
    tick(s, press({ hardDrop: true })); // already resting: dist 0, just locks
    expect(s.phase).toBe('clearing');
    expect(s.clearingRows).toEqual([19, 20, 21]);
    idleTicks(s, CLEAR_TICKS);
    expect(s.score).toBe(500);
    expect(s.lines).toBe(3);
    expect(s.board[20][0]).toBe(7); // overhang fell three rows
  });

  it('quad: 800 x level, fires the quad event', () => {
    const s = start();
    s.score = 0;
    for (const y of [18, 19, 20, 21]) fillRow(s, y, [0]);
    s.active = { id: 'I', rot: 1, x: -2, y: 16 }; // vertical I in column 0
    tick(s, press({ hardDrop: true }));
    expect(s.events).toContain('quad');
    idleTicks(s, CLEAR_TICKS);
    expect(s.score).toBe(2 * 2 + 800);
    expect(s.lines).toBe(4);
    expect([18, 19, 20, 21].every((y) => rowIsEmpty(s, y))).toBe(true);
  });

  it('level rises every 10 lines and multiplies clear scores', () => {
    const s = start();
    s.lines = 9;
    s.score = 0;
    fillRow(s, 21, [4, 5]);
    dropOAndClear(s);
    expect(s.lines).toBe(10);
    expect(s.level).toBe(2);
    expect(s.events).toContain('levelup');
    expect(s.score).toBe(140); // scored at the pre-clear level (1)
  });
});

describe('lock delay', () => {
  function restingT(): GameState {
    const s = start();
    s.active = { id: 'T', rot: 0, x: 3, y: 20 }; // bottom row on the floor
    s.lockTicks = 0;
    s.lockResets = 0;
    s.lowestY = 20;
    return s;
  }

  const isLocked = (s: GameState) => s.board[21][3] !== 0;

  it('a grounded piece locks only after LOCK_DELAY_TICKS', () => {
    const s = restingT();
    idleTicks(s, LOCK_DELAY_TICKS - 1);
    expect(isLocked(s)).toBe(false);
    idleTicks(s, 1);
    expect(isLocked(s)).toBe(true);
  });

  it('a successful move resets the lock timer', () => {
    const s = restingT();
    idleTicks(s, LOCK_DELAY_TICKS - 10);
    tick(s, press({ left: true })); // reset; timer restarts at 1 after this tick
    idleTicks(s, LOCK_DELAY_TICKS - 2);
    expect(isLocked(s)).toBe(false);
    idleTicks(s, 1);
    expect(isLocked(s)).toBe(true);
  });

  it('resets are capped: wiggling forever cannot stall the lock', () => {
    const s = restingT();
    // Alternate left/right every tick — without the cap this would stall forever.
    for (let i = 0; i < LOCK_RESET_CAP + LOCK_DELAY_TICKS + 5; i++) {
      tick(s, press(i % 2 === 0 ? { left: true } : { right: true }));
    }
    expect(s.board[21].some((c) => c !== 0)).toBe(true);
  });
});

describe('hold', () => {
  it('first hold stashes the active piece and spawns the next from the queue', () => {
    const s = start();
    const activeId = s.active!.id;
    const nextId = s.queue[0];
    tick(s, press({ hold: true }));
    expect(s.hold).toBe(activeId);
    expect(s.active!.id).toBe(nextId);
    expect(s.usedHold).toBe(true);
    expect(s.events).toContain('hold');
    expect(s.active!.y).toBe(0); // respawned at the top
  });

  it('a later hold swaps the active piece with the held one', () => {
    const s = start();
    const firstId = s.active!.id;
    tick(s, press({ hold: true })); // stash piece 1
    tick(s, press({ hardDrop: true })); // lock piece 2 → hold available again
    const thirdId = s.active!.id;
    tick(s, press({ hold: true })); // swap piece 3 with the stashed piece 1
    expect(s.active!.id).toBe(firstId);
    expect(s.hold).toBe(thirdId);
  });

  it('cannot hold twice for the same piece', () => {
    const s = start();
    tick(s, press({ hold: true }));
    const held = s.hold;
    const active = s.active!.id;
    tick(s, press({ hold: true })); // ignored
    expect(s.hold).toBe(held);
    expect(s.active!.id).toBe(active);
    expect(s.events).not.toContain('hold');
  });

  it('usedHold clears when a piece locks', () => {
    const s = start();
    tick(s, press({ hold: true }));
    expect(s.usedHold).toBe(true);
    tick(s, press({ hardDrop: true }));
    expect(s.usedHold).toBe(false);
  });
});

describe('top-out', () => {
  it('spawning into a filled cell ends the game', () => {
    const s = start();
    s.board[1][4] = 7; // every spawn shape covers (4,1)
    s.active = { id: 'O', rot: 0, x: 0, y: 18 }; // lock something far from column 4
    tick(s, press({ hardDrop: true }));
    expect(s.phase).toBe('gameover');
    expect(s.events).toContain('gameover');
  });

  it('locking entirely above the visible well ends the game', () => {
    const s = start();
    fillRow(s, BUFFER_H); // solid row right below the buffer
    s.active = { id: 'I', rot: 0, x: 3, y: 0 };
    tick(s, press({ hardDrop: true }));
    expect(s.phase).toBe('gameover');
  });

  it('gameover state ignores further ticks', () => {
    const s = start();
    s.board[1][4] = 7;
    s.active = { id: 'O', rot: 0, x: 0, y: 18 };
    tick(s, press({ hardDrop: true }));
    const frozen = JSON.stringify({ ...s, tick: 0, events: [] });
    idleTicks(s, 10);
    expect(JSON.stringify({ ...s, tick: 0, events: [] })).toBe(frozen);
  });
});

describe('determinism', () => {
  it('same seed + same input script = byte-for-byte identical state', () => {
    const script = (t: number) =>
      press({
        left: t % 7 === 0,
        right: t % 11 === 0,
        softDrop: t % 3 === 0,
        rotateCw: t % 13 === 0,
        rotateCcw: t % 17 === 0,
        hardDrop: t % 97 === 0,
        hold: t % 41 === 0,
      });
    const a = start(42);
    const b = start(42);
    for (let t = 1; t <= 600; t++) {
      tick(a, script(t));
      tick(b, script(t));
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.score).toBeGreaterThan(0); // the script actually played something
  });

  it('different seeds produce different piece queues', () => {
    expect(JSON.stringify(start(1).queue)).not.toBe(JSON.stringify(start(2).queue));
  });
});
