# Monte Carlo tournament simulator

A minimal, self-contained football-tournament simulator: **Elo ratings → Poisson
scorelines → 10,000 simulated tournaments → probabilities**. Around 200 lines of
TypeScript, no runtime dependencies, runs in one command.

It's the stripped-down engine behind [JetLag XI](https://www.jetlagxi.com), my
World Cup 2026 model. Full writeup of how the real one did (and where it was
wrong): **[I built a World Cup model around jet lag, then graded it in
public](https://pedrogarduno.com/blog/jetlagxi-world-cup-model/)**.

## The problem

An Elo rating tells you the odds of one team beating another. It **cannot** tell
you a team's chance of *winning its group*, *reaching the final*, or *lifting the
trophy* — those depend on a whole bracket of correlated matches, group
tiebreakers, and who you'd meet in the next round. There's no closed-form answer.

So you don't solve it — you *play it out*. Thousands of times. Count how often
each outcome happens. Those frequencies are your probabilities. That's Monte
Carlo, and it's the right tool the moment "what are the odds of X" depends on a
long chain of chance events you can simulate but can't neatly integrate.

## How it works

- **Strength** is an Elo rating per team. The gap between two teams sets the
  expected goals: `μ = 1.4 + (eloA − eloB) / 700`.
- **Fatigue** rides on top as an `edge` (in Elo points) — a host sleeping in its
  own bed gets a positive edge, a long-haul side a negative one. In the real
  model this came from flight distance, time-zone shifts, altitude, heat, and
  body-clock kickoff times; here it's one number so the example stays small.
- **Group matches** draw goals from a Poisson on each side's expected goals, so
  **draws happen naturally** — as they should in group football.
- **Knockout matches** can't stand as a draw, so they skip the scoreline and use
  the logistic Elo win probability directly, then flip a weighted coin.
- **The Monte Carlo layer** plays the full tournament `runs` times and tallies
  how often each team wins its group, reaches the final, and wins it all.

A seeded PRNG (`mulberry32`) makes every run **reproducible** — same seed, same
numbers — which is what lets you debug a surprising probability instead of
shrugging at it.

## Run it

```bash
npm install
npm start            # 10,000 tournaments, seed 42
npm start 50000 7    # 50,000 tournaments, seed 7
```

## Example output

`npm start` on the bundled illustrative ratings (seed 42):

```
Team              Win group   Reach final   Win it all
------------------------------------------------------
Spain                 48.4%         34.4%        21.7%
Argentina             49.7%         32.6%        19.7%
France                50.5%         30.6%        18.3%
Brazil                39.4%         26.4%        13.8%
England               36.0%         23.1%        11.4%
Croatia               24.5%         11.5%         3.9%
USA                   23.1%          8.3%         2.8%
...
```

Look at **USA**: raw Elo 1830, but it reaches the final more often than Mexico
and about as often as Senegal, both similarly rated. The host edge (+35) is
doing that — the travel thesis showing up in the output, which is the whole
reason the model exists.

## Tradeoffs (the honest part)

- **Knockouts don't model a scoreline.** Using the Elo win-prob directly avoids
  inventing a fake 1–0, but it also means no explicit extra-time or penalties
  model — fine for tournament odds, wrong if you wanted knockout scorelines.
- **Per-match "who wins" can't express a draw.** The group sim *produces* draws,
  but if you collapse a prediction to a single winner you can't score a 0–0 —
  which is exactly the failure mode the [blog
  post](https://pedrogarduno.com/blog/jetlagxi-world-cup-model/) is about.
- **Poisson assumes goal independence** — no momentum, red cards, or a team
  shutting up shop at 1–0.
- **Elo + one edge number** is a deliberate flattening of a much richer fatigue
  index. Good enough to show the mechanism; not the real thing.
- **Group tiebreakers past goal difference/goals-for are RNG stand-ins**, not
  real head-to-head rules.

## Files

```
src/
  random.ts       seedable PRNG + Poisson sampler
  model.ts        Elo → expected goals; group & knockout match models
  tournament.ts   group standings, tiebreakers, bracket
  simulate.ts     the Monte Carlo loop + aggregation
  teams.ts        illustrative ratings (NOT real — round, made-up numbers)
  index.ts        CLI entry
```
