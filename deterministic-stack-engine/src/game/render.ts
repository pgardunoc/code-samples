// State -> Seg[] runs. One frame = the whole screen as text; only cells that
// need a color/style become <span>s (run-compression, so a web renderer emits
// one span per style change instead of one per cell).
//
// The genre-specific rule: one board cell = TWO monospace columns ('[]' filled,
// '. ' empty) so cells read as squares, not vertical dominoes.

import { CLEAR_TICKS, collides } from './engine';
import { cellsAt, cellsOf, PIECE_IDS } from './pieces';
import type { GameState } from './types';
import { BOARD_H, BOARD_W, BUFFER_H, VISIBLE_H } from './types';

export interface Seg {
  t: string;
  c?: string;
}

export const NEXT_PREVIEW = 3;

const WELL_COLS = 2 + BOARD_W * 2; // borders + 2 chars per cell
const PANEL_X = WELL_COLS + 1;
const PANEL_W = 10;
export const FRAME_W = PANEL_X + PANEL_W;
export const FRAME_H = VISIBLE_H + 2; // well + top/bottom border

const HBORDER = '+' + '-'.repeat(BOARD_W * 2) + '+';

export function renderFrame(s: GameState): Seg[] {
  const ch: string[][] = Array.from({ length: FRAME_H }, () =>
    Array<string>(FRAME_W).fill(' ')
  );
  const cl: (string | undefined)[][] = Array.from({ length: FRAME_H }, () =>
    Array<string | undefined>(FRAME_W).fill(undefined)
  );

  const put = (r: number, c: number, text: string, cls?: string) => {
    for (let i = 0; i < text.length; i++) {
      ch[r][c + i] = text[i];
      cl[r][c + i] = cls;
    }
  };

  // the well
  put(0, 0, HBORDER);
  put(FRAME_H - 1, 0, HBORDER);
  for (let y = BUFFER_H; y < BOARD_H; y++) {
    const r = y - BUFFER_H + 1;
    ch[r][0] = '|';
    ch[r][WELL_COLS - 1] = '|';
    const clearing = s.phase === 'clearing' && s.clearingRows.includes(y);
    for (let x = 0; x < BOARD_W; x++) {
      const v = s.board[y][x];
      if (clearing) put(r, 1 + x * 2, '[]', 'fl');
      else if (v) put(r, 1 + x * 2, '[]', 'b' + v);
      else put(r, 1 + x * 2, '. ', 'd');
    }
  }

  // ghost then piece, so the real piece wins where they overlap
  if (s.phase === 'playing' && s.active) {
    const ghostY = ghostDropY(s);
    if (ghostY > s.active.y) {
      for (const { x, y } of cellsAt({ ...s.active, y: ghostY })) {
        if (y < BUFFER_H) continue;
        put(y - BUFFER_H + 1, 1 + x * 2, '::', 'g');
      }
    }
    const v = PIECE_IDS.indexOf(s.active.id) + 1;
    for (const { x, y } of cellsAt(s.active)) {
      if (y < BUFFER_H) continue;
      put(y - BUFFER_H + 1, 1 + x * 2, '[]', 'b' + v);
    }
  }

  // side panel: hold box, next-piece previews, the numbers
  const mini = (id: (typeof PIECE_IDS)[number], row: number) => {
    const v = PIECE_IDS.indexOf(id) + 1;
    for (const { x, y } of cellsOf(id, 0)) {
      if (y > 1) continue; // every spawn shape lives in its top two rows
      put(row + y, PANEL_X + x * 2, '[]', 'b' + v);
    }
  };
  put(0, PANEL_X, 'HOLD');
  if (s.hold) mini(s.hold, 1);
  put(4, PANEL_X, 'NEXT');
  s.queue.slice(0, NEXT_PREVIEW).forEach((id, i) => mini(id, 5 + i * 3));
  put(14, PANEL_X, 'SCORE');
  put(15, PANEL_X, String(s.score));
  put(17, PANEL_X, 'LINES');
  put(18, PANEL_X, String(s.lines));
  put(20, PANEL_X, 'LEVEL');
  put(21, PANEL_X, String(s.level));

  if (s.phase === 'gameover') {
    put(10, 1 + Math.floor((BOARD_W * 2 - 9) / 2), 'GAME OVER', 'msg');
  }

  return toSegs(ch, cl);
}

// Where the active piece would land on a hard drop (its ghost row).
function ghostDropY(s: GameState): number {
  const p = s.active!;
  let y = p.y;
  while (!collides(s.board, cellsAt({ ...p, y: y + 1 }))) y++;
  return y;
}

// The paste-anywhere score card: title, stats, the final well, a challenge link.
export function shareCard(s: GameState, label: string, origin: string): string {
  const rows: string[] = [
    `STACK.TXT — daily ${label}`,
    `score ${s.score} · lines ${s.lines} · level ${s.level}`,
    HBORDER,
  ];
  for (let y = BUFFER_H; y < BOARD_H; y++) {
    let row = '|';
    for (let x = 0; x < BOARD_W; x++) row += s.board[y][x] ? '[]' : '. ';
    rows.push(row + '|');
  }
  rows.push(HBORDER);
  rows.push(`play today's stack: ${origin}`);
  return rows.join('\n');
}

// Invert the whole well for the first few ticks of a quad clear — cheap juice.
export function frameInverted(s: GameState): boolean {
  return (
    s.phase === 'clearing' &&
    s.clearingRows.length === 4 &&
    CLEAR_TICKS - s.phaseTicks < 3
  );
}

// run-compress a char grid + class grid into spans
function toSegs(ch: string[][], cl: (string | undefined)[][]): Seg[] {
  const segs: Seg[] = [];
  let buf = '';
  let cls: string | undefined;
  const flush = () => {
    if (buf) segs.push(cls ? { t: buf, c: cls } : { t: buf });
    buf = '';
  };
  for (let y = 0; y < ch.length; y++) {
    for (let x = 0; x < ch[y].length; x++) {
      const c = cl[y][x];
      if (c !== cls) {
        flush();
        cls = c;
      }
      buf += ch[y][x];
    }
    if (cls !== undefined) {
      flush();
      cls = undefined;
    }
    buf += '\n';
  }
  flush();
  return segs;
}
