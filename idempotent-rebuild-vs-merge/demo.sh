#!/usr/bin/env bash
#
# Reproduces the race locally, with no GitHub required. It stands up a local
# bare repo as "origin", then runs two overlapping "scheduled runs" against it.
#
#   bash demo.sh broken   # the naive merge approach -> add/add conflict (fails)
#   bash demo.sh fixed     # rebuild-on-fresh-main       -> clean (succeeds)
#
# The ordering is forced (not left to timing) so the failure is reproducible
# every run. In production the same thing happens when two lagging cron runs
# overlap — see .github/workflows/refresh.yml.
#
set -euo pipefail

MODE="${1:-fixed}"
if [[ "$MODE" != "broken" && "$MODE" != "fixed" ]]; then
  echo "usage: $0 [broken|fixed]" >&2
  exit 2
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
SANDBOX="$HERE/.sandbox"
rm -rf "$SANDBOX"
mkdir -p "$SANDBOX"

configure() {
  git -C "$1" config user.email demo@example.com
  git -C "$1" config user.name  demo
  git -C "$1" config commit.gpgsign false
}

# --- stand up a local "origin" (stands in for GitHub) -----------------------
git -c init.defaultBranch=main init --bare -q "$SANDBOX/origin.git"

# seed it with the source of truth — but NO snapshot for the day yet, so both
# runs below will create data/snapshots/2026-07-03.json from scratch.
git -c init.defaultBranch=main init -q "$SANDBOX/seed"
configure "$SANDBOX/seed"
cp "$HERE/generate.mjs" "$SANDBOX/seed/"
mkdir -p "$SANDBOX/seed/data"
cp "$HERE/data/source.json" "$SANDBOX/seed/data/source.json"
(
  cd "$SANDBOX/seed"
  git add .
  git commit -q -m "seed: source of truth"
  git remote add origin "$SANDBOX/origin.git"
  git push -q -u origin main
)

# two runners = two overlapping scheduled runs, each a clone of origin
git clone -q "$SANDBOX/origin.git" "$SANDBOX/runnerA"; configure "$SANDBOX/runnerA"
git clone -q "$SANDBOX/origin.git" "$SANDBOX/runnerB"; configure "$SANDBOX/runnerB"

echo "=== Two scheduled runs wake up together; both build today's snapshot. ==="

# Runner A builds against current main, commits, pushes — it wins the race.
(
  cd "$SANDBOX/runnerA"
  node generate.mjs >/dev/null
  git add data/
  git commit -q -m "data: refresh (runner A)"
  git push -q origin main
  echo "[A] pushed — A won the race."
)

# Runner B cloned before A's push landed, so its main is now stale. It tries to
# publish the same brand-new file.
echo
if [[ "$MODE" == "broken" ]]; then
  echo "=== Runner B, naive publish: commit, then 'git pull --rebase' to reconcile ==="
  set +e
  ( cd "$SANDBOX/runnerB" && bash "$HERE/publish-broken.sh" )
  code=$?
  set -e
  echo
  if [[ $code -ne 0 ]]; then
    echo ">>> Runner B FAILED (exit $code)."
    echo ">>> add/add conflict: two runs each created data/snapshots/2026-07-03.json"
    echo ">>> from scratch, with different contents. git cannot merge them. Red X."
  else
    echo ">>> Unexpected: broken path succeeded. (Re-run; it should conflict.)"
  fi
else
  echo "=== Runner B, the fix: drop stale work, reset to fresh main, rebuild, push ==="
  ( cd "$SANDBOX/runnerB" && bash "$HERE/publish-fixed.sh" )
  echo
  echo ">>> Runner B SUCCEEDED: it reset to A's main and rebuilt from the source"
  echo ">>> of truth, so its push was a clean commit on top — never a merge."
fi

echo
echo "origin history:"
git -C "$SANDBOX/origin.git" log --oneline

rm -rf "$SANDBOX"
