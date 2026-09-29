#!/bin/sh
# Run the whole site locally with no Cloudflare account. Uses data/build/ if the pipeline has been run,
# otherwise the sample data in sample/. Usage: ./dev.sh [port]
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node 22.13 or newer is needed: https://nodejs.org" >&2
  exit 1
fi
exec node site/dev.mjs "$@"
