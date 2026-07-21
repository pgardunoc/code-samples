import { Team, MatchResult, simulateGroupMatch, simulateKnockout } from "./model";

interface Standing {
  team: Team;
  points: number;
  gf: number;
  ga: number;
}

function blankStanding(team: Team): Standing {
  return { team, points: 0, gf: 0, ga: 0 };
}

function applyResult(sa: Standing, sb: Standing, r: MatchResult): void {
  sa.gf += r.goalsA;
  sa.ga += r.goalsB;
  sb.gf += r.goalsB;
  sb.ga += r.goalsA;
  if (r.goalsA > r.goalsB) sa.points += 3;
  else if (r.goalsA < r.goalsB) sb.points += 3;
  else {
    sa.points += 1;
    sb.points += 1;
  }
}

// Rank a group: points, then goal difference, then goals scored. Anything still
// level is broken by the RNG — a deliberate stand-in for real head-to-head
// rules, kept simple so the bracket is always fully determined.
function rankGroup(standings: Standing[], rng: () => number): Team[] {
  return [...standings]
    .sort(
      (x, y) =>
        y.points - x.points ||
        y.gf - y.ga - (x.gf - x.ga) ||
        y.gf - x.gf ||
        rng() - 0.5,
    )
    .map((s) => s.team);
}

// One group: full round-robin, top two advance.
export function simulateGroup(teams: Team[], rng: () => number): Team[] {
  const standings = teams.map(blankStanding);
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      applyResult(standings[i], standings[j], simulateGroupMatch(teams[i], teams[j], rng));
    }
  }
  const ranked = rankGroup(standings, rng);
  return [ranked[0], ranked[1]];
}

export interface BracketResult {
  finalists: Team[];
  champion: Team;
}

// Single-elimination over a power-of-two list. We snapshot the last two teams
// as the finalists on the way to crowning a champion, so the Monte Carlo layer
// can report "reached the final" as well as "won it".
export function simulateBracket(teams: Team[], rng: () => number): BracketResult {
  let round = teams;
  let finalists: Team[] = teams;
  while (round.length > 1) {
    if (round.length === 2) finalists = [...round];
    const next: Team[] = [];
    for (let i = 0; i < round.length; i += 2) {
      next.push(simulateKnockout(round[i], round[i + 1], rng));
    }
    round = next;
  }
  return { finalists, champion: round[0] };
}

export interface TournamentResult {
  groupWinners: Team[];
  finalists: Team[];
  champion: Team;
}

// Play the whole thing out once: four groups of four, top two from each into a
// bracket seeded so group-mates can only meet again in the final.
export function simulateTournament(groups: Team[][], rng: () => number): TournamentResult {
  const qualifiers = groups.map((g) => simulateGroup(g, rng)); // [[winner, runner-up], ...]
  const [A, B, C, D] = qualifiers;
  const bracket = [A[0], B[1], C[0], D[1], B[0], A[1], D[0], C[1]];
  const { finalists, champion } = simulateBracket(bracket, rng);
  return {
    groupWinners: qualifiers.map((q) => q[0]),
    finalists,
    champion,
  };
}
