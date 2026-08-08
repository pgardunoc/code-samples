// Rebuilds today's snapshot from the source of truth.
//
// In the real system the "source of truth" is scores fetched from an API; here
// it's a local file so the example is self-contained. The key property is that
// this script is IDEMPOTENT with respect to the source: given the same source,
// the meaningful output is the same, so a snapshot can always be *rebuilt*
// rather than *merged*.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const source = JSON.parse(readFileSync('data/source.json', 'utf8'));

// Derived data — deterministic given the source. (Re-fetching the same scores
// produces the same numbers, which is what makes a rebuild safe.)
const totalGoals = source.matches.reduce((sum, m) => sum + m.home + m.away, 0);

const snapshot = {
  date: source.date,
  sourceVersion: source.version, // pins which input produced this snapshot
  totalGoals,                    // stand-in for "the model output"
  // The non-deterministic bit that caused the original conflict: every run
  // stamps a fresh timestamp, so two overlapping runs write *different* bytes
  // for the same file. (The real model also had Monte Carlo noise here — same
  // lesson: generated output is not something you merge.)
  generatedAt: new Date().toISOString(),
};

const path = `data/snapshots/${source.date}.json`;
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, JSON.stringify(snapshot, null, 2) + '\n');
console.log(`wrote ${path}`);
