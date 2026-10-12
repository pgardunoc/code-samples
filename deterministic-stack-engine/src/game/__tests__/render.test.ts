import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { CLEAR_TICKS, newGame } from '../engine';
import {
  FRAME_H,
  FRAME_W,
  frameInverted,
  renderFrame,
  shareCard,
  type Seg,
} from '../render';

const textOf = (segs: Seg[]) => segs.map((sg) => sg.t).join('');
const linesOf = (s: GameState) => textOf(renderFrame(s)).split('\n').slice(0, FRAME_H);
const hasClass = (segs: Seg[], c: string) => segs.some((sg) => sg.c === c);

describe('frame geometry', () => {
  it('renders FRAME_H lines of FRAME_W chars each', () => {
    const lines = linesOf(newGame(1));
    expect(lines).toHaveLength(FRAME_H);
    for (const line of lines) expect(line).toHaveLength(FRAME_W);
  });

  it('draws the well border and a dim dot grid (two chars per cell)', () => {
    const lines = linesOf(newGame(1));
    expect(lines[0].slice(0, 22)).toBe('+--------------------+');
    expect(lines[FRAME_H - 1].slice(0, 22)).toBe('+--------------------+');
    expect(lines[1].slice(0, 22)).toBe('|. . . . . . . . . . |');
    expect(hasClass(renderFrame(newGame(1)), 'd')).toBe(true);
  });

  it('is a pure function of state', () => {
    const s = newGame(5);
    expect(renderFrame(s)).toEqual(renderFrame(s));
  });
});

describe('board and piece cells', () => {
  it('renders a locked cell as [] at the right screen position', () => {
    const s = newGame(1);
    s.board[21][0] = 3; // T-colored block, bottom-left of the well
    const lines = linesOf(s);
    expect(lines[20].slice(1, 5)).toBe('[]. '); // board y=21 -> screen row 20
    expect(hasClass(renderFrame(s), 'b3')).toBe(true);
  });

  it('renders the active piece at its board position', () => {
    const s = newGame(1);
    s.phase = 'playing';
    s.active = { id: 'T', rot: 0, x: 3, y: 10 };
    const lines = linesOf(s);
    expect(lines[9].slice(1, 21)).toBe('. . . . []. . . . . ');
    expect(lines[10].slice(1, 21)).toBe('. . . [][][]. . . . ');
  });

  it('hides active-piece cells still inside the spawn buffer', () => {
    const s = newGame(1);
    s.phase = 'playing';
    s.active = { id: 'T', rot: 0, x: 3, y: 0 }; // entirely in hidden rows
    const well = linesOf(s)
      .slice(1, 21)
      .map((l) => l.slice(1, 21))
      .join('');
    expect(well).not.toContain('[');
  });
});

describe('HUD panel', () => {
  it('shows the hold box, empty until a piece is stashed', () => {
    const s = newGame(1);
    const empty = linesOf(s);
    expect(empty[0].slice(23, 27)).toBe('HOLD');
    expect(empty[1].slice(23).trim()).toBe('');
    expect(empty[2].slice(23).trim()).toBe('');
    s.hold = 'O';
    const held = linesOf(s);
    expect(held[1].slice(23, 27)).toBe('[][]');
    expect(held[2].slice(23, 27)).toBe('[][]');
  });

  it('shows the next-piece previews from the queue', () => {
    const s = newGame(1);
    s.queue = ['I', 'O', 'T', 'S', 'Z'];
    const lines = linesOf(s);
    expect(lines[4].slice(23, 27)).toBe('NEXT');
    expect(lines[6].slice(23, 31)).toBe('[][][][]'); // I: flat, second mini row
    expect(lines[8].slice(23, 27)).toBe('[][]'); // O top
    expect(lines[9].slice(23, 27)).toBe('[][]'); // O bottom
    expect(lines[11].slice(23, 29)).toBe('  []  '); // T nub
    expect(lines[12].slice(23, 29)).toBe('[][][]'); // T flat
  });

  it('shows score, lines and level', () => {
    const s = newGame(1);
    s.score = 1234;
    s.lines = 56;
    s.level = 7;
    const lines = linesOf(s);
    expect(lines[14].slice(23, 28)).toBe('SCORE');
    expect(lines[15].slice(23).trim()).toBe('1234');
    expect(lines[17].slice(23, 28)).toBe('LINES');
    expect(lines[18].slice(23).trim()).toBe('56');
    expect(lines[20].slice(23, 28)).toBe('LEVEL');
    expect(lines[21].slice(23).trim()).toBe('7');
  });
});

