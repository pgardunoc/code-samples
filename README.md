# Code samples — Pedro Garduno

Small, self-contained, runnable examples — each one a real engineering pattern
extracted from my own work, sanitized, and rebuilt to stand on its own. The idea
is that you can read one in a couple of minutes and see how I think about a
problem, without me dumping a whole private codebase on you.

I'm a senior software engineer (18+ years; currently at The Walt Disney Studios)
and I build [four live products](https://www.pedrogarduno.com). I write about
engineering — and honest AI-assisted engineering — at
**[pedrogarduno.com](https://www.pedrogarduno.com)**.

## Examples

| Example | What it shows |
|---|---|
| [monte-carlo-tournament-sim](./monte-carlo-tournament-sim) | Elo + Poisson + 10,000-run Monte Carlo tournament odds. The engine behind [JetLag XI](https://www.jetlagxi.com). |
| [idempotent-rebuild-vs-merge](./idempotent-rebuild-vs-merge) | Two overlapping cron runs fought over a generated file. Fix the race by rebuilding instead of merging — runnable, fails then succeeds. |

## How these are built

Each example is its own folder: a README (problem → approach → tradeoffs → how to
run) and code that runs in isolation. No secrets, no business logic, no client
references — just the pattern, minimal and honest about its limits.

---
Find me: [pedrogarduno.com](https://www.pedrogarduno.com) ·
[LinkedIn](https://www.linkedin.com/in/pgarduno) · [X](https://x.com/pgardunoc)
