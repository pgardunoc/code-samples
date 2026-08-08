# Idempotent rebuild vs. merge

A scheduled job kept dying on a **merge conflict in a file no human ever
touched**. The fix wasn't smarter conflict handling — it was to stop *merging*
generated data and start *rebuilding* it. This is that pattern, reduced to a
runnable demo you can watch fail and then succeed.

It's extracted from a real outage in [JetLag XI](https://www.jetlagxi.com), my
World Cup 2026 model. Full story: **[The night my World Cup model started
fighting itself](https://pedrogarduno.com/blog/race-condition-cron-jobs/)**.

## The problem

A GitHub Action refreshes data on a schedule: pull the latest input, regenerate
a daily snapshot, commit, push. It ran fine for weeks, then started failing over
and over with:

```
CONFLICT (add/add): Merge conflict in data/snapshots/2026-07-03.json
```

An **add/add** conflict means two commits each created the same file, from
scratch, with different contents. Git can't pick, so it gives up. But there's
only one cron job — how do two commits create the same file at once?

**Overlap.** GitHub Actions cron isn't punctual; under load it lags 15–60 min. A
job scheduled twice an hour (`cron: "10,40 * * * *"`) can have its `:10` run
still grinding when the `:40` run starts. Two copies of the same job, running at
once — and the snapshot they both write is **non-deterministic** (a fresh
timestamp every run; in the real model, Monte Carlo noise too). So both create
`data/snapshots/2026-07-03.json` with slightly different bytes. First push wins.
The second tries to rebase its "add" on top of the first's "add" → conflict.

The original code made it worse by trying to be careful:

```bash
git pull --rebase --autostash origin main   # <- tries to MERGE two generated files
```

There's no sensible merge of two machine-generated snapshots. You don't want
half of one and half of another.

## The fix

The insight: this data isn't something you *merge*. It's something you
*rebuild*. The input is the source of truth; the repo is just a cache. So a run
that loses the race throws its work away, resets to fresh `main`, and
regenerates on top:

```bash
for attempt in 1 2 3 4 5; do
  git fetch origin main
  git reset --hard origin/main     # start from whatever main is NOW
  node generate.mjs                # rebuild from the source of truth (idempotent)
  [[ -z "$(git status --porcelain)" ]] && { echo "No changes."; exit 0; }
  git add data/
  git commit -m "data: refresh"
  git push && exit 0               # won the race? done.
  sleep $((RANDOM % 3 + 1))        # jittered backoff, then rebuild on new main
done
```

Because every step is idempotent and re-reads the source, rebuilding on fresh
`main` can **never** conflict and can **never** drop a result. The random
`sleep` keeps two retriers from lockstepping into each other again.

## Run it

No dependencies beyond Node and git. It stands up a local bare repo as "origin"
and runs two overlapping "scheduled runs" against it — no GitHub needed.

```bash
npm run broken     # the naive merge approach -> add/add conflict (fails, exit 1)
npm start          # the fix: rebuild-on-fresh-main       -> clean (succeeds)
```

## Example output

`npm run broken` — runner B loses the race and can't merge:

```
[A] pushed — A won the race.
CONFLICT (add/add): Merge conflict in data/snapshots/2026-07-03.json
>>> Runner B FAILED (exit 1).
```

`npm start` — same race, but B drops its stale work, resets, and rebuilds:

```
[A] pushed — A won the race.
Pushed on attempt 1.
>>> Runner B SUCCEEDED ... a clean commit on top — never a merge.

origin history:
  data: refresh (2026-08-08T05:22Z)   <- B, rebuilt on fresh main
  data: refresh (runner A)            <- A
  seed: source of truth
```

## Tradeoffs (the honest part)

- **A `concurrency` key is the other guardrail — and it's complementary, not a
  replacement.** `concurrency: { group: refresh-data, cancel-in-progress: false }`
  stops runs from overlapping at all. But with a queue, a *lagging* run can still
  publish stale numbers on top of fresher ones; with `cancel-in-progress: true`
  you throw away in-flight work. Rebuild-on-fresh-main gives a different property:
  **freshest data wins the race, not whoever started first** — which is what you
  want for a model tracking a live event. Use both if you like; they solve
  different halves.
- **This only works because the output is rebuildable.** The whole fix rests on
  the input being the source of truth and generation being idempotent. If the
  snapshot itself were the record of truth (not reconstructable from an input),
  you'd need real reconciliation or a lock instead.
- **The `reset --hard` throws away the loser's work by design.** That's safe here
  because the work is cheap to redo and carries no unique state. Don't reach for
  `reset --hard` on a branch that holds anything you can't regenerate.
- **Reproducibility is left out for brevity.** The real model's snapshots carry a
  timestamp (and had Monte Carlo noise), so they're not byte-reproducible. If you
  need that — e.g. to debug a surprising number — pin the RNG seed and the input
  version into the snapshot. This demo keeps only the input version.

## Files

```
generate.mjs                     idempotent generator (stand-in for the model)
publish-broken.sh                the naive merge approach (reproduces the conflict)
publish-fixed.sh                 reset --hard + rebuild + jittered retry (the fix)
demo.sh                          stands up a local origin + two racing runners
data/source.json                 the "source of truth" (stands in for a scores API)
.github/workflows/refresh.yml    the overlapping-cron setup, illustrative
```

The lesson I keep relearning: **the best fix for a race is usually to remove the
thing being raced over, not to guard it more carefully.**
