#!/usr/bin/env bash
#
# The fix: never merge generated output — rebuild it on fresh main.
#
# If this run loses the race, it doesn't try to force its stale work through.
# It resets to whatever main is now and rebuilds from the source of truth.
# Because every step is idempotent, rebuilding on fresh main can never conflict
# and can never drop a result.
#
set -euo pipefail

for attempt in 1 2 3 4 5; do
  git fetch -q origin main
  git reset -q --hard origin/main       # start from whatever main is NOW

  node generate.mjs                      # rebuild from the source of truth

  if [[ -z "$(git status --porcelain)" ]]; then
    echo "No changes — nothing to publish."
    exit 0                               # fully-deterministic generator: loser no-ops
  fi

  git add data/
  git commit -q -m "data: refresh ($(date -u +%Y-%m-%dT%H:%MZ))"

  if git push -q origin main; then
    echo "Pushed on attempt $attempt."
    exit 0                               # won the race — done
  fi

  echo "Push lost a race; rebuilding on fresh main…"
  sleep $((RANDOM % 3 + 1))              # jittered backoff so retriers don't lockstep
done

echo "Gave up after 5 attempts." >&2
exit 1
