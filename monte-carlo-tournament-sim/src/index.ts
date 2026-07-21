import { runMonteCarlo } from "./simulate";
import { GROUPS } from "./teams";

// Usage: npm start [runs] [seed]
//   npm start           → 10,000 runs, seed 42
//   npm start 50000 7   → 50,000 runs, seed 7
const runs = Number(process.argv[2] ?? 10_000);
const seed = Number(process.argv[3] ?? 42);

console.log(`\nSimulating ${runs.toLocaleString()} tournaments (seed ${seed})...\n`);

const odds = runMonteCarlo(GROUPS, runs, seed);

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const row = (name: string, a: string, b: string, c: string) =>
  name.padEnd(16) + a.padStart(11) + b.padStart(14) + c.padStart(13);

console.log(row("Team", "Win group", "Reach final", "Win it all"));
console.log("-".repeat(54));
for (const o of odds) {
  console.log(row(o.team.name, pct(o.winGroup), pct(o.reachFinal), pct(o.winTournament)));
}
console.log("");
