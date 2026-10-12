# Deterministic stack engine

The engine behind **STACK.TXT**, a falling-blocks puzzle game, pulled out to
stand on its own. The whole thing is a single pure function —
`tick(state, input)` — with the only source of randomness living *inside* the
state. So a seed plus a log of inputs replays a game **byte-for-byte**. That one
property is what the rest of the design falls out of.

> Play the full game: **[stack-game-two.vercel.app](https://stack-game-two.vercel.app)**.
> This folder is just its core — no React, no Next.js, no DOM.

## The problem

A real falling-blocks game has to get the fiddly parts *right*: SRS rotation
with wall kicks (so spins and tucks work off walls and floor), a 7-bag
randomizer (every seven pieces contain each shape exactly once, no droughts),
lock delay, hold, ghost piece, gravity that ramps with level. Get any of it
subtly wrong and it *feels* wrong, but it's hard to say why.

The usual trap is to grow all of that inside the render loop, tangled with
`requestAnimationFrame`, `Date.now()`, `Math.random()` and DOM state. Then you
can't unit-test a wall kick without a browser, you can't reproduce the bug a
player just hit, and "the same daily puzzle for everyone" is impossible.

## The approach

Push every rule into a **pure engine** and let the outside world own only
time, input, and pixels.

- **`tick(state, input)` is the whole game.** It advances one fixed 60 Hz step,
  mutating the state in place. No `Date.now()`, no DOM, no I/O.
- **Randomness is state, not a global.** The 7-bag draws from a `mulberry32`
  PRNG whose 32-bit state is a field on `GameState` (`rng`). Nothing else calls
  `Math.random()`. Same seed + same inputs ⇒ identical game, every time.
- **Rotations are derived, not hand-typed.** The four orientations of each piece
  come from rotating the spawn shape as a matrix; only the SRS *kick tables* are
  data. Fewer chances to fat-finger a coordinate.
- **The renderer is a separate pure function.** `renderFrame(state)` turns state
  into text runs — it reads state and touches nothing else, so the same engine
  drives a terminal, a `<pre>` on a web page, or a test assertion.

What that determinism buys, for free:

- **Headless tests.** 72 of them, including SRS wall-kick and 7-bag proofs, with
  no browser and no mocking of time or randomness.
- **A shared daily puzzle.** `dailySeed(new Date())` keys off the UTC date, so
  everyone worldwide plays the same stack until the next UTC midnight.
- **Replay and share.** A seed and an input log *are* the replay — nothing else
  needs recording.

## Run it

```bash
nvm use          # Node 24
npm install
npm test         # 72 headless tests: SRS kicks, 7-bag, lock delay, rendering
npm run play     # play it in your terminal (today's daily seed)
npm run play -- 12345   # a fixed seed — the exact same game every run
```

**Controls:** `←` `→` move · `↓` soft drop · `↑`/`X` rotate CW · `Z` rotate CCW ·
`space` hard drop · `C` hold · `P` pause · `Q` quit.

The terminal runner (`src/play.ts`) is deliberately thin: it reads keys, runs
the clock, and prints frames. It's the *only* file that knows a terminal exists.
Swapping it for the web component is a matter of feeding `tick` a different input
source and handing `renderFrame`'s output to the DOM — the engine doesn't change.

## Tradeoffs (the honest part)

- **The engine takes a per-tick input snapshot; it does not shape input.** DAS/ARR
  (auto-shift timing), key-repeat, and touch gestures belong to the driver. The
  terminal runner just leans on the terminal's own key-repeat, so movement feel
  there is rougher than the tuned web build.
- **Fixed 60 Hz timestep, no frame interpolation.** Simple and fully
  deterministic, but it assumes the driver can call `tick` ~16.7 ms apart. The
  web build accumulates real elapsed time and catches up; the terminal runner
  uses a plain `setInterval` and doesn't.
- **`tick` mutates state in place** rather than returning a new state. It's the
  cheap, allocation-free choice for a 60 Hz loop, and determinism doesn't need
  immutability — but it means "undo" or time-travel would have to snapshot.
- **Kick tables cover rotation, not full T-spin scoring.** `tryRotate` returns
  which kick index succeeded (the hook T-spin detection needs), but the scoring
  here is line-clears only.
- **Line-clear "juice" is minimal.** A flash and a quad invert — the pieces the
  engine is designed to make easy (sound, animations) are left to the driver.

## Files

```
src/
  game/
    types.ts     shared types + board constants (no logic)
    bag.ts       mulberry32 PRNG + seeded 7-bag randomizer
    pieces.ts    spawn shapes, derived rotations, SRS wall-kick tables, tryRotate
    engine.ts    newGame + tick: gravity, lock delay, hold, clears, game over
    daily.ts     UTC daily seed / key / label
    render.ts    renderFrame(state) -> text runs; share card
    __tests__/   72 headless tests
  play.ts        thin terminal driver (the only file that knows about a terminal)
```
