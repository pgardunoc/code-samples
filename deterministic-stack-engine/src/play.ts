// A thin terminal driver for the pure engine. It owns everything the engine
// deliberately does not: reading the keyboard, the 60 Hz wall-clock loop, and
// painting frames. The engine itself never learns it's running in a terminal —
// swap this file for the web component and nothing in src/game/ changes.
//
//   npm run play            # today's daily seed
//   npm run play -- 12345   # a fixed seed (same game every time)
//
// Controls: ← → move · ↓ soft drop · ↑/X rotate CW · Z rotate CCW ·
//           space hard drop · C hold · P pause · Q / Ctrl-C quit

import { newGame, tick, TICK_MS } from './game/engine';
import { renderFrame } from './game/render';
import { dailyLabel, dailySeed } from './game/daily';
import type { Input } from './game/types';

const NO_INPUT: Input = {
  left: false,
  right: false,
  softDrop: false,
  rotateCw: false,
  rotateCcw: false,
  hardDrop: false,
  hold: false,
  pause: false,
};

// Keypresses that arrive between ticks are OR'd into the next tick's snapshot.
// Terminal key-repeat supplies "held" movement — the DAS/ARR shaping a real
// component would add lives outside the engine, so it isn't the engine's problem.
let pending: Input = { ...NO_INPUT };
let paused = false;
let quit = false;

function onKey(seq: string): void {
  switch (seq) {
    case '': // Ctrl-C
    case 'q':
    case 'Q':
      quit = true;
      break;
    case '[D':
    case 'a':
      pending.left = true;
      break;
    case '[C':
    case 'd':
      pending.right = true;
      break;
    case '[B':
    case 's':
      pending.softDrop = true;
      break;
    case '[A':
    case 'x':
    case 'X':
      pending.rotateCw = true;
      break;
    case 'z':
    case 'Z':
      pending.rotateCcw = true;
      break;
    case ' ':
      pending.hardDrop = true;
      break;
    case 'c':
    case 'C':
      pending.hold = true;
      break;
    case 'p':
    case 'P':
      paused = !paused;
      break;
  }
}

function draw(frame: string): void {
  // Home the cursor and overwrite in place, so the well doesn't scroll or flicker.
  process.stdout.write('[H' + frame);
}

function main(): void {
  const arg = process.argv[2];
  const seed = arg !== undefined ? Number(arg) : dailySeed(new Date());
  if (Number.isNaN(seed)) {
    console.error(`Not a number: ${arg}`);
    process.exit(1);
  }
  const label = arg !== undefined ? `seed ${seed}` : `daily ${dailyLabel(new Date())}`;
  const state = newGame(seed);

  const stdin = process.stdin;
  const interactive = stdin.isTTY;
  if (interactive) {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onKey);
    process.stdout.write('[2J[?25l'); // clear screen, hide cursor
  }

  const restore = () => {
    if (interactive) {
      stdin.setRawMode(false);
      process.stdout.write('[?25h\n'); // show cursor
    }
  };

  const flatten = () =>
    renderFrame(state)
      .map((seg) => seg.t)
      .join('');

  const banner = `STACK.TXT — ${label}   (P pause · Q quit)\n`;

  const timer = setInterval(() => {
    if (quit || state.phase === 'gameover') {
      if (state.phase === 'gameover' && !quit) draw(banner + flatten());
      clearInterval(timer);
      restore();
      process.exit(0);
    }
    if (!paused) {
      tick(state, pending);
      pending = { ...NO_INPUT };
    }
    draw(banner + flatten());
  }, TICK_MS);
}

main();
