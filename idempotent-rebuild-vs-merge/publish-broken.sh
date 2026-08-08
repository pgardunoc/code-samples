#!/usr/bin/env bash
#
# The NAIVE approach — this is what caused the outage. Kept here to reproduce
# the failure. It tries to *merge* two machine-generated files.
#
set -euo pipefail

node generate.mjs

git add data/
git commit -q -m "data: refresh"

# If another run already pushed the same brand-new file, rebasing this commit
# onto it is an add/add conflict git cannot resolve — you'd be asking it to
# stitch half of one generated file to half of another. It gives up, exit 1.
git pull -q --rebase --autostash origin main
git push -q origin main
