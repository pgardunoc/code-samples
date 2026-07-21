import { Team } from "./model";

// Illustrative data — NOT real ratings. Elo numbers are round and made up; the
// `edge` column is the whole point of the example: hosts sleeping at home carry
// a positive edge, heavy-travel sides a negative one. Watch the hosts finish
// above their raw Elo in the output — that's the travel thesis showing up.
export const GROUPS: Team[][] = [
  // Group A
  [
    { name: "Spain", elo: 2060, edge: 15 },
    { name: "Croatia", elo: 1900, edge: 0 },
    { name: "Nigeria", elo: 1830, edge: -5 },
    { name: "Canada", elo: 1710, edge: 30 }, // host
  ],
  // Group B
  [
    { name: "Argentina", elo: 2040, edge: 20 },
    { name: "Mexico", elo: 1820, edge: 30 }, // host
    { name: "Poland", elo: 1810, edge: -5 },
    { name: "Australia", elo: 1740, edge: -20 }, // long-haul
  ],
  // Group C
  [
    { name: "France", elo: 2050, edge: 0 },
    { name: "USA", elo: 1830, edge: 35 }, // host
    { name: "Senegal", elo: 1820, edge: -10 },
    { name: "Qatar", elo: 1680, edge: -5 },
  ],
  // Group D
  [
    { name: "Brazil", elo: 2010, edge: 10 },
    { name: "England", elo: 1990, edge: 5 },
    { name: "Japan", elo: 1815, edge: -15 }, // long-haul
    { name: "Ghana", elo: 1720, edge: -5 },
  ],
];
