#!/usr/bin/env bash
# The static site for GitHub Pages (docs/17), into packages/web/out/.
#
#   SUPERESTELA_BASE_PATH=/superestela scripts/build-static.sh
#
# Route handlers and a proxy cannot exist in a static export, so src/app/api
# is set aside for the build and put back whatever happens. The answers the
# API would give come from public/precomputed/ (src/static/record.test.ts),
# which must be recorded first, against a running API.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d public/precomputed ]; then
  echo "public/precomputed/ is missing: record it first (docs/17)." >&2
  exit 1
fi

aside="$(mktemp -d)"
mv src/app/api "$aside/api"
trap 'mv "$aside/api" src/app/api; rmdir "$aside"' EXIT

rm -rf out
SUPERESTELA_STATIC=1 pnpm exec next build
# Pages runs Jekyll on the site unless told not to, and Jekyll drops _next/.
touch out/.nojekyll
echo "Static site in packages/web/out ($(du -sh out | cut -f1))."
