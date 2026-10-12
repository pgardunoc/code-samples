import { describe, expect, it } from 'vitest';
import type { ActivePiece, Cell, PieceId, Rotation } from '../types';
import { BOARD_W, VISIBLE_H } from '../types';
import {
  cellsAt,
  cellsOf,
  getKicks,
  I_KICKS,
  JLSTZ_KICKS,
  PIECE_IDS,
  rotateCcw,
  rotateCw,
  tryRotate,
} from '../pieces';

// Builds a collision predicate for a well whose bottom rows are the given ASCII
// strings ('X' = filled). Rows above are empty; y < 0 is the open spawn buffer.
// Walls at x < 0, x >= BOARD_W and floor at y >= VISIBLE_H are always solid.
function wellWith(bottomRows: string[]): (cells: Cell[]) => boolean {
  const top = VISIBLE_H - bottomRows.length;
  return (cells) =>
    cells.some(({ x, y }) => {
      if (x < 0 || x >= BOARD_W || y >= VISIBLE_H) return true;
      const row = bottomRows[y - top];
      return row !== undefined && row[x] === 'X';
    });
}

const emptyWell = wellWith([]);

const sorted = (cells: readonly Cell[]) =>
  [...cells].sort((a, b) => a.y - b.y || a.x - b.x);

