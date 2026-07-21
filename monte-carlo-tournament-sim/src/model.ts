import { samplePoisson } from "./random";

// Base goals expectation for an evenly-matched game, nudged up or down by the
// rating gap. The /700 divisor controls how much a rating edge turns into
// goals — you tune it against historical scorelines.
const BASE_GOALS = 1.4;
const ELO_TO_GOALS = 700;

// A team's "effective" rating folds fatigue into raw strength. In the real
// model this edge came from flight distance, time-zone shifts, altitude, heat,
// and how far each kickoff landed from a team's body-clock afternoon. Here it's
// a single pre-computed number so the example stays self-contained. Positive
// edge = fresher / advantaged (e.g. a host sleeping in its own bed).
export interface Team {
  name: string;
  elo: number;
  edge: number; // fatigue/travel adjustment, in Elo points
}

export function effectiveElo(team: Team): number {
  return team.elo + team.edge;
}

// Expected goals for A against B, from the effective-Elo gap. Floored so even a
// heavy underdog always carries a puncher's chance.
function expectedGoals(a: Team, b: Team): number {
  return Math.max(0.15, BASE_GOALS + (effectiveElo(a) - effectiveElo(b)) / ELO_TO_GOALS);
}

export interface MatchResult {
  goalsA: number;
  goalsB: number;
}

// Group-stage match: both teams draw goals from a Poisson, so a draw is a
// natural, common outcome — exactly as it is in real group football.
export function simulateGroupMatch(a: Team, b: Team, rng: () => number): MatchResult {
  return {
    goalsA: samplePoisson(expectedGoals(a, b), rng),
    goalsB: samplePoisson(expectedGoals(b, a), rng),
  };
}

// Knockout match: a draw isn't allowed to stand, so instead of inventing a
// scoreline we go straight to a win probability from the Elo gap (the logistic
// Elo curve) and flip a weighted coin. See the README's tradeoffs section for
// why this shortcut is honest rather than lazy.
export function simulateKnockout(a: Team, b: Team, rng: () => number): Team {
  const pA = 1 / (1 + Math.pow(10, -(effectiveElo(a) - effectiveElo(b)) / 400));
  return rng() < pA ? a : b;
}
