#!/bin/sh
# Starts the API (internal, two workers for ~15 people at once, ~390 MB each),
# waits until it answers, then serves the web on the Space's port.
set -e
cd /home/user/app
uv run --no-sync uvicorn api.main:app --app-dir packages \
  --host 127.0.0.1 --port 8000 --workers 2 &
until python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" 2>/dev/null; do
  sleep 1
done
cd packages/web
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 7860
