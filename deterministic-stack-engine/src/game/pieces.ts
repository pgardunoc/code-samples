// The 7 pieces: spawn shapes, all 4 SRS rotation states, and the SRS wall-kick
// tables. Pure data + pure functions — no board knowledge beyond a collision
// callback, so everything here is testable headlessly.

import type { ActivePiece, Cell, PieceId, Rotation, RotationDir } from './types';

export const PIECE_IDS: readonly PieceId[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// Spawn orientations, row 0 = top of the bounding box, y grows down (board
// convention). SRS rotates a piece about the center of this fixed box, which is
// exactly a matrix rotation — so the other 3 states are derived, not hand-typed.
const SPAWN_SHAPES: Record<PieceId, string[]> = {
  I: ['....',
      'XXXX',
      '....',
      '....'],
  O: ['XX',
      'XX'],
  T: ['.X.',
      'XXX',
      '...'],
  S: ['.XX',
      'XX.',
      '...'],
  Z: ['XX.',
      '.XX',
      '...'],
  J: ['X..',
      'XXX',
      '...'],
  L: ['..X',
      'XXX',
      '...'],
};

function shapeCells(shape: string[]): Cell[] {
  const cells: Cell[] = [];
  shape.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'X') cells.push({ x, y });
    }
  });
  return cells;
}

// Clockwise rotation inside an n×n box: (x, y) -> (n-1-y, x).
function rotateCells(cells: Cell[], size: number): Cell[] {
  return cells.map(({ x, y }) => ({ x: size - 1 - y, y: x }));
}

const sortCells = (cells: Cell[]) =>
  cells.sort((a, b) => a.y - b.y || a.x - b.x);

// CELLS[id][rot] = the piece's 4 cells in that rotation state (local coords).
const CELLS = (() => {
  const out = {} as Record<PieceId, readonly Cell[][]>;
  for (const id of PIECE_IDS) {
    const size = SPAWN_SHAPES[id].length;
    const states: Cell[][] = [sortCells(shapeCells(SPAWN_SHAPES[id]))];
    for (let r = 1; r < 4; r++) {
      states.push(sortCells(rotateCells(states[r - 1], size)));
    }
    out[id] = states;
  }
  return out;
})();

export function cellsOf(id: PieceId, rot: Rotation): readonly Cell[] {
  return CELLS[id][rot];
}

export function cellsAt(piece: ActivePiece): Cell[] {
  return CELLS[piece.id][piece.rot].map(({ x, y }) => ({
    x: piece.x + x,
    y: piece.y + y,
  }));
}

export function rotateCw(rot: Rotation): Rotation {
  return ((rot + 1) % 4) as Rotation;
}

export function rotateCcw(rot: Rotation): Rotation {
  return ((rot + 3) % 4) as Rotation;
}

// --- SRS wall-kick tables ------------------------------------------------
// These are the standard guideline kick offsets with the y component NEGATED,
// because the guideline data uses +y = up and our board uses +y = down.
// Keyed by '<from>><to>' with 0 = spawn, 1 = R, 2 = 180, 3 = L.

export type Kick = readonly [dx: number, dy: number];
export type KickTable = Record<string, readonly Kick[]>;

export const JLSTZ_KICKS: KickTable = {
  '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};

export const I_KICKS: KickTable = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

const O_KICKS: readonly Kick[] = [[0, 0]]; // O never kicks (it doesn't move when rotated)

export function getKicks(id: PieceId, from: Rotation, to: Rotation): readonly Kick[] {
  if (id === 'O') return O_KICKS;
  const table = id === 'I' ? I_KICKS : JLSTZ_KICKS;
  return table[`${from}>${to}`];
}

// Attempt an SRS rotation: try each kick offset in order, return the first
// placement the board accepts (plus which kick it was — needed later for
// T-spin detection), or null if all five fail.
export function tryRotate(
  piece: ActivePiece,
  dir: RotationDir,
  blocked: (cells: Cell[]) => boolean
): { piece: ActivePiece; kickIndex: number } | null {
  const to = dir === 'cw' ? rotateCw(piece.rot) : rotateCcw(piece.rot);
  const kicks = getKicks(piece.id, piece.rot, to);
  for (let i = 0; i < kicks.length; i++) {
    const [dx, dy] = kicks[i];
    const candidate: ActivePiece = {
      id: piece.id,
      rot: to,
      x: piece.x + dx,
      y: piece.y + dy,
    };
    if (!blocked(cellsAt(candidate))) {
      return { piece: candidate, kickIndex: i };
    }
  }
  return null;
}
