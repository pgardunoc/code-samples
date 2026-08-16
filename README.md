# Code samples — Pedro Garduno

A handful of small, runnable examples. Each one is a real engineering pattern I
pulled from my own work, cleaned up, and rebuilt so it stands on its own. You can
read one in a couple of minutes and get a feel for how I think through a problem,
without me handing you a whole private codebase.

I'm a senior software engineer with 18+ years behind me, currently at The Walt
Disney Studios, and I build [four live products](https://www.pedrogarduno.com). I
also write about engineering, including the honest side of working with AI, at
**[pedrogarduno.com](https://www.pedrogarduno.com)**.

## Examples

| Example | What it shows |
|---|---|
| [monte-carlo-tournament-sim](./monte-carlo-tournament-sim) | Elo plus Poisson plus a 10,000-run Monte Carlo to get tournament odds. The engine behind [JetLag XI](https://www.jetlagxi.com). |
| [idempotent-rebuild-vs-merge](./idempotent-rebuild-vs-merge) | Two overlapping cron runs fought over a generated file. The fix was to rebuild the data instead of merging it. Runnable: watch it fail, then succeed. |

## How these are built

Every example lives in its own folder with a README (problem, approach,
tradeoffs, how to run) and code that runs in isolation. No secrets, no business
logic, no client references. Just the pattern, kept minimal and honest about
where it breaks down.

---
Find me: [pedrogarduno.com](https://www.pedrogarduno.com) ·
[LinkedIn](https://www.linkedin.com/in/pgarduno) · [X](https://x.com/pgardunoc)