describe('ghost piece', () => {
  it('projects the hard-drop landing as a dim :: outline', () => {
    const s = newGame(1);
    s.phase = 'playing';
    s.active = { id: 'T', rot: 0, x: 3, y: 10 };
    const lines = linesOf(s);
    expect(lines[19].slice(9, 11)).toBe('::'); // ghost nub at (4,20)
    expect(lines[20].slice(7, 13)).toBe('::::::'); // ghost flat on the floor row
    expect(lines[9].slice(9, 11)).toBe('[]'); // the real piece is still drawn
    expect(hasClass(renderFrame(s), 'g')).toBe(true);
  });

  it('lands the ghost on top of the stack, not the floor', () => {
    const s = newGame(1);
    s.phase = 'playing';
    s.active = { id: 'T', rot: 0, x: 3, y: 10 };
    for (let x = 0; x < 10; x++) s.board[21][x] = 7; // full bottom row
    const lines = linesOf(s);
    expect(lines[18].slice(9, 11)).toBe('::');
    expect(lines[19].slice(7, 13)).toBe('::::::');
  });

  it('draws no ghost when the piece is already grounded', () => {
    const s = newGame(1);
    s.phase = 'playing';
    s.active = { id: 'T', rot: 0, x: 3, y: 20 };
    expect(textOf(renderFrame(s))).not.toContain('::');
  });
});

describe('share card', () => {
  it('renders title, stats, the final well and the link', () => {
    const s = newGame(1);
    s.score = 285;
    s.lines = 3;
    s.level = 1;
    s.board[21][0] = 3;
    const card = shareCard(s, 'AUG 25', 'https://example.com');
    const cardLines = card.split('\n');
    expect(cardLines[0]).toBe('STACK.TXT — daily AUG 25');
    expect(cardLines[1]).toBe('score 285 · lines 3 · level 1');
    expect(cardLines[2]).toBe('+--------------------+');
    expect(cardLines).toHaveLength(2 + 22 + 1); // headers + bordered well + link
    expect(cardLines[23]).toBe('+--------------------+');
    expect(cardLines[22].slice(0, 5)).toBe('|[]. '); // the locked block, bottom-left
    expect(cardLines[24]).toBe("play today's stack: https://example.com");
  });
});

describe('clear flash and game over', () => {
  it('renders clearing rows as a solid white flash', () => {
    const s = newGame(1);
    s.phase = 'clearing';
    s.clearingRows = [21];
    s.phaseTicks = CLEAR_TICKS;
    const lines = linesOf(s);
    expect(lines[20].slice(1, 21)).toBe('[]'.repeat(10));
    expect(hasClass(renderFrame(s), 'fl')).toBe(true);
  });

  it('inverts the whole well briefly on a quad, and only on a quad', () => {
    const s = newGame(1);
    s.phase = 'clearing';
    s.clearingRows = [18, 19, 20, 21];
    s.phaseTicks = CLEAR_TICKS; // first tick of the flash
    expect(frameInverted(s)).toBe(true);
    s.phaseTicks = 1; // flash long over
    expect(frameInverted(s)).toBe(false);
    s.phaseTicks = CLEAR_TICKS;
    s.clearingRows = [21]; // single — no invert
    expect(frameInverted(s)).toBe(false);
  });

  it('prints GAME OVER across the well', () => {
    const s = newGame(1);
    s.phase = 'gameover';
    expect(linesOf(s)[10]).toContain('GAME OVER');
  });
});