describe('piece shapes', () => {
  it('every piece has exactly 4 cells in all 4 rotation states', () => {
    for (const id of PIECE_IDS) {
      for (const rot of [0, 1, 2, 3] as Rotation[]) {
        expect(cellsOf(id, rot)).toHaveLength(4);
      }
    }
  });

  it('spawn shapes match the SRS spawn orientations (flat side down, y grows down)', () => {
    const spawn: Record<PieceId, Cell[]> = {
      I: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
      O: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
      T: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      S: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
      Z: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      J: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
      L: [{ x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
    };
    for (const id of PIECE_IDS) {
      expect(sorted(cellsOf(id, 0))).toEqual(sorted(spawn[id]));
    }
  });

  it('T rotation states are correct matrix rotations inside the 3x3 box', () => {
    expect(sorted(cellsOf('T', 1))).toEqual([
      { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 },
    ]);
    expect(sorted(cellsOf('T', 2))).toEqual([
      { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 },
    ]);
    expect(sorted(cellsOf('T', 3))).toEqual([
      { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 },
    ]);
  });

  it('I rotation states occupy the correct row/column of the 4x4 box', () => {
    expect(sorted(cellsOf('I', 1))).toEqual([
      { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 },
    ]);
    expect(sorted(cellsOf('I', 2))).toEqual([
      { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 },
    ]);
    expect(sorted(cellsOf('I', 3))).toEqual([
      { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 },
    ]);
  });

  it('O looks identical in all rotation states', () => {
    const spawn = sorted(cellsOf('O', 0));
    for (const rot of [1, 2, 3] as Rotation[]) {
      expect(sorted(cellsOf('O', rot))).toEqual(spawn);
    }
  });

  it('cellsAt translates local cells by the piece position', () => {
    const piece: ActivePiece = { id: 'T', rot: 0, x: 3, y: 5 };
    expect(sorted(cellsAt(piece))).toEqual([
      { x: 4, y: 5 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 },
    ]);
  });
});

describe('rotation state cycling', () => {
  it('cycles 0 -> R -> 2 -> L -> 0 clockwise', () => {
    expect(rotateCw(0)).toBe(1);
    expect(rotateCw(1)).toBe(2);
    expect(rotateCw(2)).toBe(3);
    expect(rotateCw(3)).toBe(0);
  });

  it('cycles 0 -> L -> 2 -> R -> 0 counter-clockwise', () => {
    expect(rotateCcw(0)).toBe(3);
    expect(rotateCcw(3)).toBe(2);
    expect(rotateCcw(2)).toBe(1);
    expect(rotateCcw(1)).toBe(0);
  });
});

describe('kick tables (guideline SRS data, y negated because our y grows down)', () => {
  it('JLSTZ 0->R and R->0 match the canonical table', () => {
    expect(JLSTZ_KICKS['0>1']).toEqual([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]);
    expect(JLSTZ_KICKS['1>0']).toEqual([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]);
  });

  it('JLSTZ 2->L and 0->L match the canonical table', () => {
    expect(JLSTZ_KICKS['2>3']).toEqual([[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]);
    expect(JLSTZ_KICKS['0>3']).toEqual([[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]);
  });

  it('I 0->R and R->2 match the canonical I table', () => {
    expect(I_KICKS['0>1']).toEqual([[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]]);
    expect(I_KICKS['1>2']).toEqual([[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]);
  });

  it('every transition has 5 kicks starting with (0,0), for both tables', () => {
    const transitions = ['0>1', '1>0', '1>2', '2>1', '2>3', '3>2', '3>0', '0>3'];
    for (const table of [JLSTZ_KICKS, I_KICKS]) {
      for (const t of transitions) {
        expect(table[t]).toHaveLength(5);
        expect(table[t][0]).toEqual([0, 0]);
      }
    }
  });

  it('getKicks routes JLSTZ pieces to the shared table and I to its own', () => {
    for (const id of ['J', 'L', 'S', 'T', 'Z'] as PieceId[]) {
      expect(getKicks(id, 0, 1)).toEqual(JLSTZ_KICKS['0>1']);
    }
    expect(getKicks('I', 0, 1)).toEqual(I_KICKS['0>1']);
    expect(getKicks('O', 0, 1)).toEqual([[0, 0]]);
  });
});

describe('tryRotate — wall kicks against real wells', () => {
  it('rotates in place (kick 0) in an open field', () => {
    for (const id of PIECE_IDS) {
      const piece: ActivePiece = { id, rot: 0, x: 3, y: 5 };
      const result = tryRotate(piece, 'cw', emptyWell);
      expect(result).not.toBeNull();
      expect(result!.kickIndex).toBe(0);
      expect(result!.piece).toEqual({ id, rot: 1, x: 3, y: 5 });
    }
  });

  it('T on the floor kicks up-left on CW rotation (kick 3: -1,-1)', () => {
    const piece: ActivePiece = { id: 'T', rot: 0, x: 3, y: 18 };
    const result = tryRotate(piece, 'cw', emptyWell);
    expect(result).not.toBeNull();
    expect(result!.piece).toEqual({ id: 'T', rot: 1, x: 2, y: 17 });
    expect(result!.kickIndex).toBe(2);
  });

  it('T on the floor kicks up-right on CCW rotation (mirror case)', () => {
    const piece: ActivePiece = { id: 'T', rot: 0, x: 3, y: 18 };
    const result = tryRotate(piece, 'ccw', emptyWell);
    expect(result).not.toBeNull();
    expect(result!.piece).toEqual({ id: 'T', rot: 3, x: 4, y: 17 });
    expect(result!.kickIndex).toBe(2);
  });

  it('T-spin triple: the last 0->R kick (-1,+2) drops the T into a 3-deep slot', () => {
    // The canonical TST fixture: a 1-wide, 3-deep slot in column 0 with a notch
    // at (1,18) and an overhang at (0,15). Kicks 1-4 all collide; only the final
    // kick (left 1, down 2) fits — the T ends up filling rows 17-19 completely.
    const blocked = wellWith([
      'X.........', // y=15  overhang
      '..........', // y=16
      '.XXXXXXXXX', // y=17
      '..XXXXXXXX', // y=18  (1,18) is the notch
      '.XXXXXXXXX', // y=19
    ]);
    const piece: ActivePiece = { id: 'T', rot: 0, x: 0, y: 15 };
    expect(blocked(cellsAt(piece))).toBe(false); // sanity: start position is legal
    const result = tryRotate(piece, 'cw', blocked);
    expect(result).not.toBeNull();
    expect(result!.piece).toEqual({ id: 'T', rot: 1, x: -1, y: 17 });
    expect(result!.kickIndex).toBe(4);
    // The locked T would complete rows 17, 18 and 19 — a triple.
    expect(sorted(cellsAt(result!.piece))).toEqual([
      { x: 0, y: 17 }, { x: 0, y: 18 }, { x: 1, y: 18 }, { x: 0, y: 19 },
    ]);
  });

  it('vertical I against the left wall kicks right when rotated flat (I table)', () => {
    const piece: ActivePiece = { id: 'I', rot: 3, x: -1, y: 10 };
    expect(emptyWell(cellsAt(piece))).toBe(false); // hugging the wall, still legal
    const result = tryRotate(piece, 'cw', emptyWell);
    expect(result).not.toBeNull();
    expect(result!.piece).toEqual({ id: 'I', rot: 0, x: 0, y: 10 });
    expect(result!.kickIndex).toBe(1);
  });

  it('vertical I against the right wall kicks left when rotated flat (I table)', () => {
    const piece: ActivePiece = { id: 'I', rot: 1, x: 7, y: 10 };
    expect(emptyWell(cellsAt(piece))).toBe(false);
    const result = tryRotate(piece, 'cw', emptyWell);
    expect(result).not.toBeNull();
    expect(result!.piece).toEqual({ id: 'I', rot: 2, x: 6, y: 10 });
    expect(result!.kickIndex).toBe(1);
  });

  it('returns null when every kick is blocked (piece stays as-is)', () => {
    // T sealed into a T-shaped pocket: the only empty cells are its own.
    const blocked = wellWith([
      'XXXXXXXXXX', // y=15
      'XXXXXXXXXX', // y=16
      'XXXX.XXXXX', // y=17
      'XXX...XXXX', // y=18
      'XXXXXXXXXX', // y=19
    ]);
    const piece: ActivePiece = { id: 'T', rot: 0, x: 3, y: 17 };
    expect(blocked(cellsAt(piece))).toBe(false);
    expect(tryRotate(piece, 'cw', blocked)).toBeNull();
    expect(tryRotate(piece, 'ccw', blocked)).toBeNull();
  });

  it('O rotates trivially in place, even against a wall', () => {
    const piece: ActivePiece = { id: 'O', rot: 0, x: 0, y: 18 };
    const result = tryRotate(piece, 'cw', emptyWell);
    expect(result).not.toBeNull();
    expect(result!.kickIndex).toBe(0);
    expect(sorted(cellsAt(result!.piece))).toEqual(sorted(cellsAt(piece)));
  });
});
