import { Team } from "./model";
import { simulateTournament } from "./tournament";
import { mulberry32 } from "./random";

export interface TeamOdds {
  team: Team;
  winGroup: number;
  reachFinal: number;
  winTournament: number;
}

// The Monte Carlo layer. A single tournament is one noisy sample; the point is
// to play it out thousands of times and count how often each team wins its
// group, reaches the final, and lifts the trophy. Those frequencies ARE the
// probabilities — and they fall out of a 48-team bracket in a way a plain Elo
// number never could.
export function runMonteCarlo(groups: Team[][], runs: number, seed: number): TeamOdds[] {
  const rng = mulberry32(seed);
  const teams = groups.flat();

  const winGroup = new Map<string, number>();
  const reachFinal = new Map<string, number>();
  const winTournament = new Map<string, number>();
  for (const t of teams) {
    winGroup.set(t.name, 0);
    reachFinal.set(t.name, 0);
    winTournament.set(t.name, 0);
  }

  for (let i = 0; i < runs; i++) {
    const result = simulateTournament(groups, rng);
    for (const t of result.groupWinners) winGroup.set(t.name, winGroup.get(t.name)! + 1);
    for (const t of result.finalists) reachFinal.set(t.name, reachFinal.get(t.name)! + 1);
    winTournament.set(result.champion.name, winTournament.get(result.champion.name)! + 1);
  }

  return teams
    .map((team) => ({
      team,
      winGroup: winGroup.get(team.name)! / runs,
      reachFinal: reachFinal.get(team.name)! / runs,
      winTournament: winTournament.get(team.name)! / runs,
    }))
    .sort((a, b) => b.winTournament - a.winTournament);
}
